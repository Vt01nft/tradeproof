import type {
  Constitution,
  CourtVote,
  Decision,
  MarketSignal,
  TradeReceipt,
} from "../types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashReceipt(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `0x${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function getRegime(signal: MarketSignal) {
  if (signal.asset === "USDT") {
    return "capital preservation";
  }

  if (signal.rsi > 72 || signal.volatility > 7) {
    return "risk-on but overheated";
  }

  if (signal.sentiment >= 62 && signal.change24h > 0 && signal.volumeChange24h > 10) {
    return "risk-on confirmation";
  }

  if (signal.sentiment < 45 || signal.newsRisk > 45) {
    return "risk-off defense";
  }

  return "neutral accumulation";
}

function decide(signal: MarketSignal, checks: Record<string, boolean>): Decision {
  const allClear = Object.values(checks).every(Boolean);

  if (signal.asset === "USDT") {
    return "HOLD";
  }

  if (!allClear) {
    return "NO_TRADE";
  }

  if (signal.rsi > 70 || signal.fundingPressure > 0.35) {
    return "HOLD";
  }

  if (signal.sentiment > 60 && signal.change24h > 1 && signal.volumeChange24h > 10) {
    return "BUY";
  }

  if (signal.sentiment < 40 && signal.change24h < -2) {
    return "SELL";
  }

  return "HOLD";
}

function buildCourt(signal: MarketSignal, checks: Record<string, boolean>): CourtVote[] {
  const momentumScore = clamp(
    Math.round(signal.sentiment * 0.45 + signal.volumeChange24h * 0.35 + signal.change24h * 4),
    0,
    100,
  );
  const skepticScore = clamp(Math.round(100 - signal.rsi * 0.8 - signal.fundingPressure * 45), 0, 100);
  const riskScore = Math.round(
    (Number(checks.liquidityOk) +
      Number(checks.volatilityOk) +
      Number(checks.drawdownOk) +
      Number(checks.positionSizeOk) +
      Number(checks.newsRiskOk)) *
      20,
  );

  return [
    {
      role: "Analyst",
      vote: momentumScore > 58 ? "approve" : "hold",
      score: momentumScore,
      summary:
        momentumScore > 58
          ? "Momentum, sentiment, and volume support a controlled long setup."
          : "Signal quality is not strong enough for aggressive exposure.",
    },
    {
      role: "Skeptic",
      vote: skepticScore < 42 ? "reject" : "approve",
      score: skepticScore,
      summary:
        skepticScore < 42
          ? "Overheated RSI or funding pressure makes chasing the move unattractive."
          : "No single market stress factor invalidates the thesis.",
    },
    {
      role: "Risk Officer",
      vote: riskScore >= 80 ? "approve" : "reject",
      score: riskScore,
      summary:
        riskScore >= 80
          ? "The trade stays inside liquidity, volatility, drawdown, and sizing limits."
          : "The constitution blocks execution until risk constraints improve.",
    },
  ];
}

export function generateReceipt(signal: MarketSignal, constitution: Constitution): TradeReceipt {
  const riskChecks = {
    liquidityOk: signal.liquidityScore >= constitution.minLiquidityScore,
    volatilityOk: signal.volatility <= constitution.maxVolatility,
    drawdownOk: signal.volatility + Math.max(signal.newsRisk / 12, 0) <= constitution.maxDrawdown,
    positionSizeOk: constitution.maxPositionSize <= 15,
    sentimentOk: constitution.requirePositiveSentiment ? signal.sentiment >= 50 : true,
    newsRiskOk: signal.newsRisk <= 42,
  };
  const courtVotes = buildCourt(signal, riskChecks);
  const decision = decide(signal, riskChecks);
  const marketRegime = getRegime(signal);
  const confidence = clamp(
    Math.round(
      (signal.sentiment * 0.28 +
        signal.liquidityScore * 0.25 +
        (100 - signal.volatility * 10) * 0.18 +
        (100 - signal.newsRisk) * 0.17 +
        (100 - Math.abs(signal.rsi - 58)) * 0.12) /
        100 *
        100,
    ),
    5,
    96,
  );
  const now = new Date().toISOString();
  const raw = `${signal.asset}:${decision}:${marketRegime}:${confidence}:${now}`;

  return {
    id: `TP-${signal.asset}-${now.slice(0, 10).replaceAll("-", "")}`,
    timestamp: now,
    decision,
    asset: signal.asset,
    confidence,
    marketRegime,
    thesis:
      decision === "BUY"
        ? `${signal.asset} shows constructive CMC-style momentum with positive sentiment, rising volume, and acceptable liquidity.`
        : decision === "NO_TRADE"
          ? `${signal.asset} fails at least one constitutional risk gate, so the agent refuses execution.`
          : `${signal.asset} does not offer enough asymmetry to justify a new position.`,
    invalidation:
      decision === "BUY"
        ? `Exit if volatility exceeds ${constitution.maxVolatility}%, liquidity score drops below ${constitution.minLiquidityScore}, or price breaches the ${constitution.stopLoss}% stop.`
        : "Re-evaluate when sentiment, volatility, and liquidity return inside the constitution.",
    courtVotes,
    riskChecks,
    strategyRules: [
      "Trade only BNB Chain assets with sufficient liquidity.",
      "Prefer risk-on regimes with positive sentiment and confirmed volume.",
      "Reject overheated moves when RSI, funding pressure, or news risk rises.",
      `Cap each position at ${constitution.maxPositionSize}% of portfolio value.`,
      `Attach a ${constitution.stopLoss}% stop-loss to every approved entry.`,
    ],
    cmcSources: [
      "quotes/latest",
      "market-pair liquidity",
      "technical momentum",
      "sentiment and news risk",
      "derivatives pressure",
    ],
    trustWalletAction:
      constitution.executionMode === "quote-only"
        ? `Quote-only swap intent prepared for ${signal.asset}; user keeps final signing control.`
        : constitution.executionMode === "paper-trade"
          ? `Paper trade recorded for ${signal.asset}; no wallet transaction requested.`
          : "Strategy-only output; execution intentionally disabled.",
    bnbAgentIdentity:
      "ERC-8004 profile metadata prepared; ERC-8183 strategy job endpoint is demo-ready.",
    receiptHash: hashReceipt(raw),
  };
}
