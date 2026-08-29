\# PBOS IMPLEMENTATION HANDOFF — DAY 14 + DAY 15A + DAY 15B



You are continuing implementation of Performance Buddy OS.



This handoff covers:



\- Day 14 — Settings \& Preferences

\- Day 15A — Onboarding \& Initial Setup

\- Day 15B — Startup \& Motion



Do NOT jump ahead into Day 16 or later product work as part of this task.



The ChatGPT product/UI track is intentionally ahead of engineering.



Implement sequentially and carefully. Do not rush merely to catch up.



\---



\# 1. SOURCE OF TRUTH



Before modifying implementation, inspect the current repository and read the relevant PBOS documentation.



Relevant design folders:



`Design Assets/15 - Settings \& Preferences/`



and:



`Design Assets/16 - Onboarding \& Initial Setup/`



Also inspect:



`Design Assets/00 - Foundation/`



especially the locked:



\- Design System

\- Visual Identity

\- Brand Identity



Read:



`Design Assets/16 - Onboarding \& Initial Setup/README.md`



and:



`Design Assets/16 - Onboarding \& Initial Setup/README-DAY15B-STARTUP-MOTION.md`



before implementing startup/onboarding behavior.



Do not implement from this handoff alone when the repository contains more specific locked documentation.



\---



\# 2. REFERENCE IMAGE POLICY



Generated screen images are V1 STRUCTURAL/FUNCTIONAL REFERENCES.



They define:



\- information architecture

\- major hierarchy

\- intended modules

\- relationships

\- primary interactions

\- approximate composition



They are NOT final pixel-perfect UI specifications.



Do not spend excessive engineering time reproducing accidental visual details from generated references.



However, do not independently redesign the product.



Use the locked PBOS Design System, Visual Identity, App Shell and approved Today direction as the design authority.



The later manual visual-redesign phase will refine composition and polish.



Build reusable components now so that later visual redesign is a styling/composition layer rather than a rewrite.



\---



\# 3. GLOBAL ENGINEERING RULE



Reuse existing PBOS primitives.



Do NOT create duplicate:



\- Action engines

\- Goal engines

\- System engines

\- timer engines

\- notification engines

\- note engines

\- assessment engines

\- planning engines

\- settings stores

\- AI permission systems



Settings and onboarding should configure existing domain architecture rather than creating parallel architecture.



\---



\# PART A — DAY 14: SETTINGS \& PREFERENCES



Relevant folder:



`Design Assets/15 - Settings \& Preferences/`



Reference screens:



1\. `PBOS-Settings-Overview-v1-REFERENCE.png`

2\. `PBOS-Settings-Performance-Planning-v1-REFERENCE.png`

3\. `PBOS-Settings-AI-Privacy-Data-v1-REFERENCE.png`

4\. `PBOS-Settings-Notifications-Appearance-v1-REFERENCE.png`



Before/while implementing, ensure this folder contains a concise:



`README.md`



documenting:



\- scope

\- references

\- architecture

\- locked rules

\- implementation status



Do not leave the Settings folder undocumented.



\---



\# 4. SETTINGS ARCHITECTURE



Settings must support:



Base Configuration

→ Mode Override

→ Temporary Override

→ Effective Configuration



Do not overwrite baseline settings when activating a mode or temporary override.



Conceptually:



`effective = base + active\_mode\_override + active\_temporary\_override`



with deterministic precedence.



Temporary overrides should be capable of expiring.



Mode changes should be inspectable before activation.



\---



\# 5. SETTINGS OVERVIEW



Implement a relatively simple Settings home.



This is NOT another analytics dashboard.



Primary areas include:



\- General

\- Performance

\- Intelligence

\- Application



Expose useful configuration summaries and links to deeper settings.



Include or support:



\- current Operating Mode

\- Performance \& Planning

\- AI \& Intelligence

\- Privacy \& Data

\- Backup

\- Notifications

\- Appearance

\- Obsidian

\- Academic configuration

\- personal-system defaults

\- setup attention

\- app information

\- advanced/destructive controls

\- Settings Search

\- unsaved/changed state where relevant

\- configuration provenance where useful



Operating modes include:



\- Normal

\- Midterm

\- Final

\- Recovery



Do not silently activate mode changes.



\---



\# 6. PERFORMANCE \& PLANNING SETTINGS



Support configuration for:



