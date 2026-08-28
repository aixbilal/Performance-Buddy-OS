import { useState } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { SplashScreen } from "../domains/onboarding/SplashScreen";
import { useOnboarding } from "../domains/onboarding/store";
import { useSettings } from "../domains/settings/store";
import { determineFullStartupRoute } from "../domains/onboarding/engine";

/**
 * Day 15B startup gate. Sits inside the provider tree (needs real onboarding
 * + settings state) but decides whether to render the splash or the app.
 *
 * HONEST LIMITATION (see DAY-15B notes): `firstBootSeen` is in-memory only,
 * defaulting to false every process start, because real disk persistence
 * doesn't exist yet (flagged since Day 2). In a real build this would be
 * read from disk once and never reset. The "Simulate Relaunch" control on
 * the Onboarding page exists specifically so the interrupted/completed
 * routing branches can be verified live without real persistence.
 */
export function AppGate() {
  const [hasBooted, setHasBooted] = useState(false);
  const [firstBootSeen, setFirstBootSeen] = useState(false);
  const [criticalInitFailed] = useState(false); // no real init check exists yet — always false, honestly
  const { state: onboardingState, relaunchToken } = useOnboarding();
  const { appearance } = useSettings();
  const [lastRelaunchToken, setLastRelaunchToken] = useState(relaunchToken);

  if (relaunchToken !== lastRelaunchToken) {
    setLastRelaunchToken(relaunchToken);
    setHasBooted(false);
  }

  const route = determineFullStartupRoute(firstBootSeen, onboardingState.status, criticalInitFailed);

  if (!hasBooted) {
    return (
      <SplashScreen
        route={route}
        reducedMotion={appearance.reducedMotion}
        onDone={() => {
          if (route === "startup-recovery") return; // never auto-advance out of recovery
          setFirstBootSeen(true);
          const destination =
            route === "short-splash-then-today" ? "/" : "/onboarding";
          router.navigate(destination);
          setHasBooted(true);
        }}
      />
    );
  }

  return <RouterProvider router={router} />;
}
