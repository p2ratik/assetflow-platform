"""
apply_category_status.py
------------------------
Applies the two DDL changes from migration 001 directly,
since PostgreSQL's transactional DDL rolled back the ALTER TABLE
when the alembic_version insert failed (VARCHAR(32) overflow).

Run from: backend/
  python scripts/apply_category_status.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import psycopg2
from app.core.config import settings

url = settings.DATABASE_URL  # postgresql://...
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

# 1. Add status column to categories (idempotent)
cur.execute("""
    ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
""")
print("[OK] categories.status column ensured.")

# 2. Ensure asset_tag_seq exists (idempotent)
cur.execute("CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1 INCREMENT 1 NO CYCLE;")
print("[OK] asset_tag_seq sequence ensured.")

cur.close()
conn.close()
print("Done - restart uvicorn to pick up the schema change.")