\- baseline capacity

\- flexible/preferred capacity

\- hard maximum where applicable

\- protected sleep/time

\- Focus configuration

\- planning buffer

\- daily load limits

\- preferred scheduling periods

\- priority behavior

\- Operating Modes

\- temporary overrides

\- Planner behavior

\- missed-work behavior



Important distinctions:



baseline target ≠ mandatory workload



hard constraint ≠ preference



available clock time ≠ productive capacity



Protected sleep must not be casually sacrificed by the planning engine.



Planning buffer should be preserved.



Optional work may remain unscheduled when capacity is insufficient.



AI may suggest configuration changes.



AI may NOT silently change:



\- mode

\- capacity

\- sleep protection

\- hard constraints



Use:



Suggest

→ Preview

→ User activates



where appropriate.



\---



\# 7. AI, PRIVACY \& DATA SETTINGS



Support:



\- AI provider configuration

\- AI enabled/disabled state

\- read permissions

\- recommendation permissions

\- proposal permissions

\- domain-level access

\- context minimization

\- context preview where practical

\- controlled memory

\- approval behavior

\- local-data controls

\- backup/recovery

\- export/import

\- retention

\- destructive-data actions

\- AI activity/audit information



V1 AI model:



Structured PBOS data

→ deterministic rules

→ minimized permitted AI context

→ AI interpretation/proposal

→ user decision

→ PBOS validation

→ applied change



AI must NOT receive unrestricted database write access.



Conversation is NOT automatically permanent PBOS memory.



Domain permission does NOT mean the entire domain is automatically sent to a provider.



Local-first PBOS does NOT mean cloud AI requests remain on-device.



Make external processing clear.



PBOS deterministic functionality must remain usable if AI is disabled or unavailable.



Obsidian note bodies remain authoritative in Obsidian.



Do not introduce mature RAG/vector/agent architecture here.



\---



\# 8. NOTIFICATIONS / APPEARANCE / APP BEHAVIOR



Support:



\- notification master control

\- notification categories

\- priority

\- quiet hours

\- Focus suppression/queueing

\- digest behavior

\- appearance

\- system/dark behavior where supported

\- density

\- sidebar preference

\- motion

\- Reduced Motion

\- restrained visual effects

\- startup destination

\- completion behavior

\- confirmation behavior

\- active-session behavior

\- minimize/close behavior

\- sounds

\- accessibility

\- shortcuts

\- restore-interface-defaults



Notifications should protect attention rather than maximize engagement.



Routine scheduling and notification configuration are separate concepts.



High-impact actions should use appropriate confirmation.



Resetting UI preferences must NOT reset user data.



Timers/sessions must survive ordinary navigation/minimize behavior according to existing architecture.



\---



\# PART B — DAY 15A: ONBOARDING \& INITIAL SETUP



Relevant folder:



`Design Assets/16 - Onboarding \& Initial Setup/`



Reference screens:



1\. `PBOS-Onboarding-Welcome-v1-REFERENCE.png`

2\. `PBOS-Onboarding-Personal-Setup-v1-REFERENCE.png`

3\. `PBOS-Onboarding-Connect-Systems-v1-REFERENCE.png`

4\. `PBOS-Onboarding-Review-Launch-v1-REFERENCE.png`



Read:



`Design Assets/16 - Onboarding \& Initial Setup/README.md`



before implementation.



\---



\# 9. ONBOARDING ARCHITECTURE



First-install flow:



Launch

→ First-Boot Splash

→ Welcome

→ Personal Setup

→ Connect Systems

→ Review \& Launch

→ Today



Onboarding must be resumable.



Persist state.



Recommended:



`onboarding\_state`



with:



\- `not\_started`

\- `in\_progress`

\- `completed`

\- `skipped`



Do not treat every individual page as a completely independent onboarding system.



Persist enough progress to resume safely.



\---



\# 10. WELCOME



Welcome is a calm introduction, not a dashboard.



Core idea:



“PBOS is your private system for turning goals into consistent action, evidence and improvement.”



Communicate:



Plan

→ Act

→ Evidence

→ Understand

→ Adjust



Also communicate:



Goals

→ Systems

→ Actions



Core concepts:



Your System  

Your Evidence  

Your Intelligence



AI is optional.



Local-first core must not be presented as meaning all AI processing is local.



Potential actions:



\- Set Up My PBOS

