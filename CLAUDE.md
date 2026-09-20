# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CSV Analysis Assistant — Project 1 of a 3-project AI Engineering Workshop. Upload a CSV, ask natural-language questions, get plots + statistics + LLM interpretation. Uses Claude with tool-calling over a fixed menu of pandas/plot functions, driven by a **judge-gated multi-pass loop** (`app/loop.py`, issue #9): an analyst pass picks/adds chart tools and writes an interpretation, the charts are rendered, and a separate judge pass scores the attempt against the real rendered output — iterating until the score clears a threshold or a pass cap is hit. Full-stack: **FastAPI** backend + **React/Vite/TypeScript** frontend (`frontend/`). Project 2 forks this repo to add a real agent loop and auth.

## Run the whole app

Two terminals. Set `ANTHROPIC_API_KEY` in `.env` first (`cp .env.example .env`) —
required for `/chat`. Backend: `make dev` (http://localhost:8000). Frontend:
`cd frontend && npm install && npm run dev` (http://localhost:5173, proxies
`/api → :8000`). Open http://localhost:5173. See `README.md` for the full
quickstart, testing walkthrough, and toolchain setup. See `doc/architecture.md`
for a diagrammed architecture overview.

## Commands (backend)

All commands require `poetry install` first. Run from the repo root. The project
pins Python **3.12** (`.python-version`); a fresh shell may need pyenv + Poetry on
`PATH` — see the Testing section of `README.md` for the toolchain setup and a manual-testing walkthrough.

```bash
make install        # install all deps (creates poetry.lock)
make check          # lint + format-check + type-check + test (the CI gate)
make test           # pytest only (ephemeral SQLite, no API key needed)
make lint           # ruff check backend
make format         # black backend (auto-fix)
make type-check     # mypy backend/app (strict)
make dev            # uvicorn with --reload (app-dir backend)
make migrate        # apply Alembic migrations (alembic upgrade head)
make migration m="…" # autogenerate a migration from app/models.py changes
make eval           # LLM eval suite (see below) — NOT YET IMPLEMENTED; currently a stub
```

**`make eval` — the LLM eval suite (D6).** Kept deliberately separate from
`make test` because, unlike the unit tests (which run offline against SQLite),
the eval suite hits the **real Anthropic API** at temperature 0 against a fixed
golden set of questions over a sample dataset — so it costs tokens and needs
`ANTHROPIC_API_KEY`. It grades the loop's final (best-scoring) output on three
things: (1) the **tool(s)** Claude selected, (2) the **columns** it passed, and
(3) **keyword presence** in the interpretation prose. The prose-keyword pass
rate was the go/no-go metric for the old single-pass design (D2); that go/no-go
is now resolved — D2 was replaced by the judge-gated loop (`app/loop.py`, issue
#9, see `doc/project-1-llm-loop-design.md`) rather than a fixed 2-pass split.
**Current state:** the Makefile target is a placeholder that only prints a
message — the suite itself is authored in a later plan. See
`doc/project-1-week2-end-to-end-flow-design.md` for the original (now
superseded) single-pass contract.

Run a single test file:
```bash
poetry run pytest backend/tests/test_profiler.py -v
```

## Commands (frontend)

Run from `frontend/`:

```bash
npm install         # first run only
npm run dev         # Vite dev server at :5173, proxies /api → :8000
npm test            # Vitest + React Testing Library (mocked fetch, no backend)
npm run build       # tsc type-check then production build
npm run type-check  # tsc --noEmit
```

## Code layout

```
backend/
  app/
    main.py          # create_app() factory; /health route; CORS; includes datasets + chats routers
    config.py        # Settings (pydantic-settings); DATABASE_URL, anthropic_*, profile_*, llm_* (loop, issue #9), etc.
    models.py        # Dataset, DatasetColumn, Chat, ChatDataset, ChatMessage (+pass_count/judge_score/trace_json), Analysis
    db.py            # engine, SessionLocal, init_db() (Alembic on PG, create_all on SQLite), get_session() DI
    dataset_io.py    # decode_csv() / load_csv() / hash_csv() — pure CSV (de)serialization + content-hash helpers
    profiler.py      # profile_dataframe() — bounded rich profile (see §4 constraints below)
    tools.py         # tool schemas (incl. compare) + validate_tool_call() — validates args vs. per-dataset profiles
    llm.py           # analyst/judge primitives: analyst_call, judge_call, image_block, stats_block; used by app.loop
    loop.py          # run_loop() — quality-gated analyst/judge loop (issue #9); returns LoopResult (+per-pass trace, system_prompt)
    analysis.py      # pandas/plot analysis functions incl. compare() (fresh Figure per call, Agg backend)
    charts.py        # _DISPATCH tool→fn map over a dict of per-dataset dfs; render_message_analysis() re-renders
    schemas.py       # Pydantic models: DatasetOut, ChatCreateRequest, ChatOut, ChatDatasetOut, ChatMessageOut (+trace), ChatHistoryOut, MessageTraceOut/PassTraceOut/AnalystPassOut/JudgePassOut
    routes/
      datasets.py    # POST /datasets (upload → validate → profile → persist, deduplicated by content hash), GET /datasets (list, newest first), GET /datasets/{id}
      chats.py       # POST /chats, POST /chats/{id}/messages, GET /chats/{id} — run_loop, persist (+pass_count/judge_score), re-render
  alembic/           # Alembic migration environment
    env.py           # wired to Settings.database_url + Base.metadata; schema-aware
    versions/        # migration scripts (initial schema = all 6 tables in the app schema)
  tests/
    conftest.py      # client fixture — isolated SQLite DB per test via tmp_path
    test_*.py
frontend/            # React + Vite + TypeScript SPA
  src/
    api.ts           # fetch wrappers (uploadDataset, getDataset, createChat, get/postChat); VITE_API_BASE
    App.tsx          # routes: / (UploadPage), /c/:chatId (ChatPage)
    pages/           # UploadPage (multi-file), ChatPage
    components/      # AppShell (two-column collapsible shell) and DatasetSidebar (dataset nav), QuestionBox, ChatTurn, ChartList, StatsDetails, PassTrace (loop trace, tokenized per-pass UI, system prompt excluded), ErrorBanner, DatasetChips
    ui/              # tokenized primitive component library — Button, Input, Textarea, Card, Badge, Dialog, Skeleton, IconButton, ThemeToggle — + barrel index.ts
    styles/          # tokens.css (CSS-variable design tokens: color/type/spacing/radius) + global.css (base + focus-visible)
    theme.tsx        # ThemeProvider / useTheme() — dark mode
  vite.config.ts     # dev /api → :8000 proxy; Vitest config
prompts/
  system.md          # system prompt fed to Claude
doc/
  architecture.md                              # student-oriented architecture overview + diagrams
  project-1-csv-analysis-assistant-design.md   # approved design; read before changing architecture
  plans/2026-06-23-project-1-backend-foundation.md  # task-by-task backend plan with checkboxes
```

- Backend application code: `backend/app/` only. Backend tests: `backend/tests/` only.
- Frontend code and tests: `frontend/src/` (co-located `*.test.tsx`).
- Imports are absolute from `app` (e.g. `from app.profiler import profile_dataframe`).
- Line length: **100** (ruff + black both configured to 100).
- mypy is **strict** on `backend/app`.

## Non-obvious design decisions (read before touching these areas)

**No `users` table, no auth (D4).** A dataset `id` is its own shareable link. There is no user scoping, no login, no session. Do not add a `User` model or FK — that arrives in the Project 2 fork.

**Raw CSV in Postgres, no object store (D5).** Uploaded data is stored verbatim as raw CSV text in `datasets.data_csv` (`Text` → `text` on Postgres, `TEXT` on SQLite) — the single durable copy. `load_csv()` is the one canonical parser used at both upload-profiling and later chart re-render, so both see identical dtypes. No parquet/pyarrow step, no S3/GCS/local-disk storage. Trade-off: no compression (a 50MB CSV stays ~50MB), bounded by the upload cap. The ephemeral filesystem on Render/Fly free tiers is intentionally avoided.

**Alembic is the schema authority on Postgres.** `app/models.py` is the source
of truth; migrations under `backend/alembic/versions/` translate it to the DB.
`init_db()` runs `alembic upgrade head` at startup for Postgres and falls back to
`Base.metadata.create_all()` only for SQLite (local default + tests). All tables
live in the `app` Postgres schema; the initial migration `CREATE SCHEMA`s it
(autogenerate does not). After changing a model, run `make migration m="…"`,
review the generated file, then `make migrate`. The legacy `backend/db/schema.sql`
is a Week-2 SQL-learning artifact and is **no longer** used to build the DB — do
not treat it as authoritative; it predates and diverges from the ORM.

**Charts are never stored.** Charts are a pure function of `data_csv` + a message's `tool_calls`. On any history reload the backend re-renders them from those two inputs. There is no `chart_urls` column and no image files.

**Quality-gated LLM loop (issue #9, replaces D2 single-pass).** `app/loop.py`'s `run_loop()` is the orchestrator: an analyst pass (`app.llm.analyst_call`) picks/adds chart tools and writes an interpretation, the backend validates and renders those charts (as it always did), and a separate judge pass (`app.llm.judge_call`, scored per `prompts/judge.md` via a forced `submit_verdict` tool call) rates the attempt 0–100 against the actual rendered charts + stats — not a prediction of them. The loop feeds the analyst its own prior interpretation, the rendered images/stats, and the judge's feedback/gaps, and repeats until the judge score clears `Settings.llm_quality_threshold` (default **80**), `Settings.llm_max_passes` (default **3**) is reached, or the pass stalls out (adds no new charts and the judge score does not improve over the best so far), then returns the **best-scoring** pass (not necessarily the last). `Settings.judge_model` (default `""` → falls back to `anthropic_model`) lets the judge run on a different model. `chat_messages.pass_count` / `judge_score` (both nullable) persist per turn for later eval/analysis. `tokens_in/out`, `cost_usd`, `latency_ms` on the assistant row are now **sums across every analyst + judge call** in the turn. See `doc/project-1-llm-loop-design.md`.

**Loop trace exposed in the UI (issue #9 review).** `run_loop()` also returns a per-pass `trace` (list of `{analyst, judge, charts, stats, errors, revision_instruction}`, one per pass); the route persists it as `{"passes": [...]}` in `chat_messages.trace_json` (nullable) and returns it as `ChatMessageOut.trace` (a `MessageTraceOut`, `None` for user/pre-trace rows). The frontend renders it via `PassTrace` — a collapsed `<details>` under each answer showing each pass's analyst/judge model + tokens + latency + cost, the judge score/feedback/gaps, and the revision instruction fed to the next pass. **This intentionally reverses the earlier "response shape unchanged / pass detail not exposed" decision** (the reviewer asked for it). Two constraints from that review: (1) the assembled **system prompt is never exposed** — it is not returned, not stored, and has no UI toggle (it can leak guardrail language, so it never leaves the backend); (2) unlike the main charts (re-rendered from `tool_calls`, never stored), the trace's per-pass PNGs **are** stored verbatim in `trace_json` — the deliberate exception to "charts are never stored", accepted for its storage cost so the UI shows exactly what each judge saw.

**Multi-dataset chat (issue #6).** A chat spans N datasets via the `chat_datasets` join table (`Chat` has no `dataset_id`). Datasets are fixed at chat creation (`POST /chats {dataset_ids}`); there is no mid-chat attach. The three per-dataset tools (`histogram`, `scatter`, `correlation_matrix`) each require a `dataset_id` arg, and a `compare` tool does an in-memory, inner-join comparison of an aggregated metric across **exactly two** datasets. Both are additive to the LLM loop above (dataset profiles are assembled once per turn into the shared system prompt every analyst pass reuses, degrading `sample_rows` first if the combined budget `profile_token_budget * n_datasets` is exceeded) and D5 (joined/compared data is computed per request and never persisted). See `doc/project-1-multi-dataset-chat-design.md`.

**Profiler token budget.** `profile_dataframe()` enforces: `value_counts` only for columns with cardinality ≤ 20, correlations capped at top-25 pairs beyond 30 numeric columns, 5 sample rows. If the assembled profile exceeds the token budget, it degrades to schema + `describe()` + correlations only (`degraded=True`). These caps are **configuration parameters** (`Settings.profile_max_cardinality`, `profile_max_corr_cols`, `profile_top_corr_pairs`, `profile_sample_rows`, `profile_token_budget`; overridable via `.env`, see `.env.example`) — the upload route passes `settings.profile_*` into `profile_dataframe()`. Do not widen these defaults without reviewing D3.

**matplotlib `Agg` backend, fresh `Figure` per call.** The analysis engine must never touch `pyplot` global state — it is not thread-safe under FastAPI. Each function creates a fresh `Figure`, renders, and closes it.

**Backend validates Claude's tool args before executing.** On column mismatch or type mismatch, skip that call and return a graceful error entry — never pass raw Claude output to the analysis functions unchecked.

**Profiler normalizes NaN → None at the record level.** `profile_dataframe()` sample rows convert NaN to `None` per-scalar after `to_dict()` (`_is_na_scalar`), *not* via `DataFrame.where(..., None)` — under pandas 2.3 a float column re-coerces `None` back to `NaN`, which silently breaks JSON null-ness. Keep the per-record normalization.

**FastAPI `Depends()`/`File()` in defaults are exempted from ruff B008.** `pyproject.toml` lists FastAPI's dependency markers under `[tool.ruff.lint.flake8-bugbear] extend-immutable-calls`. This is intentional — the idiomatic FastAPI signature (`file: UploadFile = File(...)`) would otherwise trip flake8-bugbear's "function call in default argument" rule. Don't rewrite route signatures to dodge it.

**Idempotent upload (issue #7).** `POST /datasets` deduplicates by a SHA-256 hash of the raw upload bytes, stored in `datasets.content_hash` (`VARCHAR(64)`, unique). A re-upload of identical content returns the existing record with 200; `content_hash` is internal and not exposed in `DatasetOut`. Backfill for pre-existing rows hashes the stored decoded CSV (best-effort — original raw bytes are not retained).

**Frontend design foundation is Radix primitives + CSS-variable tokens + CSS modules (issue #11).** The only new runtime dependency is `@radix-ui/react-dialog`; everything else in `frontend/src/ui/` is a hand-rolled, tokenized wrapper. Dark mode is a persisted `data-theme` toggle (localStorage key `wp-theme`), defaulting to the OS `prefers-color-scheme`. Because Vitest runs with `css: false`, component tests must assert on roles / accessible names / `data-*` attributes / visible text — never CSS-module class names.

## Tests

Tests run against **SQLite** (via `tmp_path`). Production uses Postgres via `DATABASE_URL`. The `client` pytest fixture in `conftest.py` overrides `get_session` with an isolated SQLite session for every test — no shared state between tests.

The eval suite (`make eval`) is a separate, real-API grader — see the **`make eval`** write-up under Commands (backend). It is currently a stub; keep it separate from `make test` when it lands.

## Implementation plans

`doc/plans/` contains task-by-task implementation plans with checkbox steps. When executing a plan, use the `superpowers:executing-plans` or `superpowers:subagent-driven-development` skill and track progress via the checkboxes. Complete one task fully (including its test) before starting the next.

## Document sync — required before merging a PR or committing a major feature

Before merging a PR or committing a change that adds, removes, or significantly alters a feature, sync the following key documents so they stay accurate:

- **`README.md`** — update the quickstart, commands, and feature list if the user-facing behaviour changed
- **`CLAUDE.md`** — update code layout, non-obvious design decisions, and constraints if the architecture changed
- **`doc/project-1-csv-analysis-assistant-design.md`** — update any design decisions (D1–D6) that were revised
- **`doc/plans/`** — tick off completed tasks in the relevant plan file

A PR that changes behaviour without updating the relevant doc should not be merged.
