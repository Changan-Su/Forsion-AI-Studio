# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All frontend commands run from the `client/` directory:

```bash
cd client
npm install
npm run dev      # Dev server on http://localhost:50173
npm run build    # Production build
npm run preview  # Preview production build
```

No lint or test runner is configured — do not add them unless explicitly requested.

**Docker (from repo root):**
```bash
docker compose up -d                 # Full stack
docker compose build frontend        # Rebuild frontend only
```

## Architecture

This repo is the **React/Vite frontend** only. The backend (`server-node`) is a separate repo, not present here. During development, Vite proxies `/api` and `/admin` to `http://localhost:3001`.

**Key files:**
- `client/App.tsx` — Large monolithic component that holds most global state. New top-level features typically go here.
- `client/config.ts` — Runtime API URL resolution. Never hardcode API URLs; use `API_BASE_URL` from here.
- `client/types.ts` — Shared TypeScript interfaces (`User`, `ChatSession`, `Message`, etc.)
- `client/constants.ts` — Model configs, `UPPER_SNAKE_CASE` constants, localStorage keys.
- `client/services/backendService.ts` — Primary REST API wrapper. All backend calls go through service modules, not directly from components.

**Other services:**
- `geminiService.ts` — Google Gemini API (streaming)
- `externalApiService.ts` — OpenAI / DeepSeek wrapper
- `imageGenerationService.ts` — Image generation

**Environment variables:**
| Variable | Purpose | Loaded from |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key | `../.env` (repo root) |
| `VITE_API_URL` | Override API base URL at build time | `client/.env` |
| `BACKEND_URL` | Backend URL for Docker/Nginx | `.env` |

Vite loads env from the **parent directory** (`../`), not `client/`.

## Code Conventions

**Structure:**
- Components in `client/components/` — PascalCase filenames
- Services/utilities — camelCase filenames
- Domain types — `client/types.ts`; constants — `client/constants.ts`
- Path alias `@/` maps to `client/` root

**Formatting:** 2-space indent, single quotes in TS/TSX, double quotes in JSX attributes, semicolons required.

**Import order:** external packages → local modules; React import first; named imports only (no wildcards).

**State patterns:**
- Use `useRef` for mutable objects like `AbortController` (not state)
- Use union string literals for constrained values: `'light' | 'dark'`
- Enums: `PascalCase` name, `UPPER_SNAKE_CASE` values

**Error handling pattern:**
```tsx
try {
  const result = await backendService.someAction();
} catch (e: any) {
  if (e?.code === 'AUTH_REQUIRED' || e?.name === 'AuthRequiredError') {
    clearAuthState('Session expired. Please sign in again.');
    return;
  }
  console.error('Action failed:', e);
}
```
- Auth token is `localStorage.getItem('auth_token')`, sent as `Authorization: Bearer <token>`
- Network errors detected with `instanceof TypeError` in service layer
- Optional operations (usage logging) fail silently — never block the UI

**UI:**
- Three theme presets: `default` (Cyber Tech), `notion`, `monet` — new UI must respect `themePreset` logic
- Icons: `lucide-react` only
- UI copy uses both English and Chinese — keep consistent with existing strings

## Important Patterns

- **Streaming responses:** Use `AbortController` for cancellation; maintain the existing streaming pattern when adding chat features.
- **File uploads:** Images/PDFs/Word docs are Base64-encoded before sending to the API.
- **Agentic changes:** Keep frontend changes self-contained. Do not reference or modify `server-node` code.
