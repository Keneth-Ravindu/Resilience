"""add role to users

Revision ID: 22ca5da749eb
Revises: d86eed2b88eb
Create Date: 2026-03-29 02:52:08.210543

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22ca5da749eb'
down_revision: Union[str, Sequence[str], None] = 'd86eed2b88eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
    )
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_column("users", "role")
