# Performance Buddy OS — Day 15B Startup & Motion

**Status:** LOCKED FOR V1  
**Date:** 2026-08-28  
**Scope:** First boot, normal startup, onboarding startup routing, motion and fallbacks

---

## 1. Purpose

Day 15B defines how Performance Buddy OS starts visually and how PBOS routes the user after startup.

This covers:

- First-ever boot
- Normal application boot
- Interrupted onboarding
- Splash transitions
- Startup persistence
- Reduced Motion
- Slow initialization
- Startup failure

The cinematic splash is a special first-launch experience. It is not a loading screen that should appear on every launch.

---

## 2. Startup Model

PBOS uses one startup system with different behavior depending on application state.

### First-ever launch

Launch  
→ Full cinematic PBOS splash  
→ PBOS wordmark  
→ Welcome  
→ Onboarding

### Normal launch

Launch  
→ Short PBOS splash  
→ Today

### Interrupted onboarding

Launch  
→ Short PBOS splash  
→ Continue Setup

### Reduced Motion

Launch  
→ Static PBOS brandmark  
→ Correct destination

---

## 3. Locked First-Boot Animation

The selected first-boot animation is the video originally selected as:

`Final.mp4`

This is the LOCKED V1 first-boot direction.

Do not continue generating alternative AI videos unless implementation reveals a genuine technical problem.

The other generated alternatives remain archive/reference assets only.

---

## 4. Production Assets

Production master:

`PBOS-First-Boot-Master.mp4`

Runtime video:

`PBOS-First-Boot.webm`

Production frame sequence:

`frame_0001.webp`
through
`frame_0123.webp`

Frame archive:

`PBOS-First-Boot-Frames.zip`

Current characteristics:

- Duration: approximately 5.13 seconds
- Resolution: 1280×720
- Aspect ratio: 16:9
- Frame rate: 24 FPS
- Frame count: 123
- Runtime format: WebM
- Master format: MP4

The current 1280×720 source is accepted for V1.

Do not artificially upscale it simply to label it 1920×1080.

---

## 5. Production Asset Location

Store production splash assets under:

`Design Assets/00 - Foundation/Brand Identity/05 - 3D & Splash/Production/`

Recommended structure:

Production/
├── PBOS-First-Boot-Master.mp4
├── PBOS-First-Boot.webm
└── Frames/
    ├── Source/
    │   ├── ezgif-frame-001.jpg
    │   ├── ...
    │   └── ezgif-frame-123.jpg
    │
    ├── Production/
    │   ├── frame_0001.webp
    │   ├── ...
    │   └── frame_0123.webp
    │
    └── PBOS-First-Boot-Frames.zip

The MP4 is the preserved master.

The WebM is the preferred runtime asset.

The WebP frames are retained as implementation/fallback/reference assets.

Do not build frame-by-frame playback unless there is a demonstrated reason not to use the WebM.

---

## 6. First-Boot Experience

Visual sequence:

Darkness  
→ Core activates  
→ Inner structure resolves  
→ Outer structure completes  
→ PBOS brandmark settles  
→ Subtle illumination  
→ Real PBOS wordmark appears  
→ Welcome

The animation represents PBOS coming online for the first time.

It must feel:

- premium
- private
- calm
- engineered
- precise
- restrained futuristic

It must NOT feel like:

- gaming
- cyberpunk
- RGB
- generic sci-fi
- esports branding
- a movie studio intro

---

## 7. Wordmark

The video does NOT render the final text.

PBOS renders the real wordmark in the application:

`PERFORMANCE BUDDY OS`

Preferred typography:

**Space Grotesk**

Treatment:

- uppercase
- centered
- positioned below the brandmark
- restrained letter spacing
- premium and quiet
- silver-white / PBOS text.primary
- no excessive glow
- no neon treatment

This prevents AI-generated typography errors.

---

## 8. First-Boot Timing

Target sequence using the current ~5.13 second animation:

### 0.00s – ~3.80s
First-boot animation plays.

### ~3.80s – ~4.25s
Application-rendered:

`PERFORMANCE BUDDY OS`

fades in.

### ~4.25s – ~4.85s
Completed PBOS identity holds.

### ~4.85s – ~5.13s
Splash begins transitioning away.

