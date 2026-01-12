# Credit Card Benefits Tracker

![Screenshot](screenshot.png)

A web application to track credit card benefits for Amex Platinum and Chase Sapphire Reserve, with usage tracking, progress visualization, and activation reminders.

## Features

- **Track Benefits**: Monitor all your credit card benefits in one place
- **Progress Visualization**: Visual progress bars showing usage status
  - Green: Completed
  - Yellow: Pending
  - Red: Missed/Expired
- **Multiple Reset Frequencies**: Annual, twice-yearly, quarterly, and monthly tracking
- **Activation Tracking**: Highlight benefits requiring activation with acknowledgment toggle
- **Notes**: Add notes about how you used each benefit
- **Expiration Reminders**: See when benefits expire and how many days remain
- **Multi-Card Support**: Mix Amex Platinum and Chase Sapphire Reserve benefits

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Language**: TypeScript
- **Backend**: [Hono](https://hono.dev/) - Lightweight web framework
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Storage**: JSON file (`data/benefits.json`)

## Project Structure

```
dumb-benefits/
├── README.md                    # This file
├── AGENTS.md                    # Agent instructions for development
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── data/
│   └── benefits.json            # Benefits data (JSON storage)
├── src/                         # Backend (Hono API)
│   ├── index.ts                 # Application entry point
│   ├── api/
│   │   ├── routes.ts            # API route definitions
│   │   └── handlers.ts          # Request handlers
│   ├── models/
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── storage.ts           # JSON file operations
│   ├── services/
│   │   └── benefits.ts          # Business logic
│   ├── utils/
│   │   └── dates.ts             # Date utilities
│   └── __tests__/               # Backend tests
│       ├── dates.test.ts
│       ├── benefits.test.ts
│       └── routes.test.ts
└── client/                      # Frontend (React)
    ├── index.html
    └── src/
        ├── main.tsx             # Entry point
        ├── App.tsx              # Main application
        ├── index.css            # Global styles
        ├── api/
        │   └── client.ts        # API client
        ├── components/
        │   ├── ProgressBar.tsx
        │   ├── BenefitCard.tsx
        │   ├── EditModal.tsx
        │   └── CardHeader.tsx
        ├── pages/
        │   ├── Dashboard.tsx
        │   └── CardDetail.tsx
        ├── types/
        │   └── index.ts
        └── utils/
            └── dateUtils.ts

e2e/                             # Playwright E2E tests
├── playwright.config.js
└── browser.test.js
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed (version 1.0.0+)

### Installation

```bash
# Install dependencies
bun install
```

### Running the Application

```bash
# Run both servers (single terminal, both run in background)
bun run dev

# Or run separately:
# Terminal 1: Backend API (port 3000)
bun run src/index.ts

# Terminal 2: Frontend dev server (port 5173)
bun run dev:client
```

The frontend proxies API requests to the backend automatically in development.

Then open http://localhost:5173 in your browser.

### Building for Production

```bash
# Build frontend
bun run build

# The backend serves the built files automatically in production
```

### Running Tests

```bash
# Run backend unit tests
bun test src

# Run E2E tests
bun run test:e2e

# Install Playwright browsers
bun run test:e2e:install
```

### Linting

```bash
# Run oxlint
bun run lint

# Run with all plugins
bun run check
```

## Seeded Benefits

### Amex Platinum (Calendar Year Reset)

1. **Uber Cash** - $200 annually for Uber rides and Eats (monthly reset)
2. **Saks Fifth Avenue** - $100 twice-yearly ($50 each 6-month period)
3. **Airline Fee Credit** - $200 annually (requires airline selection)

### Chase Sapphire Reserve (Anniversary Reset)

1. **Travel Credit** - $300 annually for any travel purchase
2. **Global Entry/TSA PreCheck** - $120 every 4 years

## API Endpoints

```
GET    /api/cards           - List all credit cards
GET    /api/benefits        - List all benefits (filter by cardId)
GET    /api/benefits/:id    - Get single benefit
PATCH  /api/benefits/:id    - Update benefit (currentUsed, notes, status)
PATCH  /api/benefits/:id/activate - Toggle activation acknowledgment
GET    /api/reminders       - Get upcoming expirations
GET    /api/stats           - Get overall statistics
```

## Data Model

### Credit Card
```typescript
{
  id: string;
  name: string;
  annualFee: number;
  resetBasis: 'calendar-year' | 'anniversary';
  color: string;
}
```

### Benefit
```typescript
{
  id: string;
  cardId: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  creditAmount: number;
  currentUsed: number;
  resetFrequency: 'annual' | 'twice-yearly' | 'quarterly' | 'monthly';
  activationRequired: boolean;
  activationAcknowledged: boolean;
  startDate: string;
  endDate: string;
  notes: string;
  status: 'pending' | 'completed' | 'missed';
  category: string;
  periods?: BenefitPeriod[];
}
```

## License

MIT
