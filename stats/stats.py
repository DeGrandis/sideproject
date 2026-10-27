"""The page at stats.degrand.is: visits and errors for every site, the box's health, and GitHub's numbers.

Every few minutes this adds nginx's new visit-log lines (/logs/visits.log, one line per page load, server error,
demo question or Start over, with the address already shortened to its first three parts) to running totals in
/data/stats.db, checks the containers (through the read-only docker_status window), the host's load, memory and disk
and the certificate, and rewrites /page/index.html. Once an hour it reads GitHub's public numbers. Once a day the raw
log is emptied, so it never holds more than about a day.

Visitors are counted per site and day from a hash of the shortened address and the browser, with a secret salt that
changes every month: the hashes can't be turned back into addresses, and nothing links one month to the next. They
are kept 35 days, enough for the 30-day count; only daily totals are kept longer.

Countries come from DB-IP's free country database (CC BY 4.0), downloaded once a month and looked up here, so no
address leaves the box. Standard library only: the image is Python's own.
"""

import datetime as dt
import gzip
import hashlib
import html
import http.client
import ipaddress
import json
import os
import re
import secrets
import sqlite3
import ssl
import struct
import sys
import time
import urllib.parse
import urllib.request

LOG = "/logs/visits.log"
QUESTIONS = "/logs/questions.log"
DATA = "/data"
PAGE = "/page/index.html"
REPORTS = "/page/goaccess"  # written by the goaccess service (stats/goaccess.sh)
CERT = "/certs/live/degrand.is/fullchain.pem"
EVERY = int(os.environ.get("STATS_EVERY", "300"))
GITHUB_EVERY = 3600
IGNORE_SITES = set(os.environ.get("STATS_IGNORE_SITES", "").split())
DOCKER = os.environ.get("DOCKER_STATUS", "")
COMMIT = os.environ.get("DEPLOYED_COMMIT", "unknown")
PROJECT = os.environ.get("STATS_PROJECT", "docker")  # the compose project whose containers are shown (its folder name)
REPOS = os.environ.get(
    "STATS_GITHUB_REPOS",
    "DeGrandis/proof-of-basis DeGrandis/proof-of-basis-umbrel DeGrandis/proof-of-basis-startos",
).split()
# owner/repo/package, for GitHub's "Total downloads" of a container image (not in its API, so read from the page).
PACKAGES = os.environ.get(
    "STATS_GITHUB_PACKAGES",
    "DeGrandis/proof-of-basis/proof-of-basis DeGrandis/proof-of-basis/proof-of-basis-demo",
).split()
DEPLOY_REPO = "DeGrandis/sideproject"
# site=compose service for the games whose lobby_created / player_joined events (in their container logs) are counted.
GAMES = dict(g.split("=", 1) for g in os.environ.get(
    "STATS_GAMES", "trivia.degrand.is=trivia tomatotomato.degrand.is=tomatotomato").split())
QUESTIONS_SITE = "demo.proofofbasis.degrand.is"
BOTS = re.compile(r"bot|crawl|spider|slurp|preview|headless|monitor|curl|wget|python|go-http|scan", re.I)
KEEP_HASHES_DAYS = 35
KEEP_DETAIL_DAYS = 90
KEEP_LOBBIES_DAYS = 400
# A visitor's page loads counted per site and day. Past this it isn't a person browsing but a scanner walking paths
# (they send browser headers too); it still counts as one visitor.
MAX_LOADS = int(os.environ.get("STATS_MAX_LOADS", "20"))


def log(*args):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *args, flush=True)


def today():
    return dt.datetime.now(dt.timezone.utc).date()


# ---- Country lookup: a minimal reader for MaxMind-format databases (DB-IP's country file uses it) ----