\- Explore First

\- Continue Existing PBOS

\- Restore Backup



Only expose actions that are genuinely supported.



Do not create fake demo/history data for Explore unless such behavior is explicitly designed elsewhere.



No mandatory account/login wall for local V1.



\---



\# 11. PERSONAL SETUP



Capture enough baseline information to make PBOS useful.



Possible fields/configuration include:



\- profile/name

\- primary-use hint

\- timezone

\- week start

\- current phase

\- sleep target

\- preferred sleep

\- protected sleep

\- rough weekday capacity

\- rough weekend capacity

\- fixed commitments

\- priorities

\- quick domain seeds

\- planning style

\- planning buffer

\- reminder baseline



Use Required / Recommended / Optional distinctions where helpful.



Do not turn this into the complete Settings application.



Do not force detailed setup for every PBOS domain.



Support Save \& Exit / resume behavior.



\---



\# 12. CONNECT YOUR SYSTEMS



Provide modular initial setup.



Possible modules:



\- Academics

\- Development

\- Fitness

\- Routines

\- Reading \& Language

\- Knowledge \& Obsidian

\- Money

\- AI



States may include:



\- Configured

\- Partial

\- Not Set Up

\- Optional

\- Disabled



Recommend relevant modules based on explicit onboarding priorities where appropriate.



Do not silently configure or activate systems.



A partial setup is VALID.



Optional integrations do not block launch.



Planner baseline, protected sleep, Today and shared Action infrastructure should already be available from core setup.



AI setup must expose:



\- provider

\- permissions

\- external processing implications

\- no unrestricted direct writes



Goals/Systems may allow a lightweight initial goal/system creation or defer it until later.



Fitness plans must not be silently activated.



\---



\# 13. REVIEW \& LAUNCH



Review existing choices.



Do not introduce substantial new configuration here.



Summarize:



\- starting baseline

\- priorities

\- connected systems

\- partial systems

\- planning rules

\- AI/privacy

\- data state

\- what happens after launch



Ready does NOT mean every domain is configured.



Optional domains must not block launch.



A genuine core storage/database initialization failure MAY block launch.



Do not create fake historical evidence.



Do not silently create/apply a full schedule.



If a first plan is proposed:



Generate/Propose

→ Review

→ User accepts/applies



Final action:



`Launch Performance Buddy OS`



Persist onboarding completion BEFORE transitioning to the real application.



Then:



Review \& Launch

→ PBOS App Shell

→ Today



Do NOT replay the startup splash here.



\---



\# PART C — DAY 15B: STARTUP \& MOTION



Read the complete source of truth:



`Design Assets/16 - Onboarding \& Initial Setup/README-DAY15B-STARTUP-MOTION.md`



Do not improvise a different startup system.



\---



\# 14. LOCKED FIRST-BOOT ASSET



The selected V1 first-boot animation is LOCKED.



Production assets are under:



`Design Assets/00 - Foundation/Brand Identity/05 - 3D \& Splash/Production/`



Expected assets:



`PBOS-First-Boot-Master.mp4`



`PBOS-First-Boot.webm`



Frames:



`frame\_0001.webp` through `frame\_0123.webp`



Frame archive:



`PBOS-First-Boot-Frames.zip`



Current runtime characteristics:



\- approximately 5.13 seconds

\- 1280×720

\- 16:9

\- 24 FPS

\- 123 frames



The 1280×720 source is accepted for V1.



Do not upscale merely to produce a nominal 1080p asset.



Prefer:



`PBOS-First-Boot.webm`



for runtime playback if it performs reliably.



Do not build a frame renderer merely because frames exist.



\---



\# 15. FIRST-BOOT TIMING



Approximate sequence:



0.00s–3.80s:

cinematic logo animation



3.80s–4.25s:

application-rendered PBOS wordmark fades in



4.25s–4.85s:

completed identity holds



4.85s–5.13s:

transition away from splash



\~5.13s:

Welcome visible



Minor runtime timing adjustments are acceptable if required for synchronization.



Do not materially change the sequence without a reason.



\---



\# 16. WORDMARK



Do NOT use AI-generated text from the video.



Render:



`PERFORMANCE BUDDY OS`



in application UI.



Use the locked PBOS typography system.



Preferred:



Space Grotesk



Treatment:



\- uppercase

\- centered beneath mark

\- restrained tracking

