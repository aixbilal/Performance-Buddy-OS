import { useEffect, useState } from "react";
import { deriveConnectivityBannerState } from "../domains/resilience/engine";
import type { ConnectivityBannerState } from "../domains/resilience/types";

const BACK_ONLINE_DISPLAY_MS = 3000; // §28: "brief factual Back Online feedback then disappear"

/**
 * Real browser connectivity detection — `navigator.onLine` plus the actual
 * `online`/`offline` window events, not a simulated/fake status. The
 * transient "just reconnected" window is timed here; what to SHOW for a
 * given (isOnline, wasOfflineRecently) pair is decided by the tested, pure
 * `deriveConnectivityBannerState` function — this hook owns timing only.
 */
export function useConnectivityBanner(): ConnectivityBannerState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOfflineRecently, setWasOfflineRecently] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setWasOfflineRecently(false);
    };
    const handleOnline = () => {
      setIsOnline(true);
      setWasOfflineRecently(true);
      const timer = setTimeout(() => setWasOfflineRecently(false), BACK_ONLINE_DISPLAY_MS);
      return () => clearTimeout(timer);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return deriveConnectivityBannerState(isOnline, wasOfflineRecently);
}
