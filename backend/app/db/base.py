from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import models so Alembic detects them
from app.models import *  

from app.models.friend_request import FriendRequest
from app.models.reaction import Reaction
from app.models.notification import Notification