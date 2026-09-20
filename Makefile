.PHONY: install lint format format-check type-check test check dev eval migrate migration

install:
	poetry install

lint:
	poetry run ruff check backend

format:
	poetry run black backend

format-check:
	poetry run black --check backend

type-check:
	poetry run mypy backend/app

test:
	poetry run pytest

check: lint format-check type-check test

dev:
	poetry run uvicorn app.main:app --reload --app-dir backend

migrate:
	poetry run alembic upgrade head

# Autogenerate a migration from model changes: make migration m="add foo column"
migration:
	poetry run alembic revision --autogenerate -m "$(m)"

eval:
	@echo "Eval suite arrives in a later plan (make eval)"
