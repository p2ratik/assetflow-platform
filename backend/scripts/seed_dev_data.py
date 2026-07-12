"""
scripts/seed_dev_data.py
========================
Idempotent development seed script. Safe to run multiple times —
checks before inserting, never duplicates rows.

Usage (from backend/ directory, with .venv active):
    python -m scripts.seed_dev_data

What it creates:
  - 3 departments: Engineering, Operations, Finance
  - 4 categories: Laptop, Monitor, Conference Room Equipment, Company Vehicle
  - 1 admin, 2 asset_managers, 3 employees (dept heads set after users exist)
  - 10 assets in mixed statuses so B & C have real data immediately
  - Syncs sequence to max tag number so new assets don't collide

NOTE: All passwords are "password123" — change before any real deployment.
"""
import sys
import os

# Allow running as `python -m scripts.seed_dev_data` from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    User, Department, Category, Asset,
    Notification, ActivityLog,
)
from app.models.user import UserRole
from app.models.asset import AssetStatus, AssetCondition


# ── Helpers ───────────────────────────────────────────────────

def get_or_create_dept(db: Session, name: str) -> Department:
    dept = db.query(Department).filter(Department.name == name).first()
    if not dept:
        dept = Department(name=name)
        db.add(dept)
        db.flush()
        print(f"  [+] Department: {name}")
    else:
        print(f"  [=] Department exists: {name}")
    return dept


def get_or_create_category(db: Session, name: str, custom_fields: dict) -> Category:
    cat = db.query(Category).filter(Category.name == name).first()
    if not cat:
        cat = Category(name=name, custom_fields=custom_fields, status="active")
        db.add(cat)
        db.flush()
        print(f"  [+] Category: {name}")
    else:
        print(f"  [=] Category exists: {name}")
    return cat


def get_or_create_user(
    db: Session,
    name: str,
    email: str,
    role: UserRole,
    department_id: int | None = None,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password("password123"),
            role=role,
            department_id=department_id,
            status="active",
        )
        db.add(user)
        db.flush()
        print(f"  [+] User: {email} ({role.value})")
    else:
        print(f"  [=] User exists: {email}")
    return user


def get_or_create_asset(
    db: Session,
    tag: str,
    name: str,
    category_id: int,
    status: AssetStatus,
    condition: AssetCondition,
    location: str,
    serial_number: str | None = None,
    acquisition_cost: Decimal | None = None,
    is_bookable: bool = False,
) -> Asset:
    asset = db.query(Asset).filter(Asset.tag == tag).first()
    if not asset:
        asset = Asset(
            tag=tag,
            name=name,
            category_id=category_id,
            status=status,
            condition=condition,
            location=location,
            serial_number=serial_number,
            acquisition_date=date(2023, 1, 15),
            acquisition_cost=acquisition_cost,
            is_bookable=is_bookable,
        )
        db.add(asset)
        db.flush()
        print(f"  [+] Asset: {tag} — {name} ({status.value})")
    else:
        print(f"  [=] Asset exists: {tag}")
    return asset


# ── Main seed ─────────────────────────────────────────────────

