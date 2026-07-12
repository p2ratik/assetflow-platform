"""add asset_tag_seq and category_status

Revision ID: 001_tag_seq_cat_status
Revises:
Create Date: 2026-07-12

Changes:
  - CREATE SEQUENCE asset_tag_seq (atomic tag generation, replaces COUNT/MAX approach)
  - ALTER TABLE categories ADD COLUMN status (soft-delete support, mirrors departments)
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "001_tag_seq_cat_status"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Postgres SEQUENCE for atomic tag generation ──────────────
    # nextval('asset_tag_seq') is always unique regardless of concurrency.
    # The existing UNIQUE constraint on assets.tag acts as the final safety net.
    op.execute("CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1 INCREMENT 1 NO CYCLE")

    # ── Soft-delete for categories ────────────────────────────────
    # Hard DELETE on categories would throw FK errors if any asset references them.
    # Use status flag (same pattern as departments) instead.
    op.add_column(
        "categories",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )


def downgrade() -> None:
    op.drop_column("categories", "status")
    op.execute("DROP SEQUENCE IF EXISTS asset_tag_seq")
