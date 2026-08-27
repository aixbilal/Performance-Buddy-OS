import { RouterProvider } from "react-router-dom";
import { router } from "./shell/router";
import { PerformanceProvider } from "./domains/performance/store";

export default function App() {
  return (
    <PerformanceProvider>
      <RouterProvider router={router} />
    </PerformanceProvider>
  );
}
