import { buildStrategyBacktest, sendJson } from "../../server/tradeproof-service.mjs";

export default function handler(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    sendJson(response, 200, buildStrategyBacktest(url.searchParams));
  } catch (error) {
    sendJson(response, 400, {
      mode: "fallback",
      asset: "BNB",
      windowDays: 0,
      assumptions: {
        startingCapitalUsd: 0,
        feeBps: 0,
        slippageBps: 0,
        maxPositionPct: 0,
        stopLossPct: 0,
      },
      metrics: {
        totalReturnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        trades: 0,
        ruleAdherencePct: 0,
      },
      windows: [],
      inputSchema: {},
      outputSchema: {},
      proofId: "0x00000000",
      createdAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Backtest failed.",
    });
  }
}
