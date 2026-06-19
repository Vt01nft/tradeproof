# DoraHacks Submission

## Project

TradeProof

## One-Liner

A constitution-bound AI trading agent that proves why a trade is allowed before it prepares execution.

## Track

Track 2: Strategy Skills, with a Track 1-ready quote-only demo.

## What It Does

TradeProof converts market signals into backtestable strategy decisions, then runs every proposed action through a visible trade court and user-defined risk constitution. The final output is a trade receipt containing the decision, confidence, source signals, risk gates, invalidation rules, Trust Wallet execution intent, BNB agent metadata, and a receipt hash.

## Why It Matters

Autonomous trading agents are powerful but dangerous if they cannot explain or constrain themselves. TradeProof makes risk governance visible and machine-readable. It is designed for solo traders who want AI assistance without giving up self-custody or blind trust.

## Sponsor Usage

CoinMarketCap:

- Market regime and signal layer.
- Quotes, momentum, liquidity, sentiment, news risk, and derivatives pressure.
- Strategy output that is backtestable and auditable.

Trust Wallet Agent Kit:

- Self-custody execution boundary.
- Quote-only or paper-trade action.
- User keeps final signing control.

BNB AI Agent SDK:

- ERC-8004 agent identity metadata.
- ERC-8183-ready strategy job surface.
- Future commerce path where users can request paid strategy evaluations from an accountable agent.

## Differentiator

TradeProof is not just a trading bot. It is a proof layer for autonomous trading.

Most agents answer, "What should I trade?"

TradeProof answers:

- What should I trade?
- Why is it allowed?
- Which rule could block it?
- What invalidates it?
- What exact action is safe to prepare?

## Demo Flow

1. Select BNB to show a controlled strategy decision.
2. Adjust the constitution to make the rules stricter.
3. Select CAKE to demonstrate blocked execution under elevated risk.
4. Show the generated receipt hash and strategy rules.
5. Explain the live adapter path for CMC API, Trust Wallet Agent Kit, and BNB AI Agent SDK.

## Repository Notes

The current implementation ships with deterministic demo data and adapter-ready architecture so the app works without exposing private keys during judging. Live credentials can be added through environment variables.
