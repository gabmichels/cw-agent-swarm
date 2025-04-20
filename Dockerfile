FROM python:3.9-slim

WORKDIR /app

# Copy requirements file
COPY requirements.txt requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project
COPY . .

# Set environment variable for API key (can be overridden at runtime)
ENV OPENROUTER_API_KEY=""

# Set PYTHONPATH to recognize the app modules
ENV PYTHONPATH=/app

# Create directories for agent memory if they don't exist
RUN mkdir -p /app/shared/agent_core/memory/chat_history
RUN mkdir -p /app/shared/agent_core/memory/reflections

# Expose Streamlit's default port
EXPOSE 8501

# Run Streamlit app
CMD ["streamlit", "run", "hq_app.py", "--server.address=0.0.0.0"] 
 