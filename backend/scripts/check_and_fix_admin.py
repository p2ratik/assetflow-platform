"""
check_and_fix_admin.py
----------------------
Checks the current user roles and optionally promotes a user to admin.

Run from: backend/
  python scripts/check_and_fix_admin.py
  python scripts/check_and_fix_admin.py promote your@email.com
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import psycopg2
from app.core.config import settings

url = settings.DATABASE_URL
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

# Show all users and their roles
cur.execute("SELECT id, name, email, role, status FROM users ORDER BY id;")
rows = cur.fetchall()
print("\n=== Current Users ===")
print(f"{'ID':<5} {'Name':<20} {'Email':<30} {'Role':<15} {'Status'}")
print("-" * 85)
for r in rows:
    print(f"{r[0]:<5} {r[1]:<20} {r[2]:<30} {r[3]:<15} {r[4]}")

# Promote if email argument given
if len(sys.argv) == 3 and sys.argv[1] == "promote":
    email = sys.argv[2]
    cur.execute(
        "UPDATE users SET role = 'admin' WHERE email = %s RETURNING id, name, email, role;",
        (email,)
    )
    updated = cur.fetchone()
    if updated:
        print(f"\n[OK] Promoted {updated[1]} ({updated[2]}) -> role: {updated[3]}")
        print("     Log out and log back in to get a fresh JWT with the new role.")
    else:
        print(f"\n[ERR] No user found with email: {email}")

cur.close()
conn.close()
