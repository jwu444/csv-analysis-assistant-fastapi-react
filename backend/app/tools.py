"""Claude tool definitions and pre-execution validation for analysis functions.

This module defines the fixed menu of typed functions that Claude can call
(histogram, scatter, correlation_matrix) and provides a guard that validates
tool calls against the calling chat's dataset profiles before any chart executes.
"""

from typing import Any

TOOL_DEFS: list[dict[str, Any]] = [
    {
        "name": "histogram",
        "description": "Generate a histogram for a single numeric column in one dataset.",
        "input_schema": {
            "type": "object",
            "properties": {
                "dataset_id": {
                    "type": "string",
                    "description": "The id of the dataset to read the column from.",
                },
                "column": {
                    "type": "string",
                    "description": "The name of the numeric column to visualize.",
                },
            },
            "required": ["dataset_id", "column"],
        },
    },
    {
        "name": "scatter",
        "description": "Generate a scatter plot for two numeric columns in one dataset.",
        "input_schema": {
            "type": "object",
            "properties": {
                "dataset_id": {
                    "type": "string",
                    "description": "The id of the dataset to read the columns from.",
                },
                "x": {
                    "type": "string",
                    "description": "The name of the numeric column for the x-axis.",
                },
                "y": {
                    "type": "string",
                    "description": "The name of the numeric column for the y-axis.",
                },
            },
            "required": ["dataset_id", "x", "y"],
        },
    },
    {
        "name": "correlation_matrix",
        "description": "Generate a correlation heatmap for all numeric columns in one dataset.",
        "input_schema": {
            "type": "object",
            "properties": {
                "dataset_id": {
                    "type": "string",
                    "description": "The id of the dataset to compute correlations for.",
                }
            },
            "required": ["dataset_id"],
        },
    },
    {
        "name": "compare",
        "description": (
            "Compare an aggregated metric across two datasets, inner-joined on a "
            "shared key column, as a grouped bar chart."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "dataset_a_id": {"type": "string", "description": "The first dataset's id."},
                "dataset_b_id": {"type": "string", "description": "The second dataset's id."},
                "key_a": {
                    "type": "string",
                    "description": "The join key column name in the first dataset.",
                },
                "key_b": {
                    "type": "string",
                    "description": "The join key column name in the second dataset.",
                },
                "metric_a": {
                    "type": "string",
                    "description": "The numeric column to aggregate in the first dataset.",
                },
                "metric_b": {
                    "type": "string",
                    "description": "The numeric column to aggregate in the second dataset.",
                },
                "agg": {
                    "type": "string",
                    "enum": ["mean", "sum", "count"],
                    "description": "The aggregation applied to each metric, grouped by key.",
                },
            },
            "required": [
                "dataset_a_id",
                "dataset_b_id",
                "key_a",
                "key_b",
                "metric_a",
                "metric_b",
                "agg",
            ],
        },
    },
]


def _is_numeric(dtype: str) -> bool:
    """Check if a dtype string represents a numeric type."""
    return str(dtype).lower().startswith(("int", "float", "uint"))


def _numeric_columns(profile: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {c["name"]: c for c in profile.get("columns", []) if _is_numeric(c.get("dtype", ""))}


def validate_tool_call(
    name: str, args: dict[str, Any], profiles: dict[str, dict[str, Any]]
) -> str | None:
    """Validate a tool call against the calling chat's dataset profiles.

    Args:
        name: Tool name (e.g., "histogram", "scatter").
        args: Tool arguments from Claude (e.g., {"dataset_id": "...", "column": "age"}).
        profiles: Dataset profiles for every dataset attached to the chat, keyed by
            dataset_id. Each profile has a "columns" key containing a list of
            {"name": str, "dtype": str, "n_null": int}.

    Returns:
        Error message string if validation fails, None if valid.
    """
    tool_names = {t["name"] for t in TOOL_DEFS}
    if name not in tool_names:
        return f"Unknown tool: {name}"

    dataset_id = args.get("dataset_id") or args.get("dataset_a_id")
    if not isinstance(dataset_id, str) or dataset_id not in profiles:
        return f"Dataset not found: {dataset_id!r}"
    profile = profiles[dataset_id]
    columns_by_name = {c["name"]: c for c in profile.get("columns", [])}
    numeric_columns = _numeric_columns(profile)

    if name == "histogram":
        col = args.get("column")
        if not isinstance(col, str) or col not in columns_by_name:
            return f"Column not found: {col!r}"
        if col not in numeric_columns:
            return f"Column must be numeric: {col}"
        return None

    if name == "scatter":
        x = args.get("x")
        y = args.get("y")
        if not isinstance(x, str) or x not in columns_by_name:
            return f"Column not found: {x!r}"
        if not isinstance(y, str) or y not in columns_by_name:
            return f"Column not found: {y!r}"
        if x not in numeric_columns:
            return f"Column must be numeric: {x}"
        if y not in numeric_columns:
            return f"Column must be numeric: {y}"
        return None

    if name == "correlation_matrix":
        if len(numeric_columns) < 2:
            return "Correlation matrix requires at least 2 numeric columns"
        return None

    # name == "compare" — the only tool operating on two datasets at once. The
    # block above already resolved dataset_a (via the dataset_a_id fallback);
    # here we validate dataset_b and both datasets' key/metric columns.
    columns_a = columns_by_name
    numeric_a = numeric_columns

    dataset_b_id = args.get("dataset_b_id")
    if not isinstance(dataset_b_id, str) or dataset_b_id not in profiles:
        return f"Dataset not found: {dataset_b_id!r}"
    profile_b = profiles[dataset_b_id]
    columns_b = {c["name"]: c for c in profile_b.get("columns", [])}
    numeric_b = _numeric_columns(profile_b)

    key_a = args.get("key_a")
    key_b = args.get("key_b")
    metric_a = args.get("metric_a")
    metric_b = args.get("metric_b")
    agg = args.get("agg")

    if not isinstance(key_a, str) or key_a not in columns_a:
        return f"Column not found: {key_a!r}"
    if not isinstance(key_b, str) or key_b not in columns_b:
        return f"Column not found: {key_b!r}"
    if not isinstance(metric_a, str) or metric_a not in columns_a:
        return f"Column not found: {metric_a!r}"
    if not isinstance(metric_b, str) or metric_b not in columns_b:
        return f"Column not found: {metric_b!r}"
    if metric_a not in numeric_a:
        return f"Column must be numeric: {metric_a}"
    if metric_b not in numeric_b:
        return f"Column must be numeric: {metric_b}"
    if agg not in ("mean", "sum", "count"):
        return f"Unsupported aggregation: {agg!r}"
    return None
