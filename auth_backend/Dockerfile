# Build the Python packages (psycopg2 compiles against Postgres's libraries)
# in the full image, then install them into the slim one, which only needs
# Postgres's runtime library. Same app, a fraction of the size on disk.
FROM python:3.13-bookworm AS build
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir --no-index /wheels/* && rm -rf /wheels
COPY . ./auth_backend
EXPOSE 8000
CMD ["uvicorn", "auth_backend.auth_service:app", "--host", "0.0.0.0", "--port", "8000"]

#docker build -t auth_backend .
#docker run -p 8000:8000 auth_backend
