from app.config import Settings


def test_loop_settings_defaults() -> None:
    s = Settings()
    assert s.llm_max_passes == 3
    assert s.llm_quality_threshold == 80
    assert s.judge_model == ""


def test_loop_settings_overridable(monkeypatch) -> None:
    monkeypatch.setenv("LLM_MAX_PASSES", "5")
    monkeypatch.setenv("LLM_QUALITY_THRESHOLD", "90")
    monkeypatch.setenv("JUDGE_MODEL", "claude-haiku-4-5")
    s = Settings()
    assert s.llm_max_passes == 5
    assert s.llm_quality_threshold == 90
    assert s.judge_model == "claude-haiku-4-5"
