# Frontend

The React + Vite browser application lives here:

- `index.html`: entry page.
- `src/main.tsx`: mounts React.
- `src/App.tsx`: mission UI, playback controls, theme selection and results.
- `src/components/`: map and display components.
- `src/integrations/`: browser integration code, including WebMCP.
- `src/styles/`: base layout and the theme/animation system.
- `src/assets/`: imported artwork.
- `public/`: static assets served from the website root.

Use `npm run dev`, `npm run build`, `npm run preview`, and `npm run lint` from the project root. Vite uses this folder as its application root and writes production output to the root-level `dist/` folder.

The simulation engine is imported from `@backend/model/*` and runs in the browser. There is no API request or separate server process between the two folders.
