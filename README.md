# <img src="public/favicon.svg" width="32" height="32" alt="icon"> Use Your Benefits

![Screenshot](public/screenshot.png)

A fully static web application to track credit card benefits for Amex Platinum and Chase Sapphire Reserve. Import your CSV statements from Amex and Chase to automatically track benefit usage. All data is stored locally in your browser and never sent to any servers.

[![Try it live](https://img.shields.io/badge/Try_it_live-lg.github.io-10b981?style=for-the-badge&logo=github)](https://lg.github.io/use-your-benefits)

## Features

- 📥 **Automatic CSV Import**: Import transactions from both Amex and Chase
- 📋 **Track Benefits**: Monitor all your credit card benefits in one place
- 💳 **Multi-Card Support**: Mix Amex Platinum and Chase Sapphire Reserve benefits
- 📊 **Progress Visualization**: Visual progress bars showing usage status
- 📅 **Multiple Reset Frequencies**: Annual, twice-yearly, quarterly, and monthly tracking
- 🔔 **Enrollment Tracking**: Highlight benefits requiring enrollment
- 📆 **Historical View**: Look back at prior years' benefit usage
- 🙈 **Hide Benefits**: Ignore benefits you don't use
- 🔍 **Transaction Viewer**: Debug which transactions match which benefits
- 🔒 **Privacy-First**: All user data stored locally in your browser
- 🤖 **Vibe Coded**: Built with [Claude](https://claude.ai) and [MiniMax](https://minimaxi.com) in [OpenCode](https://opencode.ai), so enjoy the bugs!

## Importing Transactions

Import your credit card statements to automatically track benefit credits. All processing happens client-side — your data never leaves your browser.

### American Express

1. Go to [americanexpress.com/activity](https://global.americanexpress.com/activity) and set your date range from 01-01-2024 to today
2. Click **Download** → **CSV** (Include all additional transaction details) → **Download**
3. In the app, open **Transactions** and drag/drop your CSV file

### Chase

1. Go to [Chase Account Activity](https://secure.chase.com/web/auth/dashboard#/dashboard/accountDetails/downloadAccountTransactions/index)
2. Select your Sapphire Reserve card and set your date range (note: exporting can be finicky, try different ranges if it fails)
3. Click **Download** and select **CSV**
4. In the app, open **Transactions** and drag/drop your CSV file

## Supported Benefits

### American Express Platinum

| Benefit | Annual Value | Reset Frequency | Enrollment Required |
|---------|--------------|-----------------|---------------------|
| Hotel | $600 | Twice-yearly ($300 each) | No |
| Uber One | $120 | Annual | No |
| Airline Fee | $200 | Annual | Yes |
| CLEAR Plus | $209 | Annual | No |
| Resy | $400 | Quarterly ($100 each) | Yes |
| Digital Entertainment | $300 | Monthly ($25/mo) | Yes |
| lululemon | $300 | Quarterly ($75 each) | Yes |
| Walmart+ | $155 | Monthly (~$12.95/mo) | No |
| Saks Fifth Avenue | $100 | Twice-yearly ($50 each) | Yes |
| Oura Ring | $200 | Annual | Yes |
| Equinox | $300 | Annual | Yes |

### Chase Sapphire Reserve

| Benefit | Annual Value | Reset Frequency | Enrollment Required |
|---------|--------------|-----------------|---------------------|
| Travel | $300 | Annual | No |
| The Edit Hotel | $500 | Annual | No |
| Exclusive Tables Dining | $300 | Twice-yearly ($150 each) | No |
| DoorDash | $300 | Monthly ($25/mo) | Yes |
| Lyft | $120 | Monthly ($10/mo) | Yes |
| Peloton | $120 | Annual | Yes |
| StubHub/viagogo | $300 | Twice-yearly ($150 each) | Yes |

### Limitations

- **Uber Cash**, **DoorDash credits**, and **Lyft credits** are not currently tracked (these credits are loaded directly into their respective apps rather than appearing as statement credits)
- **Global Entry/TSA PreCheck** is not fully functional yet due to its multi-year (4-year) reset cycle
- Benefits are considered "completed" if 50%+ of the credit is redeemed, or if 50%+ of segments are completed

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Language**: TypeScript
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Data Storage**: 
  - Benefit definitions: Static JSON (`/benefits.json`)
  - User data: Browser localStorage

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed (version 1.0.0+)

### Installation

```bash
bun install
```

### Running the Application

```bash
bun dev
```

### Building for Production

```bash
# Build static files to dist/
bun run build

# Preview production build locally
bun run preview
```

### Running Tests

```bash
# Run E2E tests
bun run test:e2e

# Install Playwright browsers (first time only)
bun run test:e2e:install
```

### Linting

```bash
# Run oxlint
bun run lint

# Run with all plugins
bun run check
```

## Deployment

This is a fully static app - no server required. To deploy:

1. Build: `bun run build`
2. Upload contents of `dist/` to any static host:
   - GitHub Pages
   - Netlify
   - Vercel
   - AWS S3 + CloudFront
   - Any web server

## Data Storage

- **Benefit definitions**: Stored in `public/benefits.json` (static, version-controlled)
- **User data**: Stored in browser `localStorage` under key `user-benefits`
  - Usage amounts
  - Enrollment status
  - Ignored/hidden benefits
  - Period-specific tracking

## License

MIT
