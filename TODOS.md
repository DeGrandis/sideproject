# TODO List

## SSL/TLS Certificate - Production Setup

**⏰ Action Required: January 18, 2026 at 12:06 UTC or later**

### Steps to Get Production Certificate

1. **SSH into EC2**
   ```bash
   ssh ec2-user@YOUR_EC2_IP
   cd /home/ec2-user/docker
   ```

2. **Remove staging certificates**
   ```bash
   sudo rm -rf ./certbot/conf/live/degrand.is*
   sudo rm -rf ./certbot/conf/archive/degrand.is*
   sudo rm -rf ./certbot/conf/renewal/degrand.is*
   ```
   
   **⚠️ Verify removal:** Run `ls -la ./certbot/conf/live/` and `ls -la ./certbot/conf/archive/` to confirm files are gone.
   
   If files still exist, nuke the entire directories:
   ```bash
   sudo rm -rf ./certbot/conf/live/
   sudo rm -rf ./certbot/conf/archive/
   sudo rm -rf ./certbot/conf/renewal/
   ```

3. **Edit init-letsencrypt.sh**
   - Change line 12 from: `staging=1`
   - To: `staging=0`

4. **Run the script**
   ```bash
   sudo ./init-letsencrypt.sh
   ```

5. **Verify production certificate**
   ```bash
   # Check certificate is valid and trusted
   docker-compose run --rm certbot certificates
   
   # Test in browser - should show 🔒 with no warnings
   # Visit: https://degrand.is
   ```

### Why Wait?

Hit Let's Encrypt rate limit (5 certificates per 7 days for same domain set). The rate limit resets on January 18, 2026 at 12:06:03 UTC.

### What's Currently Running?

- ✅ Staging certificate installed (works but shows browser warning)
- ✅ All services running with HTTPS
- ✅ Automatic renewal configured
- ⏳ Waiting for production certificate

---

## Future Tasks

- [ ] Monitor certificate expiration dates monthly
- [ ] Review nginx logs periodically for errors
- [ ] Test adding a new subdomain to verify wildcard cert works
- [ ] Document any custom configurations or changes
