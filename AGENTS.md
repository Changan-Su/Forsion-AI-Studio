# AGENTS

## Scope and layout
- This repo primarily contains the React/Vite front-end in `client/`.
- The backend is referenced as `server-node/` in docs but is not present here; treat it as a separate repo.
- Docker Compose files in the repo are for deployment and ops workflows.

## Quick start (front-end)
- Install: `cd client` then `npm install`.
- Dev server: `npm run dev` (Vite on http://localhost:50173).
- Production build: `npm run build`.
- Preview build: `npm run preview`.

## Build, lint, and test commands
### Front-end (client)
- Build: `npm run build`.
- Dev: `npm run dev`.
- Preview: `npm run preview`.
- Lint: not configured (no eslint config or npm script found).
- Test: not configured (no jest/vitest config or npm script found).
- Run a single test: not applicable (no test runner configured).

### Docker (deployment)
- Full stack (if backend is available separately): `docker compose up -d`.
- Front-end only: `docker compose -f docker-compose.frontend-only.yml up -d`.
- Rebuild images: `docker compose build` (or `docker compose build frontend`).

## Environment and configuration
- Front-end API base URL is resolved at runtime in `client/config.ts`.
- Override API base URL with `VITE_API_URL` (build-time env).
- Vite loads `GEMINI_API_KEY` from the repo root `.env` (see `client/vite.config.ts`).
- Docker front-end config uses `BACKEND_URL` and `FRONTEND_PORT` in `.env`.

## Code style and conventions
### Language and structure
- TypeScript + React 19 with function components and hooks.
- Target/runtime: ES2022, module ESNext, JSX runtime `react-jsx`.
- Path alias: `@/*` maps to the `client/` root.
- Prefer small, focused components under `client/components/`.
- Domain types live in `client/types.ts`.
- Service wrappers and API helpers live in `client/services/`.
- Shared constants in `client/constants.ts`.

### Formatting
- Indentation: 2 spaces.
- Quotes: single quotes in TS/TSX; double quotes inside JSX attributes.
- Semicolons are used consistently.
- Trailing commas are common in multi-line objects/arrays.

### Imports
- Order: external packages first, then local modules.
- Group related imports together; keep React import at top.
- Use explicit named imports for icons and utilities (no wildcard imports).
- Use relative paths for local files; use `@/` alias for cross-folder imports.

### Naming
- Components: `PascalCase` file names and exports.
- Hooks and functions: `camelCase`.
- Types/interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE`.
- Services/utilities: `camelCase` file names and exported functions.

### Types and state
- Define explicit prop types/interfaces for components.
- Use union string literals for constrained state (e.g., theme presets).
- Use `useRef` for mutable objects (e.g., AbortController) rather than state.
- Prefer derived constants over duplicated state where possible.

### Error handling
- Wrap async flows in `try/catch` and log errors with `console.warn`/`console.error`.
- Auth errors use a consistent check: `e.code === 'AUTH_REQUIRED'` or `e.name === 'AuthRequiredError'` and then call `clearAuthState(...)`.
- User-facing errors are surfaced via `setAuthError` or inline message updates.
- For optional operations (e.g., usage logging), fail silently and do not block the UI.

### API and networking
- Use `backendService` and other service modules for API calls.
- Do not hardcode API URLs; rely on `API_BASE_URL` from `client/config.ts`.
- Prefer stream-capable methods for chat responses where available.

### UI and UX
- The UI supports light/dark and multiple theme presets.
- Ensure new UI respects existing theme classes and `themePreset` logic.
- Keep user-visible strings aligned with existing copy (English + Chinese are both used).

## Cursor/Copilot rules
- No `.cursor/rules/` or `.cursorrules` files are present in this repo.
- No `.github/copilot-instructions.md` file is present.
- There is a Cursor command at `.cursor/commands/occam.md` describing the `/occam` simplification workflow.

## Notes for agentic changes
- Avoid adding lint/test scripts unless explicitly requested.
- Avoid introducing new build tooling unless the user asks.
- The backend codebase is not in this repo; keep front-end changes self-contained.
- For backend-related docs or changes, reference the separate `server-node` repo if present.
