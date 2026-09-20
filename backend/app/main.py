from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


def create_app(init_on_startup: bool = True) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if init_on_startup:
            from app.db import init_db

            init_db()
        yield

    app = FastAPI(title="CSV Analysis Assistant", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        # No credentials are sent from the frontend; keeping this False avoids the
        # any-origin-with-credentials hole if origins are ever widened to ["*"].
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    from app.routes import chats, datasets

    app.include_router(datasets.router)
    app.include_router(chats.router)
    return app


app = create_app()
