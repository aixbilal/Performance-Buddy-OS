import { RouterProvider } from "react-router-dom";
import { router } from "./shell/router";
import { PerformanceProvider } from "./domains/performance/store";
import { AcademicProvider } from "./domains/academic/store";

export default function App() {
  return (
    <PerformanceProvider>
      <AcademicProvider>
        <RouterProvider router={router} />
      </AcademicProvider>
    </PerformanceProvider>
  );
}
