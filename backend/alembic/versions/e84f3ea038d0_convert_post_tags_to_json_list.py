"""convert post tags to json list

Revision ID: e84f3ea038d0
Revises: ae98f84831bf
Create Date: 2026-03-03 09:45:22.696703

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e84f3ea038d0"
down_revision = "ae98f84831bf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Temporarily allow conversion by using a USING clause.
    # Convert:
    #   NULL -> NULL
    #   ''   -> '[]'
    #   'a,b,c' -> ["a","b","c"]
    #   'strength' -> ["strength"]
    op.execute(
        """
        ALTER TABLE posts
        ALTER COLUMN tags
        TYPE json
        USING (
            CASE
                WHEN tags IS NULL THEN NULL
                WHEN btrim(tags) = '' THEN '[]'::json
                ELSE to_json(string_to_array(tags, ','))
            END
        );
        """
    )


def downgrade() -> None:
    # Convert JSON array back into comma-separated string
    op.execute(
        """
        ALTER TABLE posts
        ALTER COLUMN tags
        TYPE varchar(255)
        USING (
            CASE
                WHEN tags IS NULL THEN NULL
                WHEN json_typeof(tags) = 'array' THEN array_to_string(
                    ARRAY(SELECT json_array_elements_text(tags)),
                    ','
                )
                ELSE tags::text
            END
        );
        """
    )
