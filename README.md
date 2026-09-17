# GaganSetu

An air-mobility simulation with hypothetical Hyderabad landing pads, route planning, delayed pad-status updates, diversion scenarios, wind, and fleet views.

## Project structure

```text
GaganSetu/
├── frontend/
│   ├── index.html                 # Browser entry page
│   ├── public/                    # Public files copied into the build
│   └── src/
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Mission controls and application state
│       ├── components/
│       │   └── MissionMap.tsx      # Geographic and schematic map views
│       ├── integrations/
│       │   └── webmcp.ts           # Optional browser automation tools
│       ├── styles/                # Base styles, themes and animations
│       └── assets/                # Bundled artwork
├── backend/
│   └── src/model/
│       ├── network.ts             # Pads, corridors, geometry and routing
│       └── simulator.ts           # Simulation state, energy and scenarios
├── docs/
│   ├── PROJECT_REVIEW.md          # Historical code-review snapshot
│   └── reference-images/          # Map-tile experiments
├── .openai/hosting.json           # Existing static hosting configuration
├── package.json                  # Shared dependencies and commands
├── package-lock.json
├── vite.config.ts                # Frontend root, imports and build output
├── tsconfig*.json                # Shared TypeScript configuration
└── dist/                         # Generated production site (ignored)
```

`frontend/` contains the interface and browser integrations. `backend/` contains the framework-independent simulation and routing logic. **There is currently no HTTP backend server, API, or database.** The frontend imports this logic and runs it in the browser, preserving existing behavior. The backend folder is not a place for secrets or private server-only code.

Frontend imports use `@backend/model/network` and `@backend/model/simulator`. Vite and TypeScript resolve `@backend/` to `backend/src/`. Model modules do not import UI components.

## Run locally

Run commands from the project root, using the existing Node.js installation (verified with Node 22.21).

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. There is one dependency installation and one development process; no separate backend process is required.

```sh
npm run build     # Type-check and generate the production site in dist/
npm run preview   # Serve the production build locally
npm run lint      # Check frontend, model and configuration code
```

## Where to make changes

- Interface and controls: `frontend/src/App.tsx`
- Maps and markers: `frontend/src/components/MissionMap.tsx`
- Colors, styling and animations: `frontend/src/styles/`
- Browser automation: `frontend/src/integrations/webmcp.ts`
- Network data and route geometry: `backend/src/model/network.ts`
- Simulation rules and calculations: `backend/src/model/simulator.ts`

The review in `docs/PROJECT_REVIEW.md` predates this reorganization and some subsequent features. Its old `src/` paths and findings describe that historical snapshot. Reference images are retained for documentation and are not runtime assets.

## Model scope

Landing sites and operational data are hypothetical. The simulation uses illustrative aircraft parameters and corridor assumptions; it is not a real flight-planning or air-traffic-control service. Geographic map tiles and web fonts require network access; the schematic view renders locally.
