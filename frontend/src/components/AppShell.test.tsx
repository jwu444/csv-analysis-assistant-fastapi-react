import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme";
import AppShell from "./AppShell";
import * as api from "../api";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.spyOn(api, "listDatasets").mockResolvedValue([]);
});

function renderShell(ui: React.ReactNode, right?: React.ReactNode) {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AppShell topbarRight={right}>{ui}</AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

test("renders the brand, the theme toggle, a right slot, and its children", () => {
  renderShell(<p>page body</p>, <span>chips</span>);
  expect(screen.getByText("CSV Analysis")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
  expect(screen.getByText("chips")).toBeInTheDocument();
  expect(screen.getByText("page body")).toBeInTheDocument();
});

test("exposes the width variant on its main region", () => {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AppShell width="upload">x</AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(screen.getByRole("main")).toHaveAttribute("data-width", "upload");
});

test("collapsing hides the datasets nav and persists to localStorage", async () => {
  renderShell(<p>body</p>);
  expect(screen.getByRole("navigation", { name: "Datasets" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
  expect(screen.queryByRole("navigation", { name: "Datasets" })).not.toBeInTheDocument();
  expect(localStorage.getItem("wp-sidebar")).toBe("collapsed");
});
