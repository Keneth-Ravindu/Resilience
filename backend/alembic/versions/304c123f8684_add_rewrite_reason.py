"""add rewrite_reason

Revision ID: 304c123f8684
Revises: 0a51edffa9d1
Create Date: 2026-03-05 10:49:11.538550

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "304c123f8684"
down_revision = "0a51edffa9d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "text_analyses",
        sa.Column("rewrite_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("text_analyses", "rewrite_reason")
