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
import { AnalyticsProvider } from "./domains/analytics/store";
import { AICoachProvider } from "./domains/intelligence/store";
import { PlanningProvider } from "./domains/planning/store";

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
                    <AnalyticsProvider>
                      <AICoachProvider>
                        <PlanningProvider>
                          <RouterProvider router={router} />
                        </PlanningProvider>
                      </AICoachProvider>
                    </AnalyticsProvider>
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
