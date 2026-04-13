from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.db.session import get_db
from app.models.friend_request import FriendRequest
from app.models.user import User
from app.services.security import get_current_user
from app.schemas.friend_request import FriendRequestOut

router = APIRouter(prefix="/friend-requests", tags=["friend_requests"])


@router.post("/{user_id}", response_model=FriendRequestOut)
def send_friend_request(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")

    existing = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.requester_id == current_user.id,
            FriendRequest.receiver_id == user_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Request already sent")

    request = FriendRequest(
        requester_id=current_user.id,
        receiver_id=user_id,
        status="pending",
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return request


@router.get("/incoming", response_model=list[FriendRequestOut])
def get_incoming_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(FriendRequest)
        .filter(
            FriendRequest.receiver_id == current_user.id,
            FriendRequest.status == "pending",
        )
        .all()
    )

@router.get("/status/{user_id}")
def get_friend_request_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        return {
            "status": "self",
            "request_id": None,
        }

    relation = (
        db.query(FriendRequest)
        .filter(
            or_(
                and_(
                    FriendRequest.requester_id == current_user.id,
                    FriendRequest.receiver_id == user_id,
                ),
                and_(
                    FriendRequest.requester_id == user_id,
                    FriendRequest.receiver_id == current_user.id,
                ),
            )
        )
        .order_by(FriendRequest.id.desc())
        .first()
    )

    if not relation:
        return {
            "status": "none",
            "request_id": None,
        }

    if relation.status == "accepted":
        return {
            "status": "friends",
            "request_id": relation.id,
        }

    if relation.status == "pending":
        if relation.requester_id == current_user.id:
            return {
                "status": "pending_sent",
                "request_id": relation.id,
            }
        return {
            "status": "pending_received",
            "request_id": relation.id,
        }

    if relation.status == "rejected":
        return {
            "status": "none",
            "request_id": relation.id,
        }

    return {
        "status": "none",
        "request_id": relation.id,
    }

@router.post("/{request_id}/accept")
def accept_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.get(FriendRequest, request_id)

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    request.status = "accepted"
    request.responded_at = datetime.utcnow()

    db.commit()

    return {"message": "Friend request accepted"}


@router.post("/{request_id}/reject")
def reject_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.get(FriendRequest, request_id)

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    request.status = "rejected"
    request.responded_at = datetime.utcnow()

    db.commit()

    return {"message": "Friend request rejected"}

@router.get("/friends")
def get_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friends = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.status == "accepted",
            or_(
                FriendRequest.requester_id == current_user.id,
                FriendRequest.receiver_id == current_user.id,
            ),
        )
        .all()
    )

    result = []

    for fr in friends:
        if fr.requester_id == current_user.id:
            friend = db.get(User, fr.receiver_id)
        else:
            friend = db.get(User, fr.requester_id)

        if friend:
            result.append(
                {
                    "id": friend.id,
                    "name": friend.name,
                    "display_name": friend.display_name,
                    "profile_picture_url": friend.profile_picture_url,
                    "role": friend.role,
                }
            )

    return result