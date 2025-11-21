from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api.routes import auth as auth_router
from .api.routes import workspaces as workspaces_router
from .api.routes import channels as channels_router
from .api.routes import messages as messages_router
from .api.routes import realtime as realtime_router
from .api.routes import direct_messages as dm_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="braumchat-api")

    origins = [o.strip() for o in (settings.CORS_ORIGINS or "").split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # include routers
    app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
    app.include_router(workspaces_router.router, prefix="/workspaces", tags=["workspaces"])
    app.include_router(channels_router.router, prefix="/channels", tags=["channels"])
    app.include_router(messages_router.router, prefix="", tags=["messages"])  # messages routes include channels path
    app.include_router(dm_router.router)
    # WebSocket endpoints
    app.include_router(realtime_router.router)

    return app


app = create_app()
