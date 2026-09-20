import { useState, type ReactNode } from "react";
import { IconButton, ThemeToggle } from "../ui";
import DatasetSidebar from "./DatasetSidebar";
import styles from "./AppShell.module.css";

const SIDEBAR_KEY = "wp-sidebar";

interface AppShellProps {
  children: ReactNode;
  topbarRight?: ReactNode;
  width?: "chat" | "upload";
}

function initialCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export default function AppShell({ children, topbarRight, width = "chat" }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      } catch {
        // ignore persistence failures (private mode, etc.)
      }
      return next;
    });
  }

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      <header className={styles.topbar}>
        <div className={styles.left}>
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={toggle}
          >
            ☰
          </IconButton>
          <span className={styles.brand}>CSV Analysis</span>
        </div>
        <div className={styles.right}>
          {topbarRight}
          <ThemeToggle />
        </div>
      </header>
      <div className={styles.body}>
        {!collapsed && (
          <aside className={styles.sidebar}>
            <DatasetSidebar />
          </aside>
        )}
        <main data-width={width} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