class MMDB:
    def __init__(self, path):
        with open(path, "rb") as f:
            self.b = f.read()
        marker = self.b.rfind(b"\xab\xcd\xefMaxMind.com")
        if marker < 0:
            raise ValueError("not a MaxMind-format database")
        start = marker + 14
        meta, _ = self._decode(start, start)
        self.nodes = meta["node_count"]
        self.record = meta["record_size"]
        self.node_bytes = self.record * 2 // 8
        self.data = self.nodes * self.node_bytes + 16
        self.v4 = 0
        if meta["ip_version"] == 6:
            for _ in range(96):
                if self.v4 >= self.nodes:
                    break
                self.v4 = self._node(self.v4, 0)

    def _node(self, n, bit):
        b, base = self.b, n * self.node_bytes
        if self.record == 24:
            o = base + bit * 3
            return int.from_bytes(b[o:o + 3], "big")
        if self.record == 28:
            if bit == 0:
                return ((b[base + 3] & 0xF0) << 20) | int.from_bytes(b[base:base + 3], "big")
            return ((b[base + 3] & 0x0F) << 24) | int.from_bytes(b[base + 4:base + 7], "big")
        o = base + bit * 4
        return int.from_bytes(b[o:o + 4], "big")

    def _decode(self, off, base):
        b = self.b
        ctrl = b[off]
        off += 1
        kind = ctrl >> 5
        if kind == 1:  # pointer
            size, v = (ctrl >> 3) & 3, ctrl & 7
            if size == 0:
                p = (v << 8) | b[off]
            elif size == 1:
                p = ((v << 16) | int.from_bytes(b[off:off + 2], "big")) + 2048
            elif size == 2:
                p = ((v << 24) | int.from_bytes(b[off:off + 3], "big")) + 526336
            else:
                p = int.from_bytes(b[off:off + 4], "big")
            value, _ = self._decode(base + p, base)
            return value, off + size + 1
        if kind == 0:  # extended type
            kind = 7 + b[off]
            off += 1
        size = ctrl & 0x1F
        if size == 29:
            size, off = 29 + b[off], off + 1
        elif size == 30:
            size, off = 285 + int.from_bytes(b[off:off + 2], "big"), off + 2
        elif size == 31:
            size, off = 65821 + int.from_bytes(b[off:off + 3], "big"), off + 3
        if kind == 2:
            return b[off:off + size].decode("utf-8"), off + size
        if kind == 3:
            return struct.unpack(">d", b[off:off + 8])[0], off + 8
        if kind == 4:
            return b[off:off + size], off + size
        if kind in (5, 6, 9, 10):
            return int.from_bytes(b[off:off + size], "big"), off + size
        if kind == 7:
            out = {}
            for _ in range(size):
                k, off = self._decode(off, base)
                out[k], off = self._decode(off, base)
            return out, off
        if kind == 8:
            return int.from_bytes(b[off:off + size].rjust(4, b"\0"), "big", signed=True), off + size
        if kind == 11:
            out = []
            for _ in range(size):
                v, off = self._decode(off, base)
                out.append(v)
            return out, off
        if kind == 14:
            return size != 0, off
        if kind == 15:
            return struct.unpack(">f", b[off:off + 4])[0], off + 4
        raise ValueError(f"unknown data type {kind}")

    def lookup(self, ip):
        addr = ipaddress.ip_address(ip)
        packed = addr.packed
        node = self.v4 if addr.version == 4 else 0
        for i in range(len(packed) * 8):
            if node >= self.nodes:
                break
            node = self._node(node, (packed[i >> 3] >> (7 - (i & 7))) & 1)
        if node <= self.nodes:
            return None
        value, _ = self._decode(self.data + node - self.nodes - 16, self.data)
        return value


def country_db():
    """This month's DB-IP country database, or the newest one already here if the download fails."""
    month = time.strftime("%Y-%m", time.gmtime())
    path = f"{DATA}/dbip-country-{month}.mmdb"
    if not os.path.exists(path):
        try:
            url = f"https://download.db-ip.com/free/dbip-country-lite-{month}.mmdb.gz"
            req = urllib.request.Request(url, headers={"User-Agent": "degrand.is-stats"})  # it refuses Python's default
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = gzip.decompress(r.read())
            with open(path + ".tmp", "wb") as f:
                f.write(raw)
            os.replace(path + ".tmp", path)
            for name in os.listdir(DATA):
                if name.startswith("dbip-country-") and name != os.path.basename(path):
                    os.remove(f"{DATA}/{name}")
            log("downloaded", os.path.basename(path))
        except Exception as e:  # keep the old one
            log("country database download failed:", e)
    have = sorted(n for n in os.listdir(DATA) if n.startswith("dbip-country-") and n.endswith(".mmdb"))
    return MMDB(f"{DATA}/{have[-1]}") if have else None


# ---- Running totals ----