### ~5.13s
Welcome becomes the primary visible screen.

Minor millisecond-level adjustments are allowed during implementation if needed for synchronization.

The overall rhythm must remain calm and deliberate.

---

## 9. Splash → Welcome Transition

Welcome should already be prepared behind the splash where practical.

Transition:

Splash  
→ subtle crossfade  
→ Welcome

Target transition:

approximately 280–360ms.

Avoid:

- black flash
- white flash
- aggressive zoom
- page slide
- excessive blur
- gaming-style transitions

The experience should feel like PBOS becoming available rather than navigating between web pages.

---

## 10. First-Boot Persistence

The cinematic animation plays only for the first PBOS experience.

Persist:

`first_boot_experience_seen: boolean`

Once the cinematic experience has been shown:

`first_boot_experience_seen = true`

The full cinematic splash must NOT:

- play every launch
- loop
- replay because onboarding is unfinished
- replay after updates
- become a normal loading animation

First-boot state and onboarding state are separate.

---

## 11. Onboarding State

Persist:

`onboarding_state`

Allowed V1 states:

- `not_started`
- `in_progress`
- `completed`
- `skipped`

Example:

User launches PBOS for the first time.

Full splash plays.

User enters onboarding.

User completes only part of onboarding.

User closes PBOS.

Next launch:

DO NOT replay the full cinematic splash.

Instead:

Short splash  
→ Continue Setup

---

## 12. Startup Routing

PBOS startup routing is deterministic.

PBOS Launch
│
├── first_boot_experience_seen = false
│   │
│   └── Full First-Boot Splash
│       → set first_boot_experience_seen = true
│       → Welcome
│
└── first_boot_experience_seen = true
    │
    ├── onboarding_state = in_progress
    │   → Short Splash
    │   → Continue Setup
    │
    ├── onboarding_state = not_started
    │   → Short Splash
    │   → Welcome / Setup Entry
    │
    ├── onboarding_state = completed
    │   → Short Splash
    │   → Today
    │
    └── onboarding_state = skipped
        → Short Splash
        → Today

AI is NOT involved in startup routing.

---

## 13. Normal Boot

Normal launches must be fast.

Target:

approximately 0.8–1.2 seconds.

Sequence:

Dark matte background  
→ PBOS flat brandmark fades in  
→ subtle blue-grey illumination  
→ crossfade  
→ Today

No generated video is required.

Use:

`PBOS-Brandmark-Master.png`

Normal boot must NOT include:

- full assembly animation
- cinematic sequence
- long delay
- repeated first-boot video
- mandatory wordmark animation

The first launch is memorable.

Normal launches are fast.

---

## 14. Interrupted Onboarding

If:

`first_boot_experience_seen = true`

and:

`onboarding_state = in_progress`

then:

Launch  
→ Short Splash  
→ Continue Setup

Use the SAME short startup treatment as normal boot.

Do not create another animation asset.

---

## 15. Reduced Motion

PBOS must respect Reduced Motion.

When enabled:

Static PBOS brandmark  
→ brief hold  
→ destination

Do not play unnecessary cinematic movement.

Reduced Motion changes presentation only.

It does not change startup state or routing.

---

## 16. Slow Initialization

The cinematic splash must NEVER loop while PBOS initializes.

If PBOS initializes before first-boot animation finishes:

Allow the first-ever animation to finish normally.

If initialization takes longer:

Animation completes  
→ hold completed PBOS brandmark  
→ initialization completes  
→ transition to destination

For normal boot:

Short animation completes  
→ hold static brandmark if necessary  
→ application ready  
→ destination

Never restart the animation.

---

## 17. Startup Failure

A critical startup failure must not leave the user trapped on the splash.

Flow:

Startup  
→ initialization failure  
→ Startup Recovery / Error state

Recovery should distinguish where possible between:

- recoverable initialization issue
- local data/storage issue
- configuration issue
- unrecoverable startup failure

Do not fabricate diagnostic information.

AI is not the authoritative startup-error detector.

---

## 18. Runtime Playback

Preferred runtime asset:

`PBOS-First-Boot.webm`

Playback behavior:

- autoplay
- muted
- no controls
- no loop
- preload where appropriate
- playsInline where applicable

