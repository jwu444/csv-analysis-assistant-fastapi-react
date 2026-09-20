from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    max_upload_bytes: int = 50 * 1024 * 1024  # 50 MB
    max_rows: int = 1_000_000
    # Frontend CORS (prod only; dev uses the Vite /api proxy). Override via .env as a
    # JSON list, e.g. CORS_ALLOW_ORIGINS='["https://app.example.com"]'.
    cors_allow_origins: list[str] = ["http://localhost:5173"]

    # Profiler tunables (design §4) — single source of truth; override per-env via .env.
    profile_max_cardinality: int = 20  # value_counts only for non-numeric cols at/below this; top-N
    profile_max_corr_cols: int = 30  # full correlation matrix up to this many numeric cols
    profile_top_corr_pairs: int = 25  # beyond the col cap, keep only the strongest N pairs
    profile_sample_rows: int = 5  # sample rows included in the profile
    profile_token_budget: int = 8000  # approx token ceiling for the assembled profile

    # Anthropic (required for /chat; key never hardcoded)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"
    anthropic_max_tokens: int = 4096

    # LLM loop (issue #9). A turn runs up to llm_max_passes analyst passes; a
    # separate judge scores each 0-100 and the loop stops at >= threshold or the
    # cap, returning the best-scoring pass. judge_model="" reuses anthropic_model.
    llm_max_passes: int = 3
    llm_quality_threshold: int = 80
    judge_model: str = ""


settings = Settings()
