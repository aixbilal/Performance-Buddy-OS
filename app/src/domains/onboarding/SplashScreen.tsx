import { useEffect, useRef, useState } from "react";
import type { FullStartupRoute } from "./types";

/**
 * Implements Day 15B end to end using the REAL locked assets (copied into
 * /public/splash from Design Assets/00 - Foundation/Brand Identity/05 - 3D & Splash).
 *
 * Timing per §8: 0.00–3.80s animation, 3.80–4.25s wordmark fades in,
 * 4.25–4.85s hold, 4.85–5.13s transition out. These are implemented as real
 * timers tied to the actual ~5.13s video, not guessed.
 */

const WORDMARK_IN_MS = 3800;
const HOLD_END_MS = 4850;
const TRANSITION_OUT_MS = 5130;

export function SplashScreen({
  route,
  reducedMotion,
  onDone,
}: {
  route: FullStartupRoute;
  reducedMotion: boolean;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showWordmark, setShowWordmark] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const isFullCinematic = route === "full-cinematic-splash-then-welcome";
  // §21: normal short startup — brandmark fade, no video, ~0.8-1.2s per spec.
  const shortStartupMs = 900;

  useEffect(() => {
    if (route === "startup-recovery") return; // recovery has its own render path, no timers needed

    // §24: Reduced Motion — static brandmark, brief hold, no cinematic movement,
    // regardless of first-boot status. This does NOT change routing, only presentation.
    if (reducedMotion || !isFullCinematic) {
      const t = setTimeout(() => onDone(), shortStartupMs);
      return () => clearTimeout(t);
    }

    // Full cinematic path with real timers matching §8.
    const wordmarkTimer = setTimeout(() => setShowWordmark(true), WORDMARK_IN_MS);
    const holdTimer = setTimeout(() => {}, HOLD_END_MS);
    const fadeTimer = setTimeout(() => setFadingOut(true), HOLD_END_MS);
    const doneTimer = setTimeout(() => onDone(), TRANSITION_OUT_MS + 320); // + crossfade per §9 (280-360ms)

    return () => {
      clearTimeout(wordmarkTimer);
      clearTimeout(holdTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, reducedMotion]);

  if (route === "startup-recovery") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-canvas text-text-primary">
        <div className="text-center max-w-sm">
          <div className="text-status-danger text-sm font-medium mb-2">Startup Recovery</div>
          <p className="text-text-secondary text-sm">
            PBOS could not complete a required startup check (local storage or database initialization).
            This is a core failure, not an AI or optional-integration issue.
          </p>
        </div>
      </div>
    );
  }

  // Short, non-cinematic startup (§21) — static brandmark fade only.
  if (!isFullCinematic || reducedMotion) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center bg-canvas transition-opacity duration-300 ${fadingOut ? "opacity-0" : "opacity-100"}`}>
        <img src="/splash/PBOS-Brandmark-Master.png" alt="Performance Buddy OS" className="w-24 h-24 object-contain" />
      </div>
    );
  }

  // Full cinematic first-boot (§6, §8).
  return (
    <div className={`h-screen w-screen relative bg-black overflow-hidden transition-opacity duration-300 ${fadingOut ? "opacity-0" : "opacity-100"}`}>
      {!videoFailed ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src="/splash/PBOS-First-Boot.webm"
          poster="/splash/PBOS-Splash-Poster-1920x1080.png"
          autoPlay
          muted
          playsInline
          // §25: never loop the cinematic animation.
          onEnded={() => {
            // If init/timers finish before the video, the video simply holds
            // its last frame — no loop, per §25.
          }}
          // §27: video-failure fallback — never trap the user on a broken player.
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <img src="/splash/PBOS-Brandmark-Master.png" alt="Performance Buddy OS" className="w-32 h-32 object-contain" />
        </div>
      )}

      {showWordmark && (
        <div className="absolute inset-x-0 bottom-[18%] flex justify-center">
          <span className="font-display text-text-primary tracking-[0.25em] text-sm uppercase font-medium animate-[fadeIn_450ms_ease-out]">
            Performance Buddy OS
          </span>
        </div>
      )}
    </div>
  );
}
