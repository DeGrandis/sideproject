FROM python:3.13-bookworm

# Set the working directory
WORKDIR /app

# Copy requirements.txt
COPY requirements.txt .
# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . ./auth_backend    

# List files for debugging
RUN ls -la

# Expose the port the app runs on
EXPOSE 8000

# Start the application
# Example Dockerfile snippet
CMD ["uvicorn", "auth_backend.auth_service:app", "--host", "0.0.0.0", "--port", "8000"]

#docker build -t auth_backend .
#docker run -p 8000:8000 auth_backend