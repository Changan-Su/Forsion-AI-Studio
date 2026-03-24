# AGENTS

## Scope and layout
- This repo primarily contains the React/Vite front-end in `client/`.
- The backend is referenced as `server-node/` in docs but is not present here; treat it as a separate repo.
- Docker Compose files in the repo are for deployment and ops workflows.
- Key directories:
  - `client/` - Main frontend source code
  - `client/components/` - React components (PascalCase filenames)
  - `client/services/` - API wrappers and backend communication
  - `client/src/utils/` - Utility functions and helpers
  - `.cursor/commands/` - Cursor IDE slash commands

## Quick start (front-end)
```bash
cd client
npm install
npm run dev      # Starts Vite dev server on http://localhost:50173
npm run build    # Production build
npm run preview  # Preview production build
```

## Build, lint, and test commands
### Front-end (client)
| Command           | Description                                    |
|-------------------|------------------------------------------------|
| `npm run dev`     | Start dev server (Vite, port 50173)            |
| `npm run build`   | Build for production                           |
| `npm run preview` | Preview production build                       |
| Lint              | Not configured (no eslint config or npm script)|
| Test              | Not configured (no jest/vitest config)         |
| Single test       | Not applicable (no test runner configured)     |

### Docker (deployment)
```bash
docker compose up -d                                    # Full stack
docker compose -f docker-compose.frontend-only.yml up -d  # Front-end only
docker compose build                                    # Rebuild all images
docker compose build frontend                           # Rebuild frontend only
```

## Environment and configuration
| Variable          | Purpose                                               | Location      |
|-------------------|-------------------------------------------------------|---------------|
| `VITE_API_URL`    | Override API base URL (build-time)                    | `.env`        |
| `GEMINI_API_KEY`  | Gemini API key (loaded by Vite from repo root `.env`) | `../.env`     |
| `BACKEND_URL`     | Docker backend URL                                    | `.env`        |
| `FRONTEND_PORT`   | Docker frontend port                                  | `.env`        |

- API base URL is resolved at runtime in `client/config.ts`.
- Development default: `http://localhost:3001/api` (see `client/vite.config.ts` proxy config).
- Production: Same origin with Nginx proxying `/api` to backend.

## Code style and conventions

### Language and structure
- TypeScript + React 19 with function components and hooks.
- Target/runtime: ES2022, module ESNext, JSX runtime `react-jsx`.
- Path alias: `@/*` maps to the `client/` root (see `client/tsconfig.json`).
- Prefer small, focused components under `client/components/`.
- Domain types live in `client/types.ts`.
- Service wrappers and API helpers live in `client/services/`.
- Shared constants in `client/constants.ts`.

### Formatting
- Indentation: 2 spaces.
- Quotes: single quotes in TS/TSX; double quotes inside JSX attributes.
- Semicolons: used consistently.
- Trailing commas: common in multi-line objects/arrays.

### Imports
- Order: external packages first, then local modules.
- Group related imports together; keep React import at top.
- Use explicit named imports for icons and utilities (no wildcard imports).
- Use relative paths for local files; use `@/` alias for cross-folder imports.

Example:
```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { User, ChatSession, Message } from './types';
import { backendService } from './services/backendService';
import { Bot, Cpu, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
```

### Naming
| Type               | Convention         | Example                     |
|--------------------|--------------------|-----------------------------|
| Components         | `PascalCase`       | `ChatArea.tsx`, `Sidebar`   |
| Hooks/functions    | `camelCase`        | `useCallback`, `handleSend` |
| Types/interfaces   | `PascalCase`       | `User`, `ChatSession`       |
| Constants          | `UPPER_SNAKE_CASE` | `DEFAULT_MODEL_ID`          |
| Services/utilities | `camelCase`        | `backendService.ts`         |

### Types and state
- Define explicit prop types/interfaces for components.
- Use union string literals for constrained state (e.g., `'light' | 'dark'`).
- Use `useRef` for mutable objects (e.g., AbortController) rather than state.
- Prefer derived constants over duplicated state where possible.
- Enums use `PascalCase` with `UPPER_SNAKE_CASE` values: `enum UserRole { ADMIN = 'ADMIN' }`.

### Error handling
- Wrap async flows in `try/catch` and log errors with `console.warn`/`console.error`.
- Auth errors: check `e.code === 'AUTH_REQUIRED'` or `e.name === 'AuthRequiredError'`, then call `clearAuthState(...)`.
- User-facing errors: surface via `setAuthError` or inline message updates.
- For optional operations (e.g., usage logging), fail silently and do not block the UI.
- Network errors are detected with `instanceof TypeError` in service layer.

Example error handling pattern:
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

### API and networking
- Use `backendService` and other service modules for API calls.
- Do not hardcode API URLs; rely on `API_BASE_URL` from `client/config.ts`.
- Prefer stream-capable methods for chat responses where available.
- Auth token is stored in `localStorage.getItem('auth_token')` and sent as `Authorization: Bearer <token>`.

### UI and UX
- The UI supports light/dark and multiple theme presets (`default`, `notion`, `monet`).
- Ensure new UI respects existing theme classes and `themePreset` logic.
- Keep user-visible strings aligned with existing copy (English + Chinese are both used).
- Use Lucide icons (`lucide-react`) for iconography.

## Cursor/Copilot rules
- No `.cursor/rules/` or `.cursorrules` files are present in this repo.
- No `.github/copilot-instructions.md` file is present.

### Cursor command: `/occam`
Located at `.cursor/commands/occam.md`. Apply Occam's Razor principle to simplify code:

**When invoked, perform:**
1. Analyze the current code for unnecessary complexity
2. Identify redundant patterns that can be simplified
3. Suggest or apply simplifications that maintain functionality
4. Remove dead code and unused imports/variables
5. Consolidate duplicate logic into reusable functions
6. Simplify conditional logic and reduce nesting
7. Optimize data structures and algorithms where appropriate

**Principles:**
- Simplicity over complexity: Prefer the simplest solution that works
- DRY (Don't Repeat Yourself): Eliminate code duplication
- Clear over clever: Prefer readable code over clever tricks
- Maintain functionality: Never break existing functionality while simplifying

## Notes for agentic changes
- Avoid adding lint/test scripts unless explicitly requested.
- Avoid introducing new build tooling unless the user asks.
- The backend codebase is not in this repo; keep front-end changes self-contained.
- For backend-related docs or changes, reference the separate `server-node` repo if present.
- When modifying components, maintain the existing patterns for streaming responses, theme support, and error handling.
- Be mindful of the AbortController pattern used for canceling in-flight requests.
