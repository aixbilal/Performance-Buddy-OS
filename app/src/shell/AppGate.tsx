import { useEffect, useRef, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { SplashScreen } from "../domains/onboarding/SplashScreen";
import { useOnboarding } from "../domains/onboarding/store";
import { useSettings } from "../domains/settings/store";
import { determineFullStartupRoute } from "../domains/onboarding/engine";

/**
 * Day 15B startup gate. Decides splash vs. app and where to land.
 *
 * Batch 7: `firstBootExperienceSeen` and the onboarding status are DURABLE, so:
 *   FIRST INSTALL   -> cinematic splash -> Welcome -> … -> Today
 *   NORMAL LAUNCH   -> short splash -> Today
 *   INTERRUPTED     -> short splash -> resume at the saved step
 *   MIGRATED USER   -> short splash -> Today (never forced through first-run)
 * The cinematic first-boot experience plays exactly once, ever. The app only
 * renders once BOTH the splash animation has finished AND durable state has
 * loaded — the wrong route is never flashed.
 */
export function AppGate() {
  const [splashDone, setSplashDone] = useState(false);
  const [hasBooted, setHasBooted] = useState(false);
  const [criticalInitFailed] = useState(false); // no real init failure signal exists — honestly false
  const {
    loaded,
    state: onboardingState,
    firstBootExperienceSeen,
    markFirstBootSeen,
    relaunchToken,
  } = useOnboarding();
  const { appearance } = useSettings();
  const lastRelaunchToken = useRef(relaunchToken);

  // Mirror the in-app Appearance toggle onto <html> so the global
  // [data-reduced-motion] CSS in index.css can collapse non-essential motion
  // everywhere (route transitions, menus, modals, the AI recommendation entry,
  // the command palette, the context rail), not just where the OS media query
  // already applies.
  useEffect(() => {
    const root = document.documentElement;
    if (appearance.reducedMotion) root.dataset.reducedMotion = "true";
    else delete root.dataset.reducedMotion;
  }, [appearance.reducedMotion]);

  if (relaunchToken !== lastRelaunchToken.current) {
    lastRelaunchToken.current = relaunchToken;
    setSplashDone(false);
    setHasBooted(false);
  }

  // Capture the first-boot decision ONCE, before markFirstBootSeen flips it.
  const initialFirstBootSeen = useRef<boolean | null>(null);
  if (initialFirstBootSeen.current === null && loaded) {
    initialFirstBootSeen.current = firstBootExperienceSeen;
  }
  const effectiveFirstBootSeen = initialFirstBootSeen.current ?? firstBootExperienceSeen;
  const route = determineFullStartupRoute(
    effectiveFirstBootSeen,
    onboardingState.status,
    criticalInitFailed,
  );

  // Once the splash animation is done AND durable state has loaded, commit the boot.
  useEffect(() => {
    if (hasBooted || !splashDone || !loaded || route === "startup-recovery") return;
    markFirstBootSeen();
    const goToday =
      onboardingState.status === "completed" || onboardingState.status === "skipped";
    router.navigate(goToday ? "/" : "/onboarding");
    setHasBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splashDone, loaded, hasBooted, route]);

  if (!hasBooted) {
    return (
      <SplashScreen
        route={route}
        reducedMotion={appearance.reducedMotion}
        onDone={() => setSplashDone(true)}
      />
    );
  }

  return <RouterProvider router={router} />;
}
