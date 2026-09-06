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

Import your credit card statements to automatically track benefit credits. CSV imports are processed in your browser.

1. Open **Transactions** and select your card.
2. Choose **Download manually** for the bank's export steps, or **Use an LLM agent** for a copyable prompt.
3. If using an agent, click **Copy prompt**, paste it into an LLM agent with browser and Downloads access, and help with sign-in or MFA if needed.
4. Once downloaded, drag the CSV from **Downloads** into the app, or use **Choose File**.

The prompts include the export settings for Chase or Amex, request all available posted transaction history, and tell the agent to save one CSV in Downloads for you to upload manually. Use **View prompt** to read or copy the instructions yourself. Repeat for your other card.

## Supported Benefits

Amounts below reflect the 2026 policies. The app uses dated definitions for historical views and shows unavailable periods in gray. Hover over a period for its allowance, effective dates, and credit details.

### American Express Platinum

| Benefit | Annual Value | Reset Frequency | Enrollment Required |
|---------|--------------|-----------------|---------------------|
| Hotel | $600 | Twice-yearly ($300 each) | No |
| Uber One | $120 | Annual | No |
| Airline Fee | $200 | Annual | Yes |
| CLEAR Plus | $219 from July 1, 2026 | Annual, previously $209 | No |
| Resy | $400 | Quarterly ($100 each) | Yes |
| Digital Entertainment | $300 | Monthly ($25/mo) | Yes |
| lululemon | $300 | Quarterly ($75 each) | Yes |
| Walmart+ | $155.40 plus applicable tax | Monthly ($12.95 plus tax) | No |
| Saks Fifth Avenue | $50 in 2026 | Ended June 30, 2026 | Yes |
| Oura Ring | $200 | Annual | Yes |
| Equinox | $300 | Annual | Yes |

### Chase Sapphire Reserve

| Benefit | Annual Value | Reset Frequency | Enrollment Required |
|---------|--------------|-----------------|---------------------|
| Travel | $300 | Account anniversary | No |
| The Edit Hotel | $500 | Annual, up to $250 per qualifying stay | No |
| Select Hotels | $250 in 2026 | Available only during 2026 | No |
| Exclusive Tables Dining | $300 | Twice-yearly ($150 each) | No |
| DoorDash | $300 | Monthly ($25/mo) | Yes |
| Lyft | $120 | Monthly ($10/mo) | Yes |
| Peloton | $120 | Monthly ($10/mo) | Yes |
| StubHub/viagogo | $300 | Twice-yearly ($150 each) | Yes |

### Calculations and account settings

- **Still available** adds the unused allowances in active periods. Expired allowances and future periods contribute zero. Amounts are based on imported credits, so missing history can overstate availability.
- **Completed** means at least 50% of a period's allowance was used. Any unused dollars remain available until the period ends.
- **Airline Fee** can show an inferred airline from a reimbursement's description or a same-amount airline charge in the preceding 14 days. Detection uses only the selected year's credits and leaves conflicting evidence unresolved. The hint does not confirm the selection in your Amex account.
- **Uber Cash** is excluded from all calculations. **DoorDash** and **Lyft** usage cannot currently be read from a card statement.
- **Global Entry/TSA PreCheck** retains its four-year eligibility cycle across years, while a reimbursement contributes to used value only in the year received. A covered cycle does not add another annual allowance. Amex's current limits are $120 for Global Entry or up to $85 for TSA PreCheck. Eligibility depends on having the earlier credit in imported history.
- Set the **Travel credit reset date** shown by Chase in the Travel benefit card. Until that date is provided, the summary shows a `+` and leaves the unknown travel allowance out of Still available.
- Chase's **Manage benefits** menu has a **2025 benefit rollout** setting. The default is October 26 for existing cardholders who applied before June 23, 2025. Select June 23 for the new-card rollout.

### Updating policy history

Each benefit in `public/benefits.json` has a `policies` array. A policy gives its inclusive `startsOn` and optional `endsOn` dates, allowance per reset period, reset frequency, description, and source URLs. A later policy replaces the preceding policy from its start date. Use `newCardStartsOn` for Chase's alternate rollout date.

Changes within an existing period, such as CLEAR's annual cap increase, preserve credits already used in that period. Set `resetOnChange: true` when a new policy explicitly opens a separate allowance, as the September 2025 Amex hotel refresh did. Calendar periods remain visible when unavailable and do not count as missed. Chase Travel uses `resetBasis: "anniversary"` and the reset date stored locally for that account.

The latest definitions were checked on September 6, 2026 against [Amex's current terms](https://global.americanexpress.com/card-benefits/terms/platinum), [the 2025 Amex refresh](https://ir.americanexpress.com/news/investor-relations-news/investor-relations-news-details/2025/Theres-Nothing-Like-Platinum-American-Express-Unveils-Updated-U-S--Consumer-and-Business-Platinum-Cards-Each-with-Over-3500-in-Annual-Value/default.aspx), and [Chase's current terms](https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve). Individual policies include their supporting sources.

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
# Run calculation tests
bun test src/lib

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
- **User data**: Stored in browser `localStorage` under key `use-your-benefits`
  - Imported transactions
  - Enrollment status
  - Ignored/hidden benefits
  - Account reset dates and rollout settings

## License

MIT
