import { createServer } from "node:http";
import {
  buildBnbAgentProfile,
  buildMarketFeed,
  buildSwapQuote,
  buildTrustQuoteProof,
  getIntegrationHealth,
  loadLocalEnv,
  sendJson,
} from "./tradeproof-service.mjs";

const PORT = Number(process.env.PORT ?? 8787);

loadLocalEnv();

createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (url.pathname === "/api/health") {
    sendJson(response, 200, getIntegrationHealth());
    return;
  }

  if (url.pathname === "/api/trust/quote") {
    sendJson(response, 200, buildTrustQuoteProof(url.searchParams));
    return;
  }

  if (url.pathname === "/api/agent/profile") {
    sendJson(response, 200, buildBnbAgentProfile(url.searchParams));
    return;
  }

  if (url.pathname === "/api/quote/price") {
    try {
      sendJson(response, 200, await buildSwapQuote(url.searchParams, "price"));
    } catch (error) {
      sendJson(response, 400, { mode: "error", message: error instanceof Error ? error.message : "Quote failed." });
    }
    return;
  }

  if (url.pathname === "/api/quote/firm") {
    try {
      sendJson(response, 200, await buildSwapQuote(url.searchParams, "quote"));
    } catch (error) {
      sendJson(response, 400, { mode: "error", message: error instanceof Error ? error.message : "Quote failed." });
    }
    return;
  }

  if (url.pathname !== "/api/market") {
    sendJson(response, 404, { error: "Not found" });
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
}).listen(PORT, "127.0.0.1", () => {
  console.log(`TradeProof API proxy listening on http://127.0.0.1:${PORT}`);
});
