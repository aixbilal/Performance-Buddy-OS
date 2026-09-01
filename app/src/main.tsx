import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPersistence } from './domains/persistence/bootstrap'
import { installDevControls } from './domains/persistence/testControls'

// WebdriverIO renderer E2E support + dev-only storage controls. Gated on
// MODE === 'development' (true for `npm run dev` and `npm run build:e2e`;
// false — and therefore fully tree-shaken — for the production `npm run build`).
if (import.meta.env.MODE === 'development') {
  installDevControls()
  import('@wdio/tauri-plugin').catch(() => {
    /* not present / not under Tauri — fine */
  })
}

const rootEl = document.getElementById('root')!

// A real "loading" surface — not a blank screen, and distinct from "empty".
rootEl.innerHTML =
  '<div style="height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#0a0c0f;color:#7c8490;font:14px/1.5 \'Inter Variable\',Inter,system-ui,sans-serif">' +
  'Starting Performance Buddy OS…</div>'

// Persistence must be up before any domain store reads its slice — but a slow
// or stuck backend must never permanently block the UI. The bootstrap records
// a truthful status either way (a timeout leaves it in `loading`, which the
// Data & Storage panel surfaces); domain stores then fall back to their seed
// defaults rather than the app hanging forever.
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))])

withTimeout(initPersistence(), 8000).finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
