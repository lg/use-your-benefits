# Agent Instructions for Keep Your Benefits

This document provides instructions for AI agents working on the Keep Your Benefits project.

## Core Principles

1. **Use Bun exclusively** - All commands must use `bun` (not `npm`, `yarn`, or `pnpm`)
2. **TypeScript everywhere** - All code must be written in TypeScript
3. **Static JSON for definitions** - Benefit definitions stored in `client/public/benefits.json`
4. **localStorage for user data** - User state (usage, activation, ignored) stored in browser localStorage
5. **UTC timezone** - All date handling assumes UTC
6. **Calendar year for Amex, anniversary for Chase** - Reset dates vary by card
7. **Single package.json** - Keep dependencies and scripts at the repo root
8. **No automatic commits** - Never commit changes unless explicitly instructed by the user
9. **Git commands require explicit permission** - Never run `git commit`, `git push`, or any git command that modifies the repository without the user explicitly asking you to do so

## Architecture

This is a **fully static app** with no backend server:

- **Benefit definitions**: Loaded from `/benefits.json` (static file)
- **User data**: Stored in browser `localStorage` under key `user-benefits`
- **Build output**: Static files in `dist/` that can be deployed anywhere

## Development Commands

### Installing Dependencies

```bash
bun install
```

### Running the Application

```bash
# Start Vite dev server (port 5173)
bun run dev
```

Then open http://localhost:5173 in your browser.

### Building for Production

```bash
# Build static files to dist/
bun run build

# Preview production build locally
bun run preview
```

### Linting

```bash
# Run oxlint
bun run lint

# Run with all plugins
bun run check
```

### Testing

```bash
# Run E2E tests
bun run test:e2e

# Install Playwright browsers
bun run test:e2e:install
```

## Code Conventions

### TypeScript

- Use strict TypeScript with proper types
- Avoid `any` - use explicit types or `unknown` with proper handling
- Use interfaces for object types, types for unions/primitives
- Export all types used across modules

### File Structure

```
keep-your-benefits/
├── client/                  # Frontend (React + Vite)
│   ├── public/
│   │   └── benefits.json    # Static benefit definitions
│   └── src/
│       ├── api/             # Data fetching (loads benefits.json)
│       ├── components/      # React components
│       ├── hooks/           # Custom React hooks
│       ├── pages/           # Page components
│       ├── services/        # Business logic (merges data with localStorage)
│       ├── storage/         # localStorage CRUD operations
│       ├── types/           # TypeScript types
│       └── utils/           # Helper functions
├── shared/                  # Shared types and utilities
│   ├── types.ts
│   └── utils.ts
├── e2e/                     # Playwright E2E tests
└── dist/                    # Production build output
```

### Component Design

- Keep components small and focused
- Use TypeScript interfaces for props
- Prefer functional components with hooks
- Use CSS classes from Tailwind, avoid custom CSS when possible

### Tailwind CSS

- Use utility classes for styling
- Custom styles go in `client/src/index.css`
- Color palette: `slate-*` for backgrounds, `emerald` for success, `amber` for pending, `red` for missed

## Data Model Guidelines

### Benefit Status States

- **pending**: Benefit is active, not fully used, hasn't expired
- **completed**: Full credit amount has been used
- **missed**: Benefit expired without being fully used

### Reset Frequencies

- **annual**: Single yearly reset (1 progress segment)
- **twice-yearly**: Two periods per year (2 progress segments)
- **quarterly**: Four periods per year (4 progress segments)
- **monthly**: Monthly tracking (shown as single annual credit with note)

### Progress Bar Segments

- Quarterly: 4 segments
- Twice-yearly: 2 segments
- Annual: 1 segment
- Colors: emerald (completed), amber (pending), red (missed)

### localStorage Schema

User data is stored under the key `user-benefits`:

```typescript
{
  benefits: {
    [benefitId: string]: {
      currentUsed: number;
      activationAcknowledged: boolean;
      status: 'pending' | 'completed' | 'missed';
      ignored: boolean;
      periods?: Record<string, { usedAmount: number; status: string }>;
    }
  }
}
```

## Adding New Features

### Adding a New Credit Card

1. Add card to `client/public/benefits.json` `cards` array
2. Add benefits in `benefits` array with `cardId` referencing the new card

### Adding a New Benefit

1. Add to `client/public/benefits.json` `benefits` array
2. Define all required fields (id, cardId, name, amounts, dates, etc.)
3. If benefit has activation, set `activationRequired: true`
4. If benefit has multiple periods, add `periods` array

### Modifying Data Model

1. Update types in `shared/types.ts`
2. Update client types in `client/src/types/index.ts` if needed
3. Update seed data in `client/public/benefits.json` if needed
4. Update storage/service logic as needed

## Testing Guidelines

### E2E Tests

- E2E tests are in `e2e/` directory
- Tests use Playwright
- Tests clear localStorage before each test to ensure clean state
- Run with `bun run test:e2e`

## Pre-commit Checklist

Before committing changes:

1. **Run checks**: `bun run check`
2. **Run linter**: `bun run lint`

## Deployment

This is a fully static app. To deploy:

1. Build: `bun run build`
2. Upload contents of `dist/` to any static host:
   - GitHub Pages
   - Netlify
   - Vercel
   - AWS S3 + CloudFront
   - Any web server

No backend or server-side runtime required.

## Common Issues

### Port Conflicts

- Dev server: 5173
- Check for running processes: `lsof -i :5173`

### Changes Not Reflecting

- Clear browser cache
- Clear localStorage if testing user data changes
- Restart dev server

### localStorage Issues

- Open browser DevTools → Application → Local Storage to inspect
- Clear with: `localStorage.clear()` in console
