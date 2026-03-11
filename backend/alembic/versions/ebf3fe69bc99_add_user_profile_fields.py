"""add user profile fields

Revision ID: ebf3fe69bc99
Revises: ee82c9feacdd
Create Date: 2026-03-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ebf3fe69bc99"
down_revision: Union[str, Sequence[str], None] = "ee82c9feacdd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("profile_picture_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("status_text", sa.String(length=280), nullable=True))
    op.create_index(op.f("ix_users_display_name"), "users", ["display_name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_display_name"), table_name="users")
    op.drop_column("users", "status_text")
    op.drop_column("users", "profile_picture_url")
    op.drop_column("users", "display_name")