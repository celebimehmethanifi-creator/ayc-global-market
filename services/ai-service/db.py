"""DB init for ai-service — SQLite/PostgreSQL with fallback"""
import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

log = logging.getLogger("ai-service.db")

_raw = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./neura_ai.db")

# Normalize postgres URLs
if _raw.startswith("postgresql://"):
    DATABASE_URL = _raw.replace("postgresql://", "postgresql+asyncpg://")
elif _raw.startswith("postgres://"):
    DATABASE_URL = _raw.replace("postgres://", "postgresql+asyncpg://")
else:
    DATABASE_URL = _raw

engine = create_async_engine(DATABASE_URL, echo=False)
_Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        log.info(f"DB connected: {DATABASE_URL[:40]}")
    except Exception as e:
        log.warning(f"DB connection failed (non-fatal): {e}")


async def get_db():
    async with _Session() as session:
        yield session
