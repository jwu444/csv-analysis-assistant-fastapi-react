import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./index";

function open() {
  return userEvent.click(screen.getByRole("button", { name: "Expand" }));
}

test("Dialog is closed until the trigger is clicked", async () => {
  render(
    <Dialog trigger={<button>Expand</button>} title="Chart detail">
      <p>body</p>
    </Dialog>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await open();
  expect(screen.getByRole("dialog", { name: "Chart detail" })).toBeInTheDocument();
});

test("Dialog closes on Escape", async () => {
  render(
    <Dialog trigger={<button>Expand</button>} title="Chart detail">
      <p>body</p>
    </Dialog>,
  );
  await open();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
