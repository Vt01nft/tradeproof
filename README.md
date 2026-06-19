# TradeProof

TradeProof is a constitution-bound AI trading agent for the BNB Hack: AI Trading Agent Edition.

It generates backtestable strategy decisions from market signals, runs every proposed trade through a visible "trade court", and produces a verifiable trade receipt before any wallet action is prepared.

## Why It Exists

Most trading agents optimize for action. TradeProof optimizes for accountable action.

The agent must prove:

- Which CoinMarketCap-style signals informed the decision.
- Which risk gates passed or failed.
- Why the agent is allowed to trade under the user's constitution.
- What Trust Wallet action is prepared, if any.
- How the agent can be represented as an on-chain BNB agent.

## Hackathon Tracks

Primary target:

- Track 2: Strategy Skills

Stretch target:

- Track 1-ready demo with quote-only or paper-trade execution.

Special prize alignment:

- Best use of CoinMarketCap Data & Signal.
- Best use of Trust Wallet Agent Kit.
- Best use of BNB AI Agent SDK.

## Current Demo

The local demo includes:

- A professional dashboard for BNB, CAKE, and USDT scenarios.
- A simple TradeProof logo in `public/logo.svg`.
- A deterministic strategy engine in `src/lib/strategy.ts`.
- Adjustable user constitution controls.
- Trade court votes: Analyst, Skeptic, and Risk Officer.
- Risk gates for liquidity, volatility, drawdown, sizing, sentiment, and news risk.
- A trade receipt with strategy rules, CMC source labels, Trust Wallet action, BNB agent metadata, and receipt hash.

## Sponsor Architecture

### CoinMarketCap Agent Hub

Role: market truth layer.

Planned live inputs:

- Latest quotes and market data.
- Technical momentum.
- Liquidity / market-pair quality.
- Sentiment and news risk.
- Derivatives pressure.

### Trust Wallet Agent Kit

Role: self-custody execution boundary.

Planned live actions:

- Wallet and balance context.
- Token risk checks.
- Quote-only swap intent.
- User-approved execution path.

The agent should not hold user keys.

### BNB AI Agent SDK

Role: agent identity and commerce layer.

Planned live actions:

- ERC-8004 agent identity metadata.
- ERC-8183-ready strategy job endpoint.
- Future paid strategy evaluation jobs.

## Getting CoinMarketCap Access

Option 1: API key.

1. Go to https://pro.coinmarketcap.com/signup.
2. Create a free Developer Portal account.
3. Copy your API key from the portal.
4. Add it to a local `.env` file:

```bash
CMC_API_KEY=your_key_here
```

TradeProof reads this key from the local API proxy, not from browser code. CoinMarketCap's public API page says keyless trial routes are available for first tests, and authenticated access uses `X-CMC_PRO_API_KEY`.

Option 2: Agent Hub.

CoinMarketCap documents Agent Hub paths for MCP, CMC CLI, x402, IDE integrations, and reusable agent skills:

- https://pro.coinmarketcap.com/api/documentation/ai-agent-hub
- https://coinmarketcap.com/api/agent/

For hackathon speed, start with the API key path and use Agent Hub/MCP in the submission narrative or live adapter if credentials are ready.

## Local Development

```bash
npm install
npm run dev:full
```

This starts:

- Vite frontend at `http://127.0.0.1:5173`
- Local CMC proxy at `http://127.0.0.1:8787`

Build check:

```bash
npm run build
```

## Environment Variables

Create `.env` when keys are available:

```bash
CMC_API_KEY=
TRUST_WALLET_CLIENT_ID=
TRUST_WALLET_CLIENT_SECRET=
BNB_AGENT_PRIVATE_KEY=
```

Never commit real secrets.

## DoraHacks Submission Draft

Project name: TradeProof

Short description:

TradeProof is a constitution-bound AI trading agent that turns CMC market signals into backtestable strategy decisions, runs each proposed trade through a visible risk court, and prepares self-custody execution through Trust Wallet with BNB agent identity metadata.

Long description:

TradeProof is designed for the next generation of accountable AI trading agents. Instead of simply asking an LLM what to buy, TradeProof forces every decision through a user-defined constitution and produces a trade receipt that explains why the action is allowed or blocked.

The system uses CoinMarketCap-style market data as its signal layer, including price momentum, sentiment, liquidity, volatility, news risk, and derivatives pressure. A trade court made of Analyst, Skeptic, and Risk Officer roles evaluates each trade. The result is a strategy output with rules, invalidation, confidence, and risk gates that can be backtested.

For the Track 1-ready path, TradeProof prepares quote-only or paper-trade actions through a Trust Wallet Agent Kit adapter so users retain signing control. It also prepares BNB AI Agent SDK metadata for ERC-8004 identity and ERC-8183 strategy-job workflows.

The core idea is simple: an autonomous trading agent should not just act. It should prove why it is allowed to act.

## Demo Script

1. Open the dashboard.
2. Show the TradeProof constitution: max position, volatility, liquidity, execution mode.
3. Select BNB and show an approved or held trade receipt.
4. Select CAKE and show how high RSI or volatility blocks execution.
5. Explain that CMC powers the signal layer, Trust Wallet protects self-custody execution, and BNB AI Agent SDK gives the agent identity and future commerce rails.
6. Export or show the receipt hash as the proof artifact.

## Solo Builder

Built by a solo builder for the BNB Hack: AI Trading Agent Edition.
