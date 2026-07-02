from psycopg_pool import ConnectionPool

from .config import settings

# Opened/closed by the FastAPI lifespan in main.py.
pool = ConnectionPool(conninfo=settings.database_url, min_size=1, max_size=10, open=False)
