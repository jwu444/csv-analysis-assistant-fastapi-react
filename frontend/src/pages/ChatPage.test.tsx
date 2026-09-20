import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ChatPage from "./ChatPage";
import * as api from "../api";
import { ThemeProvider } from "../theme";

function renderAt(chatId: string) {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/c/${chatId}`]}>
        <Routes>
          <Route path="/c/:chatId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "listDatasets").mockResolvedValue([]);
});

test("renders attached dataset chips and history", async () => {
  vi.spyOn(api, "getChatHistory").mockResolvedValue({
    datasets: [{ id: "ds1", name: "sales.csv" }, { id: "ds2", name: "regions.csv" }],
    messages: [
      { id: "m1", role: "user", content: "why?", charts: [], stats: [], errors: [] },
      { id: "m2", role: "assistant", content: "because", charts: [], stats: [], errors: [] },
    ],
  });

  renderAt("chat1");

  expect(await screen.findByText("sales.csv")).toBeInTheDocument();
  expect(screen.getByText("regions.csv")).toBeInTheDocument();
  expect(screen.getByText("because")).toBeInTheDocument();
});

test("appends the user turn and the returned assistant turn on ask", async () => {
  vi.spyOn(api, "getChatHistory").mockResolvedValue({
    datasets: [{ id: "ds1", name: "sales.csv" }],
    messages: [],
  });
  vi.spyOn(api, "postChat").mockResolvedValue({
    id: "m9", role: "assistant", content: "The answer.", charts: [], stats: [], errors: [],
  });

  renderAt("chat1");
  await screen.findByText("sales.csv");

  await userEvent.type(screen.getByLabelText("Question"), "why is revenue high?");
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));

  expect(await screen.findByText("The answer.")).toBeInTheDocument();
  expect(screen.getByText("why is revenue high?")).toBeInTheDocument();
  expect(api.postChat).toHaveBeenCalledWith("chat1", "why is revenue high?");
});

test("shows a banner when the initial load fails", async () => {
  vi.spyOn(api, "getChatHistory").mockRejectedValue(new api.ApiError(404, "Chat not found"));

  renderAt("nope");

  expect(await screen.findByRole("alert")).toHaveTextContent("Chat not found");
});

test("shows a loading skeleton before history resolves", () => {
  // history fetch pending: getChatHistory returns a never-resolving promise
  vi.spyOn(api, "getChatHistory").mockReturnValue(new Promise(() => {}));
  renderAt("c1");
  // Scoped to <main>: the sidebar (AppShell) has its own pending-datasets
  // Skeleton with the same role/name, so an unscoped query is ambiguous.
  expect(
    within(screen.getByRole("main")).getByRole("status", { name: "Loading" }),
  ).toBeInTheDocument();
});

test("shows an empty state when there are no messages", async () => {
  vi.spyOn(api, "getChatHistory").mockResolvedValue({
    datasets: [{ id: "d1", name: "d.csv" }],
    messages: [],
  });
  renderAt("c1");
  expect(await screen.findByText(/Ask your first question/i)).toBeInTheDocument();
});
