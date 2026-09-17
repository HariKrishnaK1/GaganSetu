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
│       ├── App.tsx                # Mission controls, flight deck & Atlas archive UI
│       ├── components/
│       │   └── MissionMap.tsx      # Geographic and schematic map views
│       ├── integrations/
│       │   ├── api.ts              # MongoDB Atlas cloud client
│       │   └── webmcp.ts           # Optional browser automation tools
│       ├── styles/                # Base styles, themes and animations
│       └── assets/                # Bundled artwork
├── backend/
│   └── src/
│       ├── db.ts                  # MongoDB Atlas Mongoose connection & lifecycle
│       ├── server.ts              # Express API server for mission telemetry & cloud archive
│       ├── models/
│       │   └── MissionRun.ts      # Mongoose schema for persistent simulation runs
│       └── model/
│           ├── network.ts         # Pads, corridors, geometry and aerodynamic vectors
│           └── simulator.ts       # Simulation state, energy, PNR, fleet & anti-herding
├── .env.example                   # Environment variable template
├── .env                           # Local credentials (ignored by Git)
├── package.json                  # Shared dependencies and commands
├── vite.config.ts                # Frontend root, API proxy and build output
└── dist/                         # Generated production site
```

`frontend/` contains the flight deck interface. `backend/src/model/` contains the pure simulation and routing logic. `backend/src/server.ts` provides a secure Node.js/Express API service connecting to **MongoDB Atlas** via Mongoose, ensuring credentials in `.env` remain private.

## Run locally

Run commands from the project root using Node.js:

```sh
npm ci
```

### 1. Configure MongoDB Atlas (Optional but Recommended)
Copy `.env.example` to `.env` and set your MongoDB Atlas connection string:
```env
PORT=5050
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/gagansetu?retryWrites=true&w=majority
```

### 2. Start Application
```sh
# Start both Backend API server & Frontend UI concurrently:
npm run dev:all

# Or run separately:
npm run server   # Starts Express API server on http://localhost:5050
npm run dev      # Starts Vite client on http://localhost:5173
```

```sh
npm run build     # Type-check and generate production build in dist/
npm run preview   # Serve the production build locally
npm run lint      # Check code quality via oxlint
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
