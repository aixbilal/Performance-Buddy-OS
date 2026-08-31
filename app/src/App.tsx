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

/**
 * Provider order matters: a store may only consume another store that wraps it.
 * Analytics reads Academic/Fitness/Money/Routine; the AI Coach reads
 * Analytics + Performance + Planning + Knowledge + Routine and drives the
 * allowlisted Apply adapters, so it sits below all of them.
 */
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
                      <PlanningProvider>
                        <SettingsProvider>
                          <OnboardingProvider>
                            <AnalyticsProvider>
                              <AICoachProvider>
                                <SearchProvider>
                                  <CaptureProvider>
                                    <MasteryProvider>
                                      <FocusProvider>
                                        <AppGate />
                                      </FocusProvider>
                                    </MasteryProvider>
                                  </CaptureProvider>
                                </SearchProvider>
                              </AICoachProvider>
                            </AnalyticsProvider>
                          </OnboardingProvider>
                        </SettingsProvider>
                      </PlanningProvider>
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
