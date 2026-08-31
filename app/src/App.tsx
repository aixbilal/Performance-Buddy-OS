import { AppGate } from "./shell/AppGate";
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
import { SettingsProvider } from "./domains/settings/store";
import { OnboardingProvider } from "./domains/onboarding/store";
import { SearchProvider } from "./domains/search/store";
import { CaptureProvider } from "./domains/capture/store";
import { MasteryProvider } from "./domains/academic/masteryStore";
import { FocusProvider } from "./domains/focus/store";
import { ObsidianProvider } from "./domains/obsidian/store";

export default function App() {
  return (
    <PerformanceProvider>
      <AcademicProvider>
        <KnowledgeProvider>
          <ObsidianProvider>
          <DevelopmentProvider>
            <FitnessProvider>
              <RoutineProvider>
                <LanguageProvider>
                  <MoneyProvider>
                    <AnalyticsProvider>
                      <AICoachProvider>
                        <PlanningProvider>
                          <SettingsProvider>
                            <OnboardingProvider>
                              <SearchProvider>
                                <CaptureProvider>
                                  <MasteryProvider>
                                    <FocusProvider>
                                      <AppGate />
                                    </FocusProvider>
                                  </MasteryProvider>
                                </CaptureProvider>
                              </SearchProvider>
                            </OnboardingProvider>
                          </SettingsProvider>
                        </PlanningProvider>
                      </AICoachProvider>
                    </AnalyticsProvider>
                  </MoneyProvider>
                </LanguageProvider>
              </RoutineProvider>
            </FitnessProvider>
          </DevelopmentProvider>
          </ObsidianProvider>
        </KnowledgeProvider>
      </AcademicProvider>
    </PerformanceProvider>
  );
}
