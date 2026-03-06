"""add rewrite fields to text_analyses

Revision ID: 0a51edffa9d1
Revises: e84f3ea038d0
Create Date: 2026-03-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0a51edffa9d1"
down_revision = "e84f3ea038d0"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "text_analyses",
        sa.Column("rewrite_suggestion", sa.Text(), nullable=True),
    )
    op.add_column(
        "text_analyses",
        sa.Column("rewrite_model", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("text_analyses", "rewrite_model")
    op.drop_column("text_analyses", "rewrite_suggestion")