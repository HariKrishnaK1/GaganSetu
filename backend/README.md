# Simulation and routing logic

This folder holds GaganSetu's non-UI logic:

- `src/model/network.ts`: hypothetical pads, permitted corridors, geographic calculations, and route finding.
- `src/model/simulator.ts`: configuration, flight state, status updates, energy calculations, diversions, and scenario evaluation.

Despite the folder name, this is not a running backend server. These TypeScript modules are bundled into the frontend and execute in the browser. Do not place credentials or private server-only data here.

Run development, build and lint commands from the project root. The shared TypeScript configuration includes this folder. Frontend imports use the `@backend/` alias; model modules use relative imports internally.
