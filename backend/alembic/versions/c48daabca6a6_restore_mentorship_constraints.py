"""restore mentorship constraints

Revision ID: c48daabca6a6
Revises: 50293f9b553f
Create Date: 2026-04-12 04:51:31.265403

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c48daabca6a6'
down_revision: Union[str, Sequence[str], None] = '50293f9b553f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint(
        "uq_mentor_mentee",
        "mentorships",
        ["mentor_user_id", "mentee_user_id"],
    )
    op.create_index(
        "ix_mentorships_status",
        "mentorships",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_mentorships_created_at",
        "mentorships",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_mentorships_created_at", table_name="mentorships")
    op.drop_index("ix_mentorships_status", table_name="mentorships")
    op.drop_constraint("uq_mentor_mentee", "mentorships", type_="unique")