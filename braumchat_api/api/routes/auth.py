from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...config import get_settings
from ...db.redis import redis as redis_client
from ...schemas.auth import LogoutRequest, Token, TokenRefreshRequest, UserSessionRead
from ...schemas.user import UserCreate, UserRead
from ...security.rate_limit import RateLimitRule, enforce_rate_limit
from ...security.security import decode_token
from ...services import session_service
from ...services.auth_service import authenticate_user, create_tokens_for_user
from ...services.user_service import (
    create_user,
    get_user,
    get_user_by_display_name,
    get_user_by_email,
)

router = APIRouter()
settings = get_settings()


@router.post("/register", response_model=UserRead)
async def register(
    request: Request,
    payload: UserCreate,
    db: AsyncSession = Depends(get_db_dep),
):
    # Rate limit por IP (best-effort)
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        redis=redis_client,
        key=f"rl:auth:register:ip:{client_ip}",
        rule=RateLimitRule(limit=settings.RATE_LIMIT_REGISTER_PER_HOUR, window_seconds=3600),
        fail_open=settings.RATE_LIMIT_FAIL_OPEN,
    )
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
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        redis=redis_client,
        key=f"rl:auth:login:ip:{client_ip}",
        rule=RateLimitRule(limit=settings.RATE_LIMIT_LOGIN_PER_MINUTE, window_seconds=60),
        fail_open=settings.RATE_LIMIT_FAIL_OPEN,
    )
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
async def refresh(
    request: Request,
    payload: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db_dep),
):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        redis=redis_client,
        key=f"rl:auth:refresh:ip:{client_ip}",
        rule=RateLimitRule(limit=settings.RATE_LIMIT_REFRESH_PER_MINUTE, window_seconds=60),
        fail_open=settings.RATE_LIMIT_FAIL_OPEN,
    )
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

    # Refresh rotation: revoga a sessão antiga e cria uma nova (novo sid).
    new_session_id = str(uuid4())
    new_session = await session_service.rotate_session(
        db, user_id=user_id, old_session_id=str(session_id), new_session_id=new_session_id
    )
    if not new_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")

    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    tokens = await create_tokens_for_user(user, session_id=new_session_id)
    return {
        "access_token": tokens["access_token"],
        "token_type": "bearer",
        "refresh_token": tokens["refresh_token"],
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    payload: LogoutRequest | None = None,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):

    session_id: str | None = None

    if payload and payload.refresh_token:
        try:
            token_payload = decode_token(payload.refresh_token)
            token_user_id = int(token_payload.get("sub"))
            token_sid = token_payload.get("sid")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
            )

        if token_user_id != user.id or not token_sid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
            )
        session_id = str(token_sid)
    else:
        auth = request.headers.get("authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            try:
                token_payload = decode_token(token)
                token_user_id = int(token_payload.get("sub"))
                token_sid = token_payload.get("sid")
            except Exception:
                token_user_id = None
                token_sid = None
            if token_user_id == user.id and token_sid:
                session_id = str(token_sid)

    if session_id:
        await session_service.revoke_session(db, user.id, session_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
