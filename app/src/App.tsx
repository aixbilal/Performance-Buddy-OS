import { RouterProvider } from "react-router-dom";
import { router } from "./shell/router";
import { PerformanceProvider } from "./domains/performance/store";
import { AcademicProvider } from "./domains/academic/store";
import { KnowledgeProvider } from "./domains/knowledge/store";

export default function App() {
  return (
    <PerformanceProvider>
      <AcademicProvider>
        <KnowledgeProvider>
          <RouterProvider router={router} />
        </KnowledgeProvider>
      </AcademicProvider>
    </PerformanceProvider>
  );
}
