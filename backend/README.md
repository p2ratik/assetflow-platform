# AssetFlow — Backend

## Setup

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy env template and fill in your Neon DATABASE_URL
copy .env.example .env

# Run migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload
```

## API Docs
Once running, visit: http://localhost:8000/docs
