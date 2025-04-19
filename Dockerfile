FROM python:3.9-slim

WORKDIR /app

# Copy requirements files
COPY apps/agents/requirements.txt requirements-agents.txt

# Install dependencies from both requirements files
RUN pip install --no-cache-dir -r requirements-agents.txt
RUN pip install streamlit

# Copy the entire project
COPY . .

# Set environment variable for API key (can be overridden at runtime)
ENV OPENAI_API_KEY=""

# Set PYTHONPATH to recognize the app modules
ENV PYTHONPATH=/app

# Expose Streamlit's default port
EXPOSE 8501

# Run Streamlit app
CMD ["streamlit", "run", "apps/hq-ui/app.py", "--server.address=0.0.0.0"] 
 