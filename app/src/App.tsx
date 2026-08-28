import { RouterProvider } from "react-router-dom";
import { router } from "./shell/router";
import { PerformanceProvider } from "./domains/performance/store";
import { AcademicProvider } from "./domains/academic/store";
import { KnowledgeProvider } from "./domains/knowledge/store";
import { DevelopmentProvider } from "./domains/development/store";
import { FitnessProvider } from "./domains/fitness-recovery/store";
import { RoutineProvider } from "./domains/routine/store";
import { LanguageProvider } from "./domains/language/store";
import { MoneyProvider } from "./domains/money/store";

export default function App() {
  return (
    <PerformanceProvider>
      <AcademicProvider>
        <KnowledgeProvider>
          <DevelopmentProvider>
            <FitnessProvider>
              <RoutineProvider>
                <LanguageProvider>
                  <MoneyProvider>
                    <RouterProvider router={router} />
                  </MoneyProvider>
                </LanguageProvider>
              </RoutineProvider>
            </FitnessProvider>
          </DevelopmentProvider>
        </KnowledgeProvider>
      </AcademicProvider>
    </PerformanceProvider>
  );
}
