
# Create a venv at backend root (run once)
python -m venv pgvenv
# Activate the virtual environment
pgvenv\Scripts\activate
# Install all dependencies from the root requirements.txt (run once or when requirements change)
pip install -r requirements.txt
# Start the FastAPI app
uvicorn main:app --host 127.0.0.1 --port 8000

#http://localhost:8000/docs