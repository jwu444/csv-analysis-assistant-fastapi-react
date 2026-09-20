"""Alembic environment — wired to the app's Settings and SQLAlchemy metadata.

The URL comes from ``app.config.settings.database_url`` (DATABASE_URL / .env), so
there is one source of truth. Models live in the ``app`` Postgres schema; on
SQLite (used only defensively / for the sqlite fallback) that schema is mapped
away via ``schema_translate_map`` so the same migrations can still apply.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from app.config import settings
from app.models import Base
from sqlalchemy import engine_from_config, pool

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

# disable_existing_loggers=False so running migrations at app startup does not
# tear down uvicorn's already-configured loggers.
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata

# On SQLite there are no schemas, so translate the models' "app" schema to the
# default (None). On Postgres this map is empty and has no effect.
_is_sqlite = settings.database_url.startswith("sqlite")
_schema_map: dict[str | None, str | None] = {"app": None} if _is_sqlite else {}


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        if _schema_map:
            connection = connection.execution_options(schema_translate_map=_schema_map)
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
