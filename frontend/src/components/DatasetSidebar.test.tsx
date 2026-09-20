import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DatasetSidebar from "./DatasetSidebar";
import * as api from "../api";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

beforeEach(() => {
  vi.restoreAllMocks();
  navigateMock.mockReset();
});

function renderSidebar() {
  render(
    <MemoryRouter>
      <DatasetSidebar />
    </MemoryRouter>,
  );
}

test("lists datasets returned by the API", async () => {
  vi.spyOn(api, "listDatasets").mockResolvedValue([
    { id: "d1", name: "sales.csv", n_rows: 10, n_cols: 3 },
    { id: "d2", name: "people.csv", n_rows: 5, n_cols: 2 },
  ]);
  renderSidebar();
  expect(await screen.findByText("sales.csv")).toBeInTheDocument();
  expect(screen.getByText("people.csv")).toBeInTheDocument();
});

test("clicking a dataset starts a chat over just that dataset and navigates", async () => {
  vi.spyOn(api, "listDatasets").mockResolvedValue([
    { id: "d1", name: "sales.csv", n_rows: 10, n_cols: 3 },
  ]);
  vi.spyOn(api, "createChat").mockResolvedValue({
    id: "chatA", datasets: [{ id: "d1", name: "sales.csv" }],
  });
  renderSidebar();
  await userEvent.click(await screen.findByRole("button", { name: /sales\.csv/ }));
  expect(api.createChat).toHaveBeenCalledWith(["d1"]);
  expect(navigateMock).toHaveBeenCalledWith("/c/chatA");
});

test("multi-select shows a footer action and starts one chat over all picked datasets", async () => {
  vi.spyOn(api, "listDatasets").mockResolvedValue([
    { id: "d1", name: "sales.csv", n_rows: 10, n_cols: 3 },
    { id: "d2", name: "people.csv", n_rows: 5, n_cols: 2 },
  ]);
  vi.spyOn(api, "createChat").mockResolvedValue({
    id: "chatB",
    datasets: [{ id: "d1", name: "sales.csv" }, { id: "d2", name: "people.csv" }],
  });
  renderSidebar();
  await userEvent.click(await screen.findByRole("checkbox", { name: "Select sales.csv" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Select people.csv" }));
  // With a selection active, a bare row click must NOT start a single chat.
  await userEvent.click(screen.getByRole("button", { name: /Start chat with 2 datasets/ }));
  expect(api.createChat).toHaveBeenCalledWith(["d1", "d2"]);
  expect(navigateMock).toHaveBeenCalledWith("/c/chatB");
});

test("shows an empty state when there are no datasets", async () => {
  vi.spyOn(api, "listDatasets").mockResolvedValue([]);
  renderSidebar();
  expect(await screen.findByText(/No datasets yet/)).toBeInTheDocument();
});

test("shows an alert when listDatasets fails to load", async () => {
  vi.spyOn(api, "listDatasets").mockRejectedValue(new Error("network down"));
  renderSidebar();
  expect(await screen.findByRole("alert")).toHaveTextContent("network down");
});

test("with a selection active, clicking a bare row toggles it instead of starting a single chat", async () => {
  vi.spyOn(api, "listDatasets").mockResolvedValue([
    { id: "d1", name: "sales.csv", n_rows: 10, n_cols: 3 },
    { id: "d2", name: "people.csv", n_rows: 5, n_cols: 2 },
  ]);
  const createChat = vi.spyOn(api, "createChat");
  renderSidebar();
  // Activate a selection via the checkbox, then click a *different* row's button.
  await userEvent.click(await screen.findByRole("checkbox", { name: "Select sales.csv" }));
  await userEvent.click(screen.getByRole("button", { name: /people\.csv/ }));
  // A bare row click while a selection is active must only toggle, never start a chat.
  expect(createChat).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /Start chat with 2 datasets/ })).toBeInTheDocument();
});