Avoid:

- blank delay
- first-frame flash
- media controls
- layout shift

The application must still be capable of starting if video playback fails.

Fallback behavior:

Static PBOS brandmark  
→ appropriate destination

---

## 19. Frame Sequence

123 WebP production frames are retained.

Purpose:

- implementation flexibility
- frame inspection
- fallback experimentation
- future refinement

They are NOT automatically the preferred runtime implementation.

Prefer the WebM unless real Electron testing demonstrates a reason to use frame playback.

Do not introduce a complex frame animation engine without a demonstrated requirement.

---

## 20. Brand Rules

PBOS brandmark geometry is LOCKED.

Startup implementation must NOT:

- redesign the logo
- add segments
- remove segments
- change proportions
- stretch the logo
- add RGB
- add gaming neon
- add HUD graphics
- add random particles
- add orbiting objects
- add fake technical information
- add unnecessary sci-fi decoration

The splash may be more cinematic than normal PBOS screens, but it must remain part of the same visual identity.

---

## 21. Relationship to Day 15A

Day 15A defines:

1. Welcome
2. Personal Setup
3. Connect Systems
4. Review & Launch

Day 15B defines how the user enters that experience.

Complete first-install flow:

Launch  
→ First-Boot Splash  
→ Welcome  
→ Personal Setup  
→ Connect Systems  
→ Review & Launch  
→ Today

Normal future flow:

Launch  
→ Short Splash  
→ Today

Interrupted onboarding:

Launch  
→ Short Splash  
→ Continue Setup

---

## 22. Review & Launch → Today

When the user presses:

`Launch Performance Buddy OS`

on the final onboarding screen:

Persist onboarding completion  
→ restrained transition  
→ PBOS App Shell  
→ Today

Do NOT replay the startup splash.

Review & Launch is the end of onboarding, not another application launch.

---

## 23. Implementation Boundary

Claude Code may:

- integrate the WebM
- implement startup state persistence
- implement routing
- implement wordmark overlay
- implement transitions
- implement Reduced Motion
- implement preload/fallback behavior
- implement startup recovery
- make minor runtime timing adjustments

Claude Code must NOT:

- redesign the brandmark
- replace the selected animation for aesthetic preference
- create another cinematic splash
- replay the cinematic splash every launch
- introduce a heavy animation framework without need
- invent V2/V3 startup intelligence

If a genuine design/architecture conflict appears:

`UI ↔ ARCHITECTURE REVIEW REQUIRED`

Document it rather than silently redesigning the experience.

---

## 24. V1 Locked Decisions

- PBOS V1 brand identity is locked.
- `Final.mp4` direction is selected.
- First-boot master is preserved as MP4.
- Runtime asset is WebM.
- Runtime duration is approximately 5.13 seconds.
- Runtime source is 1280×720 / 24 FPS.
- 123 WebP production frames exist.
- Frame ZIP exists.
- Cinematic splash plays once.
- Wordmark is rendered by the application.
- Normal boot is short and code-based.
- Interrupted onboarding uses the same short boot.
- Reduced Motion uses static treatment.
- Cinematic animation never loops.
- Startup routing is deterministic.
- First-boot state is separate from onboarding state.
- Review & Launch does not replay the splash.
- Further AI video generation is unnecessary for V1.

---

## 25. Acceptance Checklist

- [x] First-boot visual selected
- [x] 5-second production cut prepared
- [x] MP4 master preserved
- [x] WebM runtime asset created
- [x] WebM runtime asset tested
- [x] Source frames extracted
- [x] 123 production WebP frames generated
- [x] Frames ZIP created
- [x] Wordmark strategy locked
- [x] First-boot timing locked
- [x] Splash → Welcome behavior defined
- [x] Normal boot defined
- [x] Interrupted onboarding defined
- [x] Startup routing defined
- [x] Reduced Motion defined
- [x] Slow initialization defined
- [x] Startup failure defined
- [x] Implementation boundaries defined
- [ ] Implemented in PBOS application
- [ ] Tested in packaged desktop build

---

# Final V1 Startup Principle

**The first launch should feel memorable once.**

**Every launch after that should feel fast.**

PBOS should never repeatedly make the user watch its branding when they are trying to get to their work.