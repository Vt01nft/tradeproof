import { buildMarketFeed, sendJson } from "../server/tradeproof-service.mjs";

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    sendJson(response, 200, await buildMarketFeed());
  } catch (error) {
    sendJson(response, 502, {
      mode: "fallback",
      generatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "CoinMarketCap request failed.",
      assets: [],
    });
  }
}
