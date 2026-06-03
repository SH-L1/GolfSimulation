from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.db.mongodb import close_mongodb, connect_mongodb
from app.module1.router import router as module1_router
from app.module2.router import router as module2_router
from app.module3.router import router as module3_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_mongodb()
    try:
        yield
    finally:
        await close_mongodb()


app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    lifespan=lifespan,
)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "env": settings.app_env,
        "status": "ok",
    }


@app.get(f"{settings.api_prefix}/health")
async def health():
    return {
        "status": "ok",
        "database": settings.mongodb_db,
    }


app.include_router(
    module1_router,
    prefix=f"{settings.api_prefix}/module1",
    tags=["module1"],
)

app.include_router(
    module2_router,
    prefix=f"{settings.api_prefix}/module2",
    tags=["module2"],
)

app.include_router(
    module3_router,
    prefix=f"{settings.api_prefix}/module3",
    tags=["module3"],
)