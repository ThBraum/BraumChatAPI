from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...schemas.auth import Token, TokenRefreshRequest, UserSessionRead
from ...schemas.user import UserCreate, UserRead
from ...security.security import decode_token
from ...services import session_service
from ...services.auth_service import authenticate_user, create_tokens_for_user
from ...services.user_service import (
    create_user,
    get_user,
    get_user_by_email,
    get_user_by_display_name,
)

router = APIRouter()


@router.post("/register", response_model=UserRead)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db_dep)):
    existing = await get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    existing_display = await get_user_by_display_name(db, payload.display_name)
    if existing_display:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Display name already taken"
        )

    user = await create_user(
        db,
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db_dep),
):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials"
        )
    session_id = str(uuid4())
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await session_service.create_session(
        db,
        user_id=user.id,
        session_id=session_id,
        user_agent=user_agent,
        ip_address=client_ip,
    )
    tokens = await create_tokens_for_user(user, session_id=session_id)
    return {
        "access_token": tokens["access_token"],
        "token_type": "bearer",
        "refresh_token": tokens["refresh_token"],
    }


@router.post("/refresh", response_model=Token)
async def refresh(payload: TokenRefreshRequest, db: AsyncSession = Depends(get_db_dep)):
    try:
        token_payload = decode_token(payload.refresh_token)
        user_id = int(token_payload.get("sub"))
        session_id = token_payload.get("sid")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    session = await session_service.get_session_by_sid(db, session_id)
    if not session or session.user_id != user_id or session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")

    await session_service.touch_session(db, session_id)
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    tokens = await create_tokens_for_user(user, session_id=session_id)
    return {
        "access_token": tokens["access_token"],
        "token_type": "bearer",
        "refresh_token": tokens["refresh_token"],
    }


@router.get("/me", response_model=UserRead)
async def me(user=Depends(get_current_user)):
    return user


@router.get("/sessions", response_model=List[UserSessionRead])
async def list_sessions(db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)):
    sessions = await session_service.list_active_sessions(db, user.id)
    return sessions


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    session = await session_service.revoke_session(db, user.id, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