def open_db():
    db = sqlite3.connect(f"{DATA}/stats.db")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS daily (site TEXT, day TEXT, loads INT DEFAULT 0, visitors INT DEFAULT 0,
            phones INT DEFAULT 0, errors INT DEFAULT 0, asks INT DEFAULT 0, resets INT DEFAULT 0,
            PRIMARY KEY (site, day));
        CREATE TABLE IF NOT EXISTS seen (site TEXT, day TEXT, hash TEXT, PRIMARY KEY (site, day, hash));
        CREATE TABLE IF NOT EXISTS detail (site TEXT, day TEXT, kind TEXT, name TEXT, n INT,
            PRIMARY KEY (site, day, kind, name));
        CREATE TABLE IF NOT EXISTS questions (day TEXT, time TEXT, text TEXT, page TEXT, lang TEXT, status TEXT);
        CREATE TABLE IF NOT EXISTS lobbies (site TEXT, id TEXT, day TEXT, time TEXT, name TEXT, theme TEXT,
            difficulty TEXT, players INT DEFAULT 1, PRIMARY KEY (site, id));
    """)
    try:
        db.execute("ALTER TABLE seen ADD COLUMN n INT DEFAULT 0")  # page loads per visitor, for MAX_LOADS
    except sqlite3.OperationalError:
        pass  # already there
    return db


def state(db, key, default=None):
    row = db.execute("SELECT value FROM state WHERE key = ?", (key,)).fetchone()
    return row[0] if row else default


def set_state(db, key, value):
    db.execute("INSERT OR REPLACE INTO state VALUES (?, ?)", (key, str(value)))


def salt(db):
    month = time.strftime("%Y-%m", time.gmtime())
    if state(db, "salt_month") != month:
        set_state(db, "salt", secrets.token_hex(16))
        set_state(db, "salt_month", month)
    return state(db, "salt")


def bump(db, site, day, **counts):
    db.execute("INSERT OR IGNORE INTO daily (site, day) VALUES (?, ?)", (site, day))
    for col, n in counts.items():
        db.execute(f"UPDATE daily SET {col} = {col} + ? WHERE site = ? AND day = ?", (n, site, day))


def bump_detail(db, site, day, kind, name):
    db.execute("INSERT INTO detail VALUES (?, ?, ?, ?, 1) ON CONFLICT DO UPDATE SET n = n + 1",
               (site, day, kind, name))


def tail(db, path):
    """The log's complete lines added since the last read; the read position is saved with the next commit."""
    if not os.path.exists(path):
        return []
    size = os.path.getsize(path)
    offset = int(state(db, f"offset:{path}", "0"))
    if size < offset:  # emptied since
        offset = 0
    with open(path, "rb") as f:
        f.seek(offset)
        chunk = f.read(size - offset)
    end = chunk.rfind(b"\n") + 1
    set_state(db, f"offset:{path}", offset + end)
    return chunk[:end].decode("utf-8", "replace").splitlines()


def empty_daily(db):
    """Once a day, right after reading, empty the raw logs (whatever was written in between is lost: milliseconds)."""
    if state(db, "emptied") == str(today()):
        return
    for path in (LOG, QUESTIONS):
        if os.path.exists(path) and os.path.getsize(path) == int(state(db, f"offset:{path}", "0")):
            with open(path, "r+b") as f:
                f.truncate(0)
            set_state(db, f"offset:{path}", 0)
    set_state(db, "emptied", today())
    db.commit()


def read_questions(db):
    """Adds the demo's new assistant questions (their text, page and language) from nginx's questions log."""
    for line in tail(db, QUESTIONS):
        try:
            entry = json.loads(line)
            body = json.loads(entry.get("body") or "{}")
        except ValueError:
            continue
        text = str(body.get("content") or "").strip()
        if not text:
            continue
        page = body.get("page") or {}
        when = entry.get("time", "")
        db.execute("INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?)",
                   (when[:10], when[11:16], text[:2000], str(page.get("hash") or "")[:60],
                    str(page.get("lang") or "")[:8], str(entry.get("status", ""))))
    db.execute("DELETE FROM questions WHERE day < ?", (str(today() - dt.timedelta(days=KEEP_DETAIL_DAYS)),))
    db.commit()


def docker_logs(container, since):
    """A container's log lines since a Unix time, as (timestamp, text), through docker_status."""
    host, port = DOCKER.rsplit(":", 1)
    c = http.client.HTTPConnection(host, int(port), timeout=20)
    c.request("GET", f"/containers/{container}/logs?stdout=1&stderr=1&timestamps=1&since={since}")
    r = c.getresponse()
    raw = r.read()
    if r.status != 200:
        raise RuntimeError(f"logs: {r.status}")
    chunks, i = [], 0
    while i + 8 <= len(raw):  # Docker's stream format: an 8-byte header (stream, 0, 0, 0, size) before each chunk
        n = int.from_bytes(raw[i + 4:i + 8], "big")
        chunks.append(raw[i + 8:i + 8 + n])
        i += 8 + n
    out = []
    for line in b"".join(chunks).decode("utf-8", "replace").splitlines():
        ts, _, text = line.partition(" ")
        out.append((ts, text))
    return out


def ts_key(ts):
    """Docker's RFC 3339 timestamps (it trims the fraction's trailing zeros), made comparable as strings."""
    base, _, frac = ts.rstrip("Z").partition(".")
    return f"{base}.{(frac + '000000000')[:9]}"


