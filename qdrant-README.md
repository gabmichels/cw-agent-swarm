# Qdrant Vector Database Setup

This README provides instructions for setting up and running Qdrant vector database using Docker.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed on your system
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

## Setup Instructions

### Running Qdrant using Docker Compose

1. Start the Qdrant container:
   ```bash
   docker-compose -f docker-compose-qdrant.yml up -d
   ```

2. The Qdrant service will be accessible at:
   - REST API: http://localhost:6333
   - gRPC API: http://localhost:6334
   - Dashboard (if available): http://localhost:6333/dashboard

3. To stop Qdrant:
   ```bash
   docker-compose -f docker-compose-qdrant.yml down
   ```

### Data Persistence

The Docker Compose setup includes a volume mount (`qdrant_data:/qdrant/storage`) to ensure that your vector database data persists between container restarts.

## Configuration

The application is pre-configured to connect to Qdrant at `http://localhost:6333`. This is set in the environment configuration and will be used by the application automatically.

## Troubleshooting

- **Connection Issues**: Ensure Docker is running and the container is healthy:
  ```bash
  docker ps
  ```

- **Port Conflicts**: If ports 6333 or 6334 are already in use, modify the port mappings in `docker-compose-qdrant.yml`

- **Data Reset**: If you need to completely reset the database:
  ```bash
  docker-compose -f docker-compose-qdrant.yml down -v
  docker-compose -f docker-compose-qdrant.yml up -d
  ```

## Environment Variables

The application uses the following environment variables for Qdrant:
- `QDRANT_URL` - Set to `http://localhost:6333` by default
- `QDRANT_API_KEY` - Only needed if authentication is enabled 