def seed():
    # Ensure tables exist (idempotent create_all)
    from app.core.database import Base
    Base.metadata.create_all(bind=engine)

    # Ensure sequence exists (in case migration hasn't run yet)
    with engine.connect() as conn:
        conn.execute(text("CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1 INCREMENT 1 NO CYCLE"))
        # Ensure categories.status column exists
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='categories' AND column_name='status'
                ) THEN
                    ALTER TABLE categories ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
                END IF;
            END$$;
        """))
        conn.commit()

    db: Session = SessionLocal()
    try:
        print("\n=== Seeding Departments ===")
        eng = get_or_create_dept(db, "Engineering")
        ops = get_or_create_dept(db, "Operations")
        fin = get_or_create_dept(db, "Finance")
        db.commit()

        print("\n=== Seeding Categories ===")
        laptop_cat = get_or_create_category(db, "Laptop", {
            "warranty_period_months": 24,
            "brand": "string",
            "ram_gb": "integer",
        })
        monitor_cat = get_or_create_category(db, "Monitor", {
            "warranty_period_months": 36,
            "screen_size_inch": "number",
        })
        conf_cat = get_or_create_category(db, "Conference Room Equipment", {
            "room_capacity": "integer",
        })
        vehicle_cat = get_or_create_category(db, "Company Vehicle", {
            "registration_number": "string",
            "fuel_type": "string",
        })
        db.commit()

        print("\n=== Seeding Users ===")
        admin = get_or_create_user(db, "Admin User", "admin@assetflow.dev", UserRole.admin)
        am1 = get_or_create_user(db, "Alex Manager", "alex@assetflow.dev", UserRole.asset_manager, eng.id)
        am2 = get_or_create_user(db, "Sam Manager", "sam@assetflow.dev", UserRole.asset_manager, ops.id)
        emp1 = get_or_create_user(db, "Priya Shah", "priya@assetflow.dev", UserRole.employee, eng.id)
        emp2 = get_or_create_user(db, "Ravi Kumar", "ravi@assetflow.dev", UserRole.employee, eng.id)
        emp3 = get_or_create_user(db, "Meera Nair", "meera@assetflow.dev", UserRole.employee, ops.id)
        emp4 = get_or_create_user(db, "Amit Joshi", "amit@assetflow.dev", UserRole.employee, fin.id)
        emp5 = get_or_create_user(db, "Sunita Rao", "sunita@assetflow.dev", UserRole.dept_head, ops.id)
        db.commit()

        # Set dept heads
        if eng.head_id is None:
            eng.head_id = am1.id
        if ops.head_id is None:
            ops.head_id = sunita.id if (sunita := db.query(User).filter(User.email=="sunita@assetflow.dev").first()) else am2.id
        db.commit()

        print("\n=== Seeding Assets ===")
        assets_data = [
            # tag, name, category_id, status, condition, location, serial, cost, bookable
            ("AF-0001", "Dell XPS 15 Laptop",    laptop_cat.id,  AssetStatus.allocated,         AssetCondition.good,   "Engineering Bay A", "SN-LAP-001", Decimal("85000.00"), False),
            ("AF-0002", "MacBook Pro 14-inch",   laptop_cat.id,  AssetStatus.available,         AssetCondition.new,    "Asset Room 1",      "SN-LAP-002", Decimal("120000.00"), False),
            ("AF-0003", "Dell UltraSharp 27\"",  monitor_cat.id, AssetStatus.available,         AssetCondition.good,   "Engineering Bay B", "SN-MON-001", Decimal("25000.00"), False),
            ("AF-0004", "LG 4K Monitor 32\"",    monitor_cat.id, AssetStatus.allocated,         AssetCondition.good,   "Finance Floor",     "SN-MON-002", Decimal("35000.00"), False),
            ("AF-0005", "HP EliteBook 840",      laptop_cat.id,  AssetStatus.under_maintenance, AssetCondition.fair,   "IT Maintenance",    "SN-LAP-003", Decimal("65000.00"), False),
            ("AF-0006", "Lenovo ThinkPad X1",    laptop_cat.id,  AssetStatus.available,         AssetCondition.new,    "Asset Room 1",      "SN-LAP-004", Decimal("95000.00"), False),
            ("AF-0007", "Conference Room Kit A", conf_cat.id,    AssetStatus.reserved,          AssetCondition.good,   "Conf Room 1A",      "SN-CONF-001", Decimal("45000.00"), True),
            ("AF-0008", "Conference Room Kit B", conf_cat.id,    AssetStatus.available,         AssetCondition.good,   "Conf Room 2B",      "SN-CONF-002", Decimal("45000.00"), True),
            ("AF-0009", "Toyota Innova (MH04)",  vehicle_cat.id, AssetStatus.available,         AssetCondition.good,   "Parking Bay 3",     "SN-VEH-001", Decimal("1800000.00"), True),
            ("AF-0010", "Maruti Ertiga (MH02)",  vehicle_cat.id, AssetStatus.allocated,         AssetCondition.fair,   "Parking Bay 5",     "SN-VEH-002", Decimal("950000.00"),  False),
        ]

        created_assets = []
        for tag, name, cat_id, status, cond, loc, serial, cost, bookable in assets_data:
            a = get_or_create_asset(db, tag, name, cat_id, status, cond, loc, serial, cost, bookable)
            created_assets.append(a)
        db.commit()

        # Sync sequence so the next generated tag doesn't collide
        with engine.connect() as conn:
            # Find highest tag number from seeded data
            result = conn.execute(text(
                "SELECT MAX(CAST(SUBSTRING(tag FROM 4) AS INTEGER)) FROM assets WHERE tag ~ '^AF-[0-9]+$'"
            )).scalar() or 0
            if result > 0:
                conn.execute(text(f"SELECT setval('asset_tag_seq', {result})"))
                conn.commit()
                print(f"\n  [seq] asset_tag_seq set to {result} (next tag will be AF-{result+1:04d})")

        print(f"\n✅ Seed complete!")
        print(f"   Departments : {db.query(Department).count()}")
        print(f"   Categories  : {db.query(Category).count()}")
        print(f"   Users       : {db.query(User).count()}")
        print(f"   Assets      : {db.query(Asset).count()}")
        print(f"\n   Login credentials (password: password123):")
        print(f"   admin@assetflow.dev        → admin")
        print(f"   alex@assetflow.dev         → asset_manager")
        print(f"   sam@assetflow.dev          → asset_manager")
        print(f"   sunita@assetflow.dev       → dept_head (Operations)")
        print(f"   priya@assetflow.dev        → employee (Engineering)")
        print(f"   ravi@assetflow.dev         → employee (Engineering)")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
