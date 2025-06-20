FROM python:3.13-slim

# Set the working directory
WORKDIR /backend

# Copy requirements.txt
COPY requirements.txt .
# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .    

# Expose the port the app runs on
EXPOSE 8000

# Start the application
# Example Dockerfile snippet
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]