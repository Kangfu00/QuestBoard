# Visible dust and four dayparts

User sees dust but says there is too little and asks about time-based atmosphere. Existing code has9 tiny low-opacity particles and a binary06:00/18:00 day/night switch.

- [x] Add persisted dustDensity0–1 (default.65), with0–60 bounded particles; no implicit storage write for old preferences. Increase visibility modestly and stagger sizes/drift.
- [x] Auto lighting uses browser-local time: morning06:00–09:59, day10:00–15:59, evening16:00–18:59, night19:00–05:59. Keep existing day/night/off values and add explicit morning/evening choices.
- [x] Show actual resolved phase and HH:mm in auto mode inside existing settings menu; manual selection clearly says selected manually. One timer targets the next local minute, bounded250–60,000ms, only visible+mounted+auto. Paint, hint and scheduling share a single clock snapshot.
- [x] Add distinct gold morning, clear day, amber evening and cool night/warm-pool paint layers beneath papers. Preserve pointer-safe/3D-safe composition; native visual legibility remains unverified.
- [x] Keep all rain/tavern toggles, master/layer volumes, real audio status hints and save compatibility. Reduced-motion removes particles/flicker; hide pauses and teardown releases all UI resources.
- [x] Behavioral RED→GREEN tests for density bounds/persistence and all phase boundaries, auto/manual controls, hidden return, status/focus preservation. Full suite/syntax and independent scoped review; native visual result requires user feedback because browser access remains denied.

Root coordinates and documents. Controller agent owns atmosphere.mjs/tests; visual agent owns atmosphere.css. Particle variables: --dust-x/y/size/duration/delay/dx/dy. Decorative layer children morning/day/evening/night/dust; dataset.lighting is resolved phase or off, data-dust remains toggle. No dependencies, data/schema changes, deployment or real quest-data access.

Verification: atmosphere23/23; atmosphere+ambience+bootstrap49/49; full npm test435/435; npm run check26 modules. Independent source review and8 targeted density/daypart regressions passed with no concrete correctness findings. Actual dust/lighting appearance remains unverified without browser access. Optional user visual feedback requested after Ctrl+F5.
