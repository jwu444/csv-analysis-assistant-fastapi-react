import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createChat, listDatasets } from "../api";
import type { DatasetOut } from "../types";
import { Button, Skeleton } from "../ui";
import styles from "./DatasetSidebar.module.css";

export default function DatasetSidebar() {
  const [datasets, setDatasets] = useState<DatasetOut[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    listDatasets()
      .then((ds) => {
        if (active) setDatasets(ds);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load datasets");
      });
    return () => {
      active = false;
    };
  }, []);

  async function startChat(ids: string[]) {
    if (ids.length === 0 || starting) return;
    setStarting(true);
    try {
      const chat = await createChat(ids);
      navigate(`/c/${chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start chat");
      setStarting(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onRowClick(id: string) {
    // While a selection is active, a bare row click toggles that row rather
    // than starting a single-dataset chat, so the two paths don't fight.
    if (selected.size > 0) toggle(id);
    else void startChat([id]);
  }

  return (
    <nav aria-label="Datasets" className={styles.nav}>
      <div className={styles.header}>
        <Link to="/" className={styles.newUpload}>
          + New upload
        </Link>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {datasets === null && !error && (
        <div className={styles.list}>
          <Skeleton count={5} />
        </div>
      )}
      {datasets !== null && datasets.length === 0 && (
        <p className={styles.empty}>
          No datasets yet — <Link to="/">upload one</Link>.
        </p>
      )}
      {datasets !== null && datasets.length > 0 && (
        <ul className={styles.list}>
          {datasets.map((d) => (
            <li key={d.id} className={styles.row} data-selected={selected.has(d.id)}>
              <input
                type="checkbox"
                className={styles.check}
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
                aria-label={`Select ${d.name}`}
              />
              <button
                type="button"
                className={styles.rowButton}
                onClick={() => onRowClick(d.id)}
              >
                <span className={styles.name}>{d.name}</span>
                <span className={styles.meta}>
                  {d.n_rows} × {d.n_cols}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected.size > 0 && (
        <div className={styles.footer}>
          <Button size="sm" loading={starting} onClick={() => startChat([...selected])}>
            Start chat with {selected.size} dataset{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </nav>
  );
}