def read_games(db):
    """Adds the games' new lobby_created and player_joined events from their container logs. Docker keeps a
    container's log only until it's recreated (every deploy), so events are collected as they happen."""
    for site, service in GAMES.items():
        try:
            only = urllib.parse.quote(json.dumps({"label": [f"com.docker.compose.project={PROJECT}",
                                                            f"com.docker.compose.service={service}"]}))
            found = docker_get(f"/containers/json?filters={only}")
            if not found:
                continue
            cid = found[0]["Id"]
            last = state(db, f"game:{service}:last", "") if state(db, f"game:{service}:cid") == cid else ""
            since = 0
            if last:
                since = int(dt.datetime.fromisoformat(last[:19]).replace(tzinfo=dt.timezone.utc).timestamp())
            for ts, text in docker_logs(cid, since):
                key = ts_key(ts)
                if key <= last:
                    continue
                last = key
                if not text.startswith("{"):
                    continue
                try:
                    e = json.loads(text)
                except ValueError:
                    continue
                if e.get("event") == "lobby_created":
                    db.execute("INSERT OR IGNORE INTO lobbies (site, id, day, time, name, theme, difficulty) "
                               "VALUES (?, ?, ?, ?, ?, ?, ?)",
                               (site, str(e.get("lobbyId")), ts[:10], ts[11:16], str(e.get("lobbyName") or "")[:80],
                                str(e.get("theme") or "")[:80], str(e.get("difficulty") or "")[:20]))
                elif e.get("event") == "player_joined":
                    db.execute("UPDATE lobbies SET players = players + 1 WHERE site = ? AND id = ?",
                               (site, str(e.get("lobbyId"))))
            set_state(db, f"game:{service}:cid", cid)
            set_state(db, f"game:{service}:last", last)
        except Exception as e:
            log("game", service, e)
    db.execute("DELETE FROM lobbies WHERE day < ?", (str(today() - dt.timedelta(days=KEEP_LOBBIES_DAYS)),))
    db.commit()


def read_log(db, geo):
    """Adds the visit log's new lines to the totals; returns how many lines were read."""
    lines = tail(db, LOG)
    key = salt(db)
    touched = set()
    for line in lines:
        parts = line.split("\t")
        if len(parts) != 9:
            continue
        ip, when, site, method, path, status, kind, ref, agent = parts
        if site in IGNORE_SITES or site.startswith("~") or site in ("", "_"):
            continue
        day = when[:10]
        code = int(status) if status.isdigit() else 0
        if code >= 500:
            bump(db, site, day, errors=1)
        if kind == "ask":
            bump(db, site, day, asks=1)
        elif kind == "reset":
            bump(db, site, day, resets=1)
        elif kind == "page" and (200 <= code < 300 or code == 304) and not BOTS.search(agent):
            h = hashlib.sha256(f"{key}|{ip}|{agent}".encode()).hexdigest()[:20]
            db.execute("INSERT INTO seen (site, day, hash, n) VALUES (?, ?, ?, 1) "
                       "ON CONFLICT DO UPDATE SET n = n + 1", (site, day, h))
            touched.add((site, day))
            if db.execute("SELECT n FROM seen WHERE site = ? AND day = ? AND hash = ?",
                          (site, day, h)).fetchone()[0] > MAX_LOADS:
                continue
            bump(db, site, day, loads=1, phones=1 if "Mobi" in agent else 0)
            bump_detail(db, site, day, "page", path[:120])
            host = urllib.parse.urlsplit(ref).hostname if ref not in ("", "-") else None
            if host:
                host = host.removeprefix("www.")
                if host != site.removeprefix("www.") and not host.endswith(".degrand.is") and host != "degrand.is":
                    bump_detail(db, site, day, "from", host)
            elif ref in ("", "-"):
                bump_detail(db, site, day, "from", "(direct)")
            if geo:
                try:
                    hit = geo.lookup(ip) or {}
                    name = (hit.get("country") or {}).get("names", {}).get("en")
                    bump_detail(db, site, day, "country", name or "Unknown")
                except ValueError:
                    pass
    for site, day in touched:
        n = db.execute("SELECT count(*) FROM seen WHERE site = ? AND day = ?", (site, day)).fetchone()[0]
        db.execute("UPDATE daily SET visitors = ? WHERE site = ? AND day = ?", (n, site, day))
    oldest_hash = str(today() - dt.timedelta(days=KEEP_HASHES_DAYS))
    oldest_detail = str(today() - dt.timedelta(days=KEEP_DETAIL_DAYS))
    db.execute("DELETE FROM seen WHERE day < ?", (oldest_hash,))
    db.execute("DELETE FROM detail WHERE day < ?", (oldest_detail,))
    db.commit()
    return len(lines)


# ---- The box ----

def docker_get(path):
    host, port = DOCKER.rsplit(":", 1)
    c = http.client.HTTPConnection(host, int(port), timeout=10)
    c.request("GET", path)
    r = c.getresponse()
    body = r.read()
    if r.status != 200:
        raise RuntimeError(f"{path}: {r.status}")
    return json.loads(body)