\- quiet silver-white treatment

\- no neon

\- no heavy glow



\---



\# 17. FIRST-BOOT STATE



Persist separately:



`first\_boot\_experience\_seen: boolean`



This must remain independent from:



`onboarding\_state`



The cinematic splash plays once.



Example:



first launch

→ cinematic splash

→ onboarding begins

→ user exits midway



next launch:



short splash

→ Continue Setup



NOT cinematic splash again.



\---



\# 18. NORMAL STARTUP



Normal startup is approximately:



0.8–1.2 seconds.



No generated video required.



Use:



`PBOS-Brandmark-Master.png`



Suggested:



dark matte background

→ brandmark fade

→ subtle blue-grey illumination

→ crossfade

→ Today



No cinematic assembly.



No long wait.



No mandatory wordmark.



\---



\# 19. INTERRUPTED ONBOARDING



If:



`first\_boot\_experience\_seen = true`



and:



`onboarding\_state = in\_progress`



then:



Launch

→ short splash

→ Continue Setup



Reuse normal short startup.



Do not create another animation.



\---



\# 20. REDUCED MOTION



Respect system/application Reduced Motion preference.



Use:



Static PBOS brandmark

→ brief hold

→ destination



Do not force cinematic motion when Reduced Motion is enabled.



Reduced Motion affects presentation, not startup routing.



\---



\# 21. INITIALIZATION



Do not use the cinematic animation as an indefinite loader.



If initialization completes early:



allow first-ever cinematic sequence to complete.



If initialization is slower than the animation:



animation completes

→ hold stable final identity

→ initialization completes

→ destination



Never loop the cinematic animation.



Normal startup may similarly hold the static brandmark if initialization takes longer.



\---



\# 22. STARTUP FAILURE



A genuine critical startup failure must route away from the splash into an appropriate recovery/error state.



Do not leave the user on a frozen splash indefinitely.



Do not fabricate diagnostic information.



Startup failure detection is deterministic/application-level.



AI is not authoritative here.



\---



\# 23. VIDEO PLAYBACK



Preferred behavior for WebM:



\- autoplay

\- muted

\- no controls

\- no loop

\- preload appropriately

\- no visible browser/video chrome



Avoid:



\- blank first-frame delay

\- black/white flash

\- layout shift



Application startup must not depend exclusively on successful video playback.



Fallback:



static PBOS brandmark

→ appropriate destination



\---



\# 24. SPLASH → WELCOME



Where practical, prepare Welcome behind the splash.



Near the end:



Splash

→ restrained crossfade

→ Welcome



Target transition:



approximately 280–360ms.



Avoid:



\- black flash

\- white flash

\- large zoom

\- sliding page

\- excessive blur

\- gaming transitions



\---



\# 25. REVIEW \& LAUNCH → TODAY



Do not replay startup branding.



Onboarding completion flow:



user confirms Launch Performance Buddy OS

→ persist completed state

→ restrained transition

→ App Shell

→ Today



\---



\# 26. BRAND CONSTRAINTS



PBOS V1 brand identity is LOCKED.



Do not:



\- redraw logo

\- change geometry

\- add/remove segments

\- introduce RGB

\- introduce gaming neon

\- add HUD graphics

\- add random particles

\- add fake technical data

\- add orbiting elements

\- invent another splash identity



The splash can be cinematic.



The application remains calm and restrained.



\---



\# 27. IMPLEMENTATION APPROACH



Before coding:



1\. inspect current repo

2\. inspect existing state/data architecture

3\. inspect existing routing

4\. inspect existing Settings implementation

5\. inspect existing onboarding implementation

6\. inspect Electron/startup architecture

7\. inspect existing reusable UI primitives

8\. inspect current tests



Then produce a concise implementation plan.



Implement in coherent increments.



Suggested order:



A. Settings persistence/model

B. Settings Overview

C. Performance \& Planning settings

D. AI/Privacy/Data settings

E. Notifications/Appearance/App behavior

F. Onboarding state model

G. Welcome

H. Personal Setup

I. Connect Systems

J. Review \& Launch

K. First-boot state

L. cinematic splash integration

M. short startup

N. startup routing

O. Reduced Motion/fallbacks

P. startup recovery

Q. integration tests

R. packaged Electron verification



Adjust order only when repository architecture gives a strong reason.



\---



\# 28. DATA \& MIGRATION SAFETY



