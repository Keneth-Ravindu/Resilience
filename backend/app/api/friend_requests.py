from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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