def containers():
    out = []
    only = urllib.parse.quote(json.dumps({"label": [f"com.docker.compose.project={PROJECT}"]}))
    for c in docker_get(f"/containers/json?all=1&filters={only}"):
        labels = c.get("Labels") or {}
        if labels.get("com.docker.compose.oneoff") == "True":
            continue
        info = docker_get(f"/containers/{c['Id']}/json")
        st = info.get("State") or {}
        out.append({
            "name": labels.get("com.docker.compose.service") or c["Names"][0].lstrip("/"),
            "state": st.get("Status", c.get("State")),
            "health": (st.get("Health") or {}).get("Status"),
            "restarts": info.get("RestartCount", 0),
            "started": st.get("StartedAt", "")[:19].replace("T", " "),
        })
    return sorted(out, key=lambda c: c["name"])


def host():
    out = {"cpus": os.cpu_count()}
    with open("/proc/loadavg") as f:
        out["load"] = [float(x) for x in f.read().split()[:3]]
    mem = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, v = line.split(":")
            mem[k] = int(v.split()[0]) * 1024
    out["mem_total"], out["mem_used"] = mem["MemTotal"], mem["MemTotal"] - mem["MemAvailable"]
    fs = os.statvfs("/")
    out["disk_total"], out["disk_free"] = fs.f_blocks * fs.f_frsize, fs.f_bavail * fs.f_frsize
    return out


def cert_days():
    info = ssl._ssl._test_decode_cert(CERT)  # standard library; reads the first certificate in the file
    return (ssl.cert_time_to_seconds(info["notAfter"]) - time.time()) / 86400


# ---- GitHub ----

def fetch(url, accept="application/vnd.github+json"):
    req = urllib.request.Request(url, headers={"User-Agent": "degrand.is-stats", "Accept": accept})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8")


def github():
    out = {"repos": [], "packages": [], "at": time.strftime("%Y-%m-%d %H:%M", time.gmtime())}
    for repo in REPOS:
        try:
            r = json.loads(fetch(f"https://api.github.com/repos/{repo}"))
            rel = json.loads(fetch(f"https://api.github.com/repos/{repo}/releases?per_page=100"))
            out["repos"].append({
                "name": repo, "stars": r.get("stargazers_count", 0), "forks": r.get("forks_count", 0),
                "issues": r.get("open_issues_count", 0),
                "latest": rel[0]["tag_name"] if rel else None,
                "downloads": sum(a.get("download_count", 0) for x in rel for a in x.get("assets", [])),
            })
        except Exception as e:
            log("github", repo, e)
    for pkg in PACKAGES:
        owner, repo, name = pkg.split("/")
        try:
            page = fetch(f"https://github.com/{owner}/{repo}/pkgs/container/{name}", "text/html")
            m = re.search(r'Total downloads</span>\s*<h3 title="([\d,]+)"', page)
            out["packages"].append({"name": name, "downloads": int(m.group(1).replace(",", "")) if m else None})
        except Exception as e:
            log("github package", pkg, e)
    return out


# ---- The page ----

def esc(v):
    return html.escape(str(v))


def num(n):
    return f"{n:,}"


def size(n):
    return f"{n / 1e9:.1f} GB"


def spark(values):
    w, h = 120, 28
    top = max(values) or 1
    pts = [(i * w / (len(values) - 1), h - 2 - (v / top) * (h - 4)) for i, v in enumerate(values)]
    line = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return (f'<svg class="spark" viewBox="0 0 {w} {h}" width="{w}" height="{h}" aria-hidden="true">'
            f'<polygon points="0,{h} {line} {w},{h}" class="area"/><polyline points="{line}" class="line"/></svg>')


def sites(db):
    t = today()
    days30 = [str(t - dt.timedelta(days=i)) for i in range(29, -1, -1)]
    since7, since30 = days30[-7], days30[0]
    out = []
    for (site,) in db.execute("SELECT DISTINCT site FROM daily WHERE day >= ?", (since30,)):
        rows = {d: r for d, *r in db.execute(
            "SELECT day, loads, visitors, phones, errors, asks, resets FROM daily WHERE site = ? AND day >= ?",
            (site, since30))}
        def total(col, since):
            return sum(r[col] for d, r in rows.items() if d >= since)
        def uniq(since):
            return db.execute("SELECT count(DISTINCT hash) FROM seen WHERE site = ? AND day >= ?",
                              (site, since)).fetchone()[0]
        def top(kind, n=6):
            return db.execute("SELECT name, sum(n) s FROM detail WHERE site = ? AND kind = ? AND day >= ? "
                              "GROUP BY name ORDER BY s DESC LIMIT ?", (site, kind, since30, n)).fetchall()
        loads7 = total(0, since7)
        out.append({
            "site": site, "today": uniq(str(t)), "week": uniq(since7), "month": uniq(since30),
            "loads7": loads7, "phones7": total(2, since7), "errors7": total(3, since7),
            "errors_today": rows.get(str(t), [0] * 6)[3],
            "asks": (total(4, str(t)), total(4, since7), total(4, since30)), "resets7": total(5, since7),
            "trend": [rows[d][1] if d in rows else 0 for d in days30],
            "countries": top("country"), "from": top("from"), "pages": top("page"),
        })
    return sorted(out, key=lambda s: (-s["month"], s["site"]))