Do not destroy existing local development data unnecessarily.



If schema/state changes are required:



\- use appropriate migrations

\- make defaults explicit

\- preserve backwards compatibility where reasonable

\- document migration assumptions

\- validate startup behavior for existing installations



Do not equate:



missing first\_boot flag



with:



definitely first-ever installation



without considering existing development installations/migration behavior.



Provide a safe migration/default strategy.



\---



\# 29. REQUIRED TESTING



At minimum verify:



\### Settings



\- base settings persist

\- mode overrides do not overwrite baseline

\- temporary overrides apply correctly

\- effective configuration resolves correctly

\- AI-disabled state works

\- permission changes persist

\- destructive actions require appropriate safeguards

\- Reduced Motion preference persists



\### Onboarding



\- fresh setup starts correctly

\- progress persists

\- onboarding resumes correctly

\- partial setup remains valid

\- optional domains do not block launch

\- Review \& Launch persists completion

\- completed onboarding routes to Today

\- skipped onboarding routes correctly



\### Startup



\- cinematic splash plays for intended first experience

\- first-boot flag persists

\- cinematic splash does not replay

\- interrupted onboarding uses short splash

\- completed onboarding uses short splash → Today

\- skipped onboarding uses short splash → Today

\- Reduced Motion works

\- video failure falls back safely

\- slow initialization does not loop animation

\- startup failure reaches recovery/error UI

\- no visible media controls

\- no black/white transition flash where avoidable



Also run the repository's applicable:



\- typecheck

\- lint

\- unit tests

\- integration tests

\- build

\- Electron runtime checks



Do not claim PASS unless actually run.



\---



\# 30. DOCUMENTATION



Update implementation status in the relevant documentation.



Ensure:



`Design Assets/15 - Settings \& Preferences/README.md`



exists.



Ensure:



`Design Assets/16 - Onboarding \& Initial Setup/README.md`



exists.



Preserve:



`README-DAY15B-STARTUP-MOTION.md`



as the detailed startup source of truth.



Document:



\- what was implemented

\- files changed

\- migrations/state changes

\- tests run

\- results

\- known limitations

\- remaining issues



Do not rewrite locked product decisions merely to match implementation convenience.



\---



\# 31. DO NOT EXPAND SCOPE



This task is NOT permission to implement:



\- Day 16 Global Search/Commands

\- mature agent orchestration

\- multi-agent companions

\- mobile application

\- cloud synchronization architecture

\- mature RAG/vector search

\- SaaS account system

\- unrelated visual redesign

\- V2/V3 functionality



Stay within Day 14 + Day 15.



\---



\# 32. STOP CONDITIONS



Stop and report rather than silently improvising if:



\- implementation conflicts with locked product architecture

\- a reference requires functionality that does not exist and would require major new architecture

\- current data architecture makes a locked requirement unsafe

\- startup assets are missing/corrupt

\- migration could destroy user data

\- a major dependency is required that materially changes architecture



Use:



`UI ↔ ARCHITECTURE REVIEW REQUIRED`



for genuine UI/product vs engineering conflicts.



\---



\# 33. FINAL REPORT FORMAT



When finished, report:



\## Implementation Summary

What was implemented.



\## Settings

What Day 14 functionality is operational.



\## Onboarding

What Day 15A functionality is operational.



\## Startup \& Motion

What Day 15B functionality is operational.



\## Data / State Changes

Schemas, migrations, stores or persistence changes.



\## Files Changed

Important files created/modified.



\## Tests Run

Exact commands and results.



\## Runtime Verification

What was manually/runtime verified.



\## Remaining Issues

Anything incomplete or uncertain.



\## Architecture Conflicts

Any `UI ↔ ARCHITECTURE REVIEW REQUIRED` items.



\## Final Status



Use one of:



`PASS`



`PARTIAL PASS`



`BLOCKED`



Do not report PASS unless Day 14 + Day 15 behavior has genuinely been implemented and tested.



\---



\# FINAL IMPLEMENTATION PRINCIPLE



Do not optimize for matching screenshots quickly.



Optimize for implementing the correct PBOS product model using reusable architecture.



The generated references provide the V1 structure.



The documentation provides the rules.



The existing codebase provides the engineering reality.



Reconcile all three carefully.



The first PBOS launch should feel memorable once.



Every launch after it should feel fast.

