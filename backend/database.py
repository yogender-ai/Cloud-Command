from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

# Handle Render's postgres:// vs postgresql://
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Strip channel_binding param (not supported by psycopg2-binary)
if "channel_binding" in db_url:
    parsed = urlparse(db_url)
    params = parse_qs(parsed.query)
    params.pop("channel_binding", None)
    new_query = urlencode(params, doseq=True)
    db_url = urlunparse(parsed._replace(query=new_query))

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif "neon.tech" in db_url or "sslmode" in db_url:
    # Neon requires SSL
    connect_args = {"sslmode": "require"}

engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
