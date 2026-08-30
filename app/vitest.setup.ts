// Vitest global setup — registers @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, ...) and auto-cleans the React
// Testing Library DOM between tests. Pure-logic engine tests are unaffected.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
