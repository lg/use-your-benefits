# Agent Instructions for Credit Card Benefits Tracker

This document provides instructions for AI agents working on the Credit Card Benefits Tracker project.

## Core Principles

1. **Use Bun exclusively** - All commands must use `bun` (not `npm`, `yarn`, or `pnpm`)
2. **TypeScript everywhere** - All code must be written in TypeScript
3. **JSON for storage** - Data is stored in `data/benefits.json`
4. **UTC timezone** - All date handling assumes UTC
5. **Calendar year for Amex, anniversary for Chase** - Reset dates vary by card

## Development Commands

### Installing Dependencies

```bash
# Root dependencies (backend)
bun install

# Frontend dependencies
cd client && bun install && cd ..
```

### Running the Application

```bash
# Terminal 1: Backend API (port 3000)
bun run src/index.ts

# Terminal 2: Frontend dev server (port 5173)
cd client && bun run dev
```

### Building for Production

```bash
# Build frontend
cd client && bun run build

# Backend serves built files in production mode
```

### Linting

```bash
# Run oxlint
bun run lint

# Run with all plugins
bun run check
```

## Code Conventions

### TypeScript

- Use strict TypeScript with proper types
- Avoid `any` - use explicit types or `unknown` with proper handling
- Use interfaces for object types, types for unions/primitives
- Export all types used across modules

### File Structure

```
src/               # Backend code (Hono)
├── index.ts       # Entry point
├── api/           # API routes and handlers
├── models/        # Types and storage
├── services/      # Business logic
└── utils/         # Helper functions

client/            # Frontend code (React)
├── src/
│   ├── api/       # API client
│   ├── components/# React components
│   ├── pages/     # Page components
│   ├── types/     # TypeScript types
│   └── utils/     # Utilities
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

## API Design

All endpoints return the following structure:

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
}
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cards` | List all credit cards |
| GET | `/api/benefits` | List benefits (optional `?cardId=`) |
| GET | `/api/benefits/:id` | Get single benefit |
| PATCH | `/api/benefits/:id` | Update benefit |
| PATCH | `/api/benefits/:id/activate` | Toggle activation |
| GET | `/api/reminders` | Get expiring benefits |
| GET | `/api/stats` | Get overall statistics |

## Adding New Features

### Adding a New Credit Card

1. Add card to `data/benefits.json` `cards` array
2. Add benefits in `benefits` array with `cardId` referencing the new card

### Adding a New Benefit

1. Add to `data/benefits.json` `benefits` array
2. Define all required fields (id, cardId, name, amounts, dates, etc.)
3. If benefit has activation, set `activationRequired: true`
4. If benefit has multiple periods, add `periods` array

### Modifying Data Model

1. Update types in `src/models/types.ts` (backend)
2. Update types in `client/src/types/index.ts` (frontend)
3. Update seed data in `data/benefits.json` if needed
4. Update storage/service logic as needed

## Testing Guidelines

When adding tests:

- Use `bun test` for unit tests
- Place tests alongside source files with `.test.ts` extension
- Mock storage layer for isolated testing

## Deployment

For production deployment:

1. Build frontend: `cd client && bun run build`
2. Configure backend to serve `../dist` static files
3. Ensure JSON file has proper write permissions
4. Set up process manager (pm2, systemd, etc.)

## Common Issues

### Port Conflicts

- Backend: 3000
- Frontend dev: 5173
- Check for running processes: `lsof -i :3000` or `lsof -i :5173`

### Changes Not Reflecting

- Clear browser cache
- Restart both frontend and backend
- Rebuild if in production mode

### JSON File Permissions

- Ensure the user running the server can write to `data/benefits.json`