def card(label, value, note="", cls=""):
    return (f'<div class="card {cls}"><div class="label">{esc(label)}</div><div class="value">{value}</div>'
            f'<div class="note">{note}</div></div>')


def render(db, box, gh):
    now = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())
    parts = []

    # The box
    cards = []
    cs = box.get("containers")
    if cs is None:
        cards.append(card("Containers", "?", "couldn't reach docker_status", "warn"))
    else:
        bad = [c for c in cs if c["state"] != "running" or c["health"] == "unhealthy"]
        chips = "".join(
            f'<span class="chip {"bad" if c in bad else ""}" title="{esc(c["state"])}, up since {esc(c["started"])} UTC">'
            f'{esc(c["name"])}{f" <b>{c["restarts"]}↻</b>" if c["restarts"] else ""}</span>' for c in cs)
        cards.append(card("Containers", f'{len(cs) - len(bad)} of {len(cs)} running', chips, "wide bad" if bad else "wide"))
    h = box.get("host")
    if h:
        load = h["load"][0]
        cards.append(card("Load", f'{load:.2f}', f'{h["cpus"]} CPU{"s" if h["cpus"] != 1 else ""} · 5 min {h["load"][1]:.2f} · 15 min {h["load"][2]:.2f}',
                          "warn" if load > h["cpus"] else ""))
        used = h["mem_used"] / h["mem_total"]
        cards.append(card("Memory", f'{used:.0%}', f'{size(h["mem_used"])} of {size(h["mem_total"])} used', "warn" if used > .9 else ""))
        free = h["disk_free"] / h["disk_total"]
        cards.append(card("Disk", f'{size(h["disk_free"])} free', f'of {size(h["disk_total"])}', "warn" if free < .1 else ""))
    days = box.get("cert_days")
    if days is not None:
        left = int(days)
        cards.append(card("Certificate", f'{left} day{"" if left == 1 else "s"}', "left on *.degrand.is", "warn" if days < 21 else ""))
    short = COMMIT[:7]
    commit = (f'<a href="https://github.com/{DEPLOY_REPO}/commit/{esc(COMMIT)}">{esc(short)}</a>'
              if re.fullmatch(r"[0-9a-f]{40}", COMMIT) else esc(short))
    cards.append(card("Deployed", commit, "sideproject master"))
    parts.append(f'<section><h2>The box</h2><div class="cards">{"".join(cards)}</div></section>')

    # Sites
    rows, details = [], []
    for s in sites(db):
        phones = f'{s["phones7"] / s["loads7"]:.0%}' if s["loads7"] else "–"
        err = f'<span class="{"bad" if s["errors_today"] else ""}">{num(s["errors7"])}</span>'
        rows.append(f'<tr><td><a href="#{esc(s["site"])}">{esc(s["site"])}</a></td><td>{num(s["today"])}</td>'
                    f'<td>{num(s["week"])}</td><td>{num(s["month"])}</td><td>{num(s["loads7"])}</td><td>{phones}</td>'
                    f'<td>{err}</td><td>{spark(s["trend"])}</td></tr>')
        def lst(title, items):
            if not items:
                return f'<div><h4>{title}</h4><p class="muted">Nothing yet.</p></div>'
            return (f'<div><h4>{title}</h4><ol>' + "".join(
                f'<li><span>{esc(n)}</span><b>{num(c)}</b></li>' for n, c in items) + "</ol></div>")
        extra = ""
        if any(s["asks"]) or s["resets7"]:
            a = s["asks"]
            extra = (f'<p class="muted">Assistant questions: {num(a[0])} today, {num(a[1])} in 7 days, '
                     f'{num(a[2])} in 30 days. Start over: {num(s["resets7"])} in 7 days.</p>')
        details.append(f'<details id="{esc(s["site"])}"><summary>{esc(s["site"])}</summary>{extra}<div class="lists">'
                       f'{lst("Countries", s["countries"])}{lst("Came from", s["from"])}{lst("Pages", s["pages"])}'
                       f'</div><p class="muted">Last 30 days.</p></details>')
    table = ("<table><thead><tr><th>Site</th><th>Today</th><th>7 days</th><th>30 days</th><th>Page loads, 7 d</th>"
             "<th>On phones</th><th>Errors, 7 d</th><th>Visitors, 30 d</th></tr></thead><tbody>"
             + ("".join(rows) or '<tr><td colspan="8" class="muted">No visits counted yet.</td></tr>')
             + "</tbody></table>")
    parts.append(f'<section><h2>Sites</h2><p class="muted">Visitors: each shortened address and browser once '
                 f'(today, or across the period). Refreshes count as page loads, not visitors. Errors are server '
                 f'errors (5xx).</p><div class="scroll">{table}</div>{"".join(details)}</section>')

    # Games and the demo's assistant
    t = today()
    since7, since30 = str(t - dt.timedelta(days=6)), str(t - dt.timedelta(days=29))
    blocks = []
    for site in GAMES:
        def lobbies(since):
            return db.execute("SELECT count(*), coalesce(sum(players), 0) FROM lobbies WHERE site = ? AND day >= ?",
                              (site, since)).fetchone()
        (l1, p1), (l7, p7), (l30, p30) = lobbies(str(t)), lobbies(since7), lobbies(since30)
        recent = db.execute("SELECT day, time, name, theme, difficulty, players FROM lobbies WHERE site = ? "
                            "ORDER BY day DESC, time DESC LIMIT 10", (site,)).fetchall()
        rows = "".join(f'<tr><td>{esc(d)} {esc(tm)}</td><td>{esc(n)}</td><td>{esc(th)}</td><td>{esc(df)}</td>'
                       f'<td>{num(pl)}</td></tr>' for d, tm, n, th, df, pl in recent)
        avg = f"{p30 / l30:.1f}" if l30 else "–"
        blocks.append(
            f'<div class="game"><h3>{esc(site)}</h3><div class="cards">'
            f'{card("Lobbies", num(l1), f"today · {num(l7)} in 7 days · {num(l30)} in 30 days")}'
            f'{card("Players", num(p1), f"today · {num(p7)} in 7 days · {num(p30)} in 30 days")}'
            f'{card("Per lobby", avg, "players on average, 30 days")}</div>'
            + (f'<div class="scroll"><table class="left"><thead><tr><th>Created (UTC)</th><th>Lobby</th><th>Theme</th>'
               f'<th>Difficulty</th><th>Players</th></tr></thead><tbody>{rows}</tbody></table></div>' if rows
               else '<p class="muted">No lobbies yet.</p>') + "</div>")
    q = [db.execute("SELECT count(*) FROM questions WHERE day >= ?", (d,)).fetchone()[0] for d in (str(t), since7, since30)]
    recent = db.execute("SELECT day, time, text, page, lang, status FROM questions ORDER BY rowid DESC LIMIT 50").fetchall()
    rows = "".join(
        f'<tr><td>{esc(d)} {esc(tm)}</td><td class="q">{esc(tx)}</td><td>{esc(pg or "–")}</td><td>{esc(lg or "–")}</td>'
        f'<td class="{"" if st == "200" else "bad"}">{esc(st)}</td></tr>' for d, tm, tx, pg, lg, st in recent)
    blocks.append(
        f'<div class="game"><h3>{esc(QUESTIONS_SITE)}: assistant questions</h3><div class="cards">'
        f'{card("Questions", num(q[0]), f"today · {num(q[1])} in 7 days · {num(q[2])} in 30 days")}</div>'
        + (f'<div class="scroll"><table class="left"><thead><tr><th>Asked (UTC)</th><th>Question</th><th>Page</th>'
           f'<th>Language</th><th>Status</th></tr></thead><tbody>{rows}</tbody></table></div>'
           f'<p class="muted">The last 50; questions are kept {KEEP_DETAIL_DAYS} days.</p>' if rows
           else '<p class="muted">No questions yet.</p>') + "</div>")
    parts.append(f'<section><h2>Games and the demo</h2><p class="muted">Lobbies and players from the games\' own '
                 f'logs (a lobby\'s players: its creator plus everyone who joined); questions from nginx.</p>'
                 f'{"".join(blocks)}</section>')

    # GitHub
    if gh:
        repo_rows = "".join(
            f'<tr><td><a href="https://github.com/{esc(r["name"])}">{esc(r["name"].split("/")[1])}</a></td>'
            f'<td>{num(r["stars"])}</td><td>{num(r["forks"])}</td><td>{num(r["issues"])}</td>'
            f'<td>{esc(r["latest"] or "–")}</td><td>{num(r["downloads"])}</td></tr>' for r in gh["repos"])
        pkg = " · ".join(f'<b>{esc(p["name"])}</b> {num(p["downloads"]) if p["downloads"] is not None else "?"}'
                         for p in gh["packages"])
        parts.append(f'<section><h2>GitHub</h2><div class="scroll"><table><thead><tr><th>Repository</th><th>Stars</th>'
                     f'<th>Forks</th><th>Open issues</th><th>Latest release</th><th>Release downloads</th></tr></thead>'
                     f'<tbody>{repo_rows}</tbody></table></div><p>Image downloads (all time): {pkg}</p>'
                     f'<p class="muted">Read {esc(gh["at"])} UTC.</p></section>')

    # The goaccess service's detailed report for each site
    reports = sorted(n for n in os.listdir(REPORTS) if n.endswith(".html")) if os.path.isdir(REPORTS) else []
    if reports:
        links = "".join(f'<li><a href="goaccess/{urllib.parse.quote(n)}">{esc(n[:-5])}</a></li>' for n in reports)
        parts.append(f'<section><h2>Detailed reports</h2><p class="muted">GoAccess\'s full report for each site: '
                     f'every panel, from the same page loads, kept 400 days.</p><ul class="reports">{links}</ul></section>')

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="300">
<title>degrand.is stats</title>
<style>
:root{{--bg:#0b0b0a;--bg2:#121210;--fg:#f3f2ea;--muted:#9b998f;--line:rgba(255,255,255,.09);--accent:#b9f04a;--bad:#ff6b5e;--warn:#f5c04a}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}}
main{{max-width:1160px;margin:0 auto;padding:32px 16px 60px}}a{{color:var(--accent);text-decoration:none}}a:hover{{text-decoration:underline}}
h1{{font-size:28px;margin:0}}h2{{font-size:20px;margin:0 0 14px}}h4{{margin:0 0 8px;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}}
header{{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:28px}}
section{{margin:0 0 40px}}.muted{{color:var(--muted);font-size:13px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}}
.card{{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:14px 16px}}.card.wide{{grid-column:1/-1}}
.card .label{{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}}.card .value{{font-size:24px;font-weight:700;margin:2px 0}}
.card .note{{color:var(--muted);font-size:13px}}.card.warn{{border-color:var(--warn)}}.card.bad{{border-color:var(--bad)}}
.chip{{display:inline-block;margin:6px 6px 0 0;padding:2px 9px;border-radius:999px;border:1px solid var(--line);color:var(--fg);font-size:12px}}
.chip::before{{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:6px}}
.chip.bad{{border-color:var(--bad)}}.chip.bad::before{{background:var(--bad)}}.chip b{{color:var(--warn);font-weight:600}}
.scroll{{overflow-x:auto}}table{{width:100%;border-collapse:collapse;min-width:640px}}
th,td{{text-align:right;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}}th:first-child,td:first-child{{text-align:left}}
th{{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em}}
.bad{{color:var(--bad)}}.spark .line{{fill:none;stroke:var(--accent);stroke-width:1.5}}.spark .area{{fill:rgba(185,240,74,.12)}}
details{{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin-top:10px}}
summary{{cursor:pointer;font-weight:600}}.lists{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:12px}}
ol{{list-style:none;margin:0;padding:0}}li{{display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid var(--line)}}
li span{{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}footer{{color:var(--muted);font-size:12px}}
h3{{font-size:16px;margin:0 0 10px}}.game{{margin:0 0 26px}}.game .cards{{margin-bottom:12px}}
table.left td,table.left th{{text-align:left}}.reports{{columns:2 220px;padding-left:18px}}.reports li{{display:list-item;border:0;margin:4px 0}}td.q{{white-space:normal;min-width:280px;max-width:560px}}
</style></head><body><main>
<header><h1>degrand.is stats</h1><span class="muted">Updated {now}, every 5 minutes · days are UTC</span></header>
{"".join(parts)}
<footer>Counted from nginx's logs: no cookies or scripts on the sites, and addresses are shortened before they're
written. Countries by <a href="https://db-ip.com">DB-IP</a> (CC BY 4.0).</footer>
</main></body></html>
"""
    tmp = PAGE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(page)
    os.replace(tmp, PAGE)


def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(os.path.dirname(PAGE), exist_ok=True)
    db = open_db()
    gh, gh_at, geo, geo_month = None, 0, None, None
    try:
        gh = json.loads(state(db, "github", "null"))
    except ValueError:
        pass
    while True:
        try:
            month = time.strftime("%Y-%m", time.gmtime())
            if geo_month != month:
                geo, geo_month = country_db(), month
            n = read_log(db, geo)
            read_questions(db)
            if DOCKER:
                read_games(db)
            empty_daily(db)
            box = {}
            try:
                box["containers"] = containers() if DOCKER else None
            except Exception as e:
                log("containers:", e)
            try:
                box["host"] = host()
            except Exception as e:
                log("host:", e)
            try:
                box["cert_days"] = cert_days()
            except Exception as e:
                log("certificate:", e)
            if time.time() - gh_at > GITHUB_EVERY:
                gh_at = time.time()
                fresh = github()
                if fresh["repos"] or fresh["packages"]:
                    gh = fresh
                    set_state(db, "github", json.dumps(gh))
                    db.commit()
            render(db, box, gh)
            log(f"read {n} lines, page written")
        except Exception as e:
            log("run failed:", repr(e))
        time.sleep(EVERY)


if __name__ == "__main__":
    sys.exit(main())
