"""
force_seed_categories.py
------------------------
Force-inserts default categories and departments regardless of whether they exist.
Safe to run multiple times — uses ON CONFLICT DO NOTHING.

Run from backend/:
  python scripts/force_seed_categories.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import psycopg2
from app.core.config import settings

CATEGORIES = [
    "Laptop", "Desktop", "Monitor", "Printer", "Projector",
    "Phone", "Tablet", "Server", "Networking Equipment",
    "Office Furniture", "Vehicle", "Other",
]

DEPARTMENTS = [
    "Engineering", "Finance", "HR", "Marketing", "Operations", "IT",
]

conn = psycopg2.connect(settings.DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

print("Seeding categories...")
for name in CATEGORIES:
    cur.execute(
        "INSERT INTO categories (name, custom_fields, status) "
        "VALUES (%s, '{}', 'active') ON CONFLICT (name) DO NOTHING",
        (name,)
    )
    print(f"  + {name}")

print("\nSeeding departments...")
for name in DEPARTMENTS:
    cur.execute(
        "INSERT INTO departments (name, status) "
        "VALUES (%s, 'active') ON CONFLICT (name) DO NOTHING",
        (name,)
    )
    print(f"  + {name}")

cur.execute("SELECT id, name, status FROM categories ORDER BY id;")
rows = cur.fetchall()
print(f"\n=== Categories in DB ({len(rows)}) ===")
for r in rows:
    print(f"  {r[0]}: {r[1]} [{r[2]}]")

cur.execute("SELECT id, name, status FROM departments ORDER BY id;")
rows = cur.fetchall()
print(f"\n=== Departments in DB ({len(rows)}) ===")
for r in rows:
    print(f"  {r[0]}: {r[1]} [{r[2]}]")

cur.close()
conn.close()
print("\nDone!")
