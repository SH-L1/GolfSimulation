from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.core.config import settings

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None


async def connect_mongodb() -> None:
    global client, db
    if db is not None:
        return

    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    await init_indexes()


async def close_mongodb() -> None:
    global client, db
    if client is not None:
        client.close()
    client = None
    db = None


def get_db() -> AsyncIOMotorDatabase:
    if db is None:
        raise RuntimeError("MongoDB is not connected.")
    return db


async def init_indexes() -> None:
    database = get_db()
    await database.users.create_index([("uid", ASCENDING)], unique=True)
    await database.analysisresults.create_index([("sessionid", ASCENDING)], unique=True)
    await database.swingsessions.create_index([("userid", ASCENDING), ("createdat", DESCENDING)])
    await database.poseframes.create_index([("sessionid", ASCENDING), ("frameidx", ASCENDING)], unique=True)
    await database.chatsessions.create_index([("userid", ASCENDING), ("currentsessionid", ASCENDING)])
    await database.referencestats.create_index([("referenceversion", ASCENDING), ("viewtype", ASCENDING)])