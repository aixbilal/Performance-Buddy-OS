// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MoneyProvider } from "./store";
import { MoneyOverviewPage } from "./MoneyOverviewPage";
import { TransactionsPage } from "./TransactionsPage";
import { BudgetSavingsPage } from "./BudgetSavingsPage";
import { MoneyInsightsPage } from "./MoneyInsightsPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

function App({ start = "/money" }: { start?: string }) {
  return (
    <MoneyProvider>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/money" element={<MoneyOverviewPage />} />
          <Route path="/money/transactions" element={<TransactionsPage />} />
          <Route path="/money/budget" element={<BudgetSavingsPage />} />
          <Route path="/money/insights" element={<MoneyInsightsPage />} />
        </Routes>
      </MemoryRouter>
    </MoneyProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

type U = ReturnType<typeof userEvent.setup>;

async function addTransaction(
  user: U,
  { type, amount, category }: { type: string; amount: string; category?: string },
) {
  await screen.findAllByRole("button", { name: /add.*transaction/i }); // wait past LOADING
  const openers = screen.queryAllByRole("button", { name: /add.*transaction/i });
  await user.click(openers[0]);
  await user.selectOptions(await screen.findByLabelText(/^type$/i), type);
  await user.type(screen.getByLabelText(/^amount$/i), amount);
  if (category !== undefined) {
    await user.type(screen.getByLabelText(/^category/i), category);
  }
  await user.click(screen.getByRole("button", { name: /^add transaction$/i }));
}

describe("Money — driven through the real UI", () => {
  it("honest empty state on the overview and the transactions screen", async () => {
    render(<App />);
    expect(
      await screen.findByText(/does not mean your bank balance is zero/i),
    ).toBeInTheDocument();
    render(<App start="/money/transactions" />);
    expect(await screen.findByText(/No transactions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/not that your bank balance is zero/i)).toBeInTheDocument();
  });

  it("records income, an expense and a savings transfer — spending EXCLUDES the transfer", async () => {
    const user = userEvent.setup();
    render(<App start="/money/transactions" />);
    await addTransaction(user, { type: "income", amount: "50000", category: "Freelance" });
    await addTransaction(user, { type: "expense", amount: "10000", category: "Food & Dining" });
    await addTransaction(user, { type: "savings-transfer", amount: "15000" });

    render(<App start="/money" />);
    // "Spent (recorded)" is 10,000 — NOT 25,000
    const spent = (await screen.findByText("Spent (recorded)")).closest("div")!;
    expect(within(spent.parentElement!).getByText("Rs 10,000")).toBeInTheDocument();
    const movedToSavings = screen.getByText("Moved to savings").closest("div")!;
    expect(within(movedToSavings.parentElement!).getByText("Rs 15,000")).toBeInTheDocument();
    // tracked net = 50000 - 10000 - 15000 = 25000
    const net = screen.getByText("Tracked net").closest("div")!;
    expect(within(net.parentElement!).getByText("Rs 25,000")).toBeInTheDocument();
  });

  it("editing and deleting a transaction updates the totals", async () => {
    const user = userEvent.setup();
    render(<App start="/money/transactions" />);
    await addTransaction(user, { type: "expense", amount: "10000", category: "Food" });
    await user.click(await screen.findByRole("button", { name: /^edit$/i }));
    const amount = screen.getByLabelText(/^amount$/i);
    await user.clear(amount);
    await user.type(amount, "7000");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/Rs 7,000/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete transaction/i }));
    expect(await screen.findByText(/No transactions yet/i)).toBeInTheDocument();
  });

  it("a planned expense does NOT increase actual spending; 'Record actual' creates a separate transaction", async () => {
    const user = userEvent.setup();
    render(<App start="/money/transactions" />);
    await addTransaction(user, { type: "expense", amount: "10000", category: "Food" });

    render(<App start="/money/budget" />);
    await user.type(await screen.findByLabelText(/planned expense title/i), "Internet");
    await user.type(screen.getByLabelText(/planned expense amount/i), "5000");
    await user.type(screen.getByLabelText(/planned expense category/i), "Utilities");
    await user.click(screen.getByRole("button", { name: /^add planned$/i }));
    expect(await screen.findByText("Internet")).toBeInTheDocument();

    // actual spending still 10,000 on the overview
    render(<App start="/money" />);
    const spent = (await screen.findByText("Spent (recorded)")).closest("div")!;
    expect(within(spent.parentElement!).getByText("Rs 10,000")).toBeInTheDocument();

    // realise it → a NEW transaction appears, planned row stays (now 'realized')
    render(<App start="/money/budget" />);
    await user.click(await screen.findByRole("button", { name: /record actual/i }));
    expect(await screen.findByText(/realized/i)).toBeInTheDocument();
    render(<App start="/money/transactions" />);
    expect(await screen.findByText(/Planned: Internet/)).toBeInTheDocument();
  });

  it("budget usage derives only from actual category expenses", async () => {
    const user = userEvent.setup();
    render(<App start="/money/transactions" />);
    await addTransaction(user, { type: "expense", amount: "4000", category: "Food & Dining" });
    await addTransaction(user, { type: "income", amount: "9000", category: "Food & Dining" });
    await addTransaction(user, { type: "savings-transfer", amount: "9000" });

    render(<App start="/money/budget" />);
    await user.type(await screen.findByLabelText(/budget category/i), "Food & Dining");
    const limit = screen.getByLabelText(/budget limit/i);
    await user.type(limit, "5000");
    await user.click(screen.getByRole("button", { name: /^add budget$/i }));
    // 4000 / 5000 = 80% → approaching limit; income + transfer ignored
    expect(await screen.findByText(/Rs 4,000 \/ 5,000/)).toBeInTheDocument();
    expect(screen.getByText(/approaching limit/i)).toBeInTheDocument();
  });

  it("savings goal progress = opening amount + linked transfers, never expenses", async () => {
    const user = userEvent.setup();
    render(<App start="/money/budget" />);
    await user.type(await screen.findByLabelText(/savings goal title/i), "New Laptop");
    await user.type(screen.getByLabelText(/savings goal target amount/i), "100000");
    await user.type(screen.getByLabelText(/savings goal monthly target/i), "7500");
    const opening = screen.getByLabelText(/savings goal opening amount/i);
    await user.clear(opening);
    await user.type(opening, "20000");
    await user.click(screen.getByRole("button", { name: /^add goal$/i }));
    // opening 20,000 of 100,000 = 20%
    expect(await screen.findByText(/Rs 20,000 \/ 100,000 · 20%/)).toBeInTheDocument();
    expect(
      screen.getByText(/opening amount \+ linked savings transfers\. expenses are never counted/i),
    ).toBeInTheDocument();
  });

  it("validation failure preserves the other input", async () => {
    const user = userEvent.setup();
    render(<App start="/money/transactions" />);
    await user.click(await screen.findByRole("button", { name: /add transaction/i }));
    await user.type(await screen.findByLabelText(/^category/i), "Groceries");
    await user.click(screen.getByRole("button", { name: /^add transaction$/i }));
    expect(await screen.findByText(/amount must be a positive number/i)).toBeInTheDocument();
    expect((screen.getByLabelText(/^category/i) as HTMLInputElement).value).toBe("Groceries");
  });

  it("insights are deterministic and never claim a verified bank balance", async () => {
    const user = userEvent.setup();
    render(<App start="/money/transactions" />);
    await addTransaction(user, { type: "income", amount: "50000", category: "Freelance" });
    await addTransaction(user, { type: "expense", amount: "10000", category: "Food" });

    render(<App start="/money/insights" />);
    expect(await screen.findByText(/actual spending 10,000/i)).toBeInTheDocument();
    expect(screen.getByText(/not a verified bank balance/i)).toBeInTheDocument();
    // no advisory language anywhere in the rendered insight statements
    expect(screen.queryByText(/you should (invest|save|buy|sell|cut back)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bad with money/i)).not.toBeInTheDocument();
  });
});
