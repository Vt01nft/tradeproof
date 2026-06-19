import type { Constitution, MarketSignal, SponsorIntegration } from "../types";

export const defaultConstitution: Constitution = {
  maxPositionSize: 12,
  maxDrawdown: 8,
  minLiquidityScore: 72,
  maxVolatility: 7,
  stopLoss: 4.5,
  requirePositiveSentiment: true,
  executionMode: "quote-only",
};

export const marketScenarios: MarketSignal[] = [
  {
    asset: "BNB",
    price: 643.18,
    change24h: 2.84,
    volumeChange24h: 18.3,
    sentiment: 68,
    rsi: 61,
    volatility: 4.2,
    liquidityScore: 91,
    fundingPressure: 0.18,
    newsRisk: 19,
    dataSource: "demo-scenario",
  },
  {
    asset: "CAKE",
    price: 2.91,
    change24h: 7.24,
    volumeChange24h: 44.1,
    sentiment: 58,
    rsi: 76,
    volatility: 8.1,
    liquidityScore: 74,
    fundingPressure: 0.41,
    newsRisk: 35,
    dataSource: "demo-scenario",
  },
  {
    asset: "USDT",
    price: 1,
    change24h: 0.01,
    volumeChange24h: 4.4,
    sentiment: 51,
    rsi: 50,
    volatility: 0.2,
    liquidityScore: 99,
    fundingPressure: 0.01,
    newsRisk: 7,
    dataSource: "demo-scenario",
  },
];

export const sponsorIntegrations: SponsorIntegration[] = [
  {
    name: "CoinMarketCap Agent Hub",
    status: "pending-key",
    role: "Market regime, technicals, sentiment, liquidity, and narrative risk.",
  },
  {
    name: "Trust Wallet Agent Kit",
    status: "mocked",
    role: "Self-custody wallet context, quote-only swap intent, token risk checks.",
  },
  {
    name: "BNB AI Agent SDK",
    status: "mocked",
    role: "ERC-8004 identity metadata and ERC-8183-ready strategy job surface.",
  },
];
