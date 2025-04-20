# Docker Setup Instructions

This document provides instructions for setting up and running the agent system using Docker.

## Prerequisites

- Docker and Docker Compose installed on your system
- Git (for cloning the repository)
- An OpenRouter API key

## Environment Setup

1. Create a `.env` file in the project root with the following contents:

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

2. Replace `your_openrouter_api_key_here` with your actual OpenRouter API key.

## Building and Running with Docker

1. Build the Docker image:

```bash
docker-compose build
```

2. Run the container:

```bash
docker-compose up
```

This will start the agent system in an interactive mode.

## Testing

To run the test suite within Docker:

```bash
docker-compose run agent python -m unittest discover
```

## Development with Docker

For development, you can mount your local code directory to see changes in real-time:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
``` 