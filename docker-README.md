# Crowd Wisdom HQ - Dockerized Streamlit App

This README provides instructions for running the Crowd Wisdom HQ application using Docker.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed on your system
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

## Getting Started

### Option 1: Using Docker Compose (Recommended)

1. Make sure your `.env` file is in place at `apps/hq-ui/.env` with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

2. Run the application using Docker Compose:
   ```bash
   docker-compose up
   ```

3. Access the application in your web browser at: [http://localhost:8501](http://localhost:8501)

4. To stop the application, press `Ctrl+C` in the terminal where it's running, or run:
   ```bash
   docker-compose down
   ```

### Option 2: Using Docker Directly

1. Build the Docker image:
   ```bash
   docker build -t crowd-wisdom-app .
   ```

2. Run the container:
   ```bash
   docker run -p 8501:8501 -e OPENAI_API_KEY="your_api_key_here" crowd-wisdom-app
   ```

3. Access the application in your web browser at: [http://localhost:8501](http://localhost:8501)

## Persistent Data

The Docker Compose setup includes a volume mount for `./apps/hq-ui/history:/app/apps/hq-ui/history` to ensure that chat history persists between container restarts.

## Troubleshooting

- **API Key Issues**: If you see authentication errors, verify your OpenAI API key is correct
- **Port Conflicts**: If port 8501 is already in use, modify the port mapping in `docker-compose.yml` (e.g., change to `"8502:8501"`)
- **Container Exits**: Check Docker logs for error messages:
  ```bash
  docker logs crowd-wisdom-employees-crowd-wisdom-app-1
  ``` 
 