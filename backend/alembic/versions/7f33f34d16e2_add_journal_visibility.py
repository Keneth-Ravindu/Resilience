"""add journal visibility

Revision ID: 7f33f34d16e2
Revises: e08cd92ef110
Create Date: 2026-03-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f33f34d16e2"
down_revision: Union[str, Sequence[str], None] = "e08cd92ef110"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) add column as nullable first, with a server default
    op.add_column(
        "journal_entries",
        sa.Column(
            "visibility",
            sa.String(length=20),
            nullable=True,
            server_default="private",
        ),
    )

    # 2) backfill old rows
    op.execute("UPDATE journal_entries SET visibility = 'private' WHERE visibility IS NULL")

    # 3) make it non-nullable
    op.alter_column(
        "journal_entries",
        "visibility",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default="private",
    )

    # 4) add index
    op.create_index(op.f("ix_journal_entries_visibility"), "journal_entries", ["visibility"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_journal_entries_visibility"), table_name="journal_entries")
    op.drop_column("journal_entries", "visibility")