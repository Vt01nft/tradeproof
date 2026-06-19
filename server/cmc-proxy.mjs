import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PORT ?? 8787);
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const SYMBOLS = ["BNB", "CAKE", "USDT"];

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const row of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = row.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^"|"$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function proofHash(input) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `0x${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function getFirstQuote(data, symbol) {
  const item = data?.data?.[symbol];
  return Array.isArray(item) ? item[0] : item;
}

async function cmcFetch(path, apiKey) {
  const response = await fetch(`${CMC_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "X-CMC_PRO_API_KEY": apiKey,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.status?.error_message ?? `CMC request failed with ${response.status}`);
  }

  return payload;
}

async function buildMarketFeed() {
  const apiKey = process.env.CMC_API_KEY ?? process.env.VITE_CMC_API_KEY;

  if (!apiKey) {
    return {
      mode: "fallback",
      generatedAt: new Date().toISOString(),
      message: "CMC_API_KEY is not configured. Using deterministic demo market scenarios.",
      assets: [],
    };
  }

  const quotePayload = await cmcFetch(
    `/v2/cryptocurrency/quotes/latest?symbol=${SYMBOLS.join(",")}&convert=USD`,
    apiKey,
  );

  let fearGreedValue = 50;

  try {
    const fearGreedPayload = await cmcFetch("/v3/fear-and-greed/latest", apiKey);
    fearGreedValue = toNumber(fearGreedPayload?.data?.value, 50);
  } catch {
    fearGreedValue = 50;
  }

  const assets = SYMBOLS.map((symbol) => {
    const record = getFirstQuote(quotePayload, symbol);
    const usd = record?.quote?.USD;

    if (!record || !usd) {
      return null;
    }

    const change24h = toNumber(usd.percent_change_24h);
    const change7d = toNumber(usd.percent_change_7d);
    const volumeChange24h = toNumber(usd.volume_change_24h);
    const marketCap = toNumber(usd.market_cap);
    const volume = toNumber(usd.volume_24h);
    const turnover = marketCap > 0 ? (volume / marketCap) * 100 : 8;
    const volatility = clamp(Math.abs(change24h) * 0.75 + Math.abs(change7d) * 0.25, 0.2, 11);
    const liquidityScore = clamp(Math.round(56 + turnover * 7 + Math.log10(Math.max(volume, 1)) * 2.5), 40, 99);
    const sentiment = clamp(Math.round(fearGreedValue + change24h * 2 + Math.sign(volumeChange24h) * 4), 1, 99);
    const rsi = clamp(Math.round(50 + change24h * 3.3 + change7d * 0.8), 15, 90);

    return {
      asset: symbol,
      price: toNumber(usd.price),
      change24h,
      volumeChange24h,
      sentiment,
      rsi,
      volatility: Number(volatility.toFixed(1)),
      liquidityScore,
      fundingPressure: Number(
        clamp(Math.abs(change24h) / 18 + Math.max(volumeChange24h, 0) / 220, 0.01, 0.55).toFixed(2),
      ),
      newsRisk: clamp(Math.round(28 + volatility * 2 - sentiment / 8), 5, 70),
      dataSource: "live-cmc-rest",
    };
  }).filter(Boolean);

  return {
    mode: "live",
    generatedAt: new Date().toISOString(),
    message: "Live CoinMarketCap REST data is powering the strategy layer.",
    assets,
  };
}

loadLocalEnv();

createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      hasCmcKey: Boolean(process.env.CMC_API_KEY ?? process.env.VITE_CMC_API_KEY),
      hasTrustWalletCredentials: Boolean(
        (process.env.TRUST_WALLET_CLIENT_ID ?? process.env.VITE_TRUST_WALLET_CLIENT_ID) &&
          (process.env.TRUST_WALLET_CLIENT_SECRET ?? process.env.VITE_TRUST_WALLET_CLIENT_SECRET),
      ),
      hasBnbAgentKey: Boolean(process.env.BNB_AGENT_PRIVATE_KEY ?? process.env.VITE_BNB_AGENT_PRIVATE_KEY),
    });
    return;
  }

  if (url.pathname !== "/api/market") {
    if (url.pathname === "/api/trust/quote") {
      const hasCredentials = Boolean(
        (process.env.TRUST_WALLET_CLIENT_ID ?? process.env.VITE_TRUST_WALLET_CLIENT_ID) &&
          (process.env.TRUST_WALLET_CLIENT_SECRET ?? process.env.VITE_TRUST_WALLET_CLIENT_SECRET),
      );
      const asset = url.searchParams.get("asset") ?? "BNB";
      const decision = url.searchParams.get("decision") ?? "NO_TRADE";
      const price = toNumber(url.searchParams.get("price"), 0);
      const notionalUsd = decision === "BUY" ? 250 : 0;
      const createdAt = new Date().toISOString();

      sendJson(response, 200, {
        mode: hasCredentials ? "quote-ready" : "credentials-missing",
        provider: "Trust Wallet Agent Kit",
        action: decision === "BUY" ? "prepare_quote_only_swap" : "execution_blocked_by_constitution",
        asset,
        chain: "BNB Smart Chain",
        notionalUsd,
        estimatedUnits: price > 0 && notionalUsd > 0 ? Number((notionalUsd / price).toFixed(6)) : 0,
        userControl: "No private keys are held by the agent; user keeps final signing control.",
        policy: ["quote-only", "no-custody", "constitution-gated", "no-autosign"],
        proofId: proofHash(`trust:${asset}:${decision}:${price}:${createdAt}`),
        createdAt,
      });
      return;
    }

    if (url.pathname === "/api/agent/profile") {
      const hasAgentKey = Boolean(process.env.BNB_AGENT_PRIVATE_KEY ?? process.env.VITE_BNB_AGENT_PRIVATE_KEY);
      const receiptHash = url.searchParams.get("receiptHash") ?? "pending";
      const createdAt = new Date().toISOString();

      sendJson(response, 200, {
        mode: hasAgentKey ? "profile-ready" : "credentials-missing",
        provider: "BNB AI Agent SDK",
        standard: "ERC-8004 / ERC-8183-ready metadata",
        name: "TradeProof",
        description: "Constitution-bound AI trading agent for accountable strategy evaluation.",
        capabilities: [
          "live_market_strategy_evaluation",
          "constitution_gated_trade_receipts",
          "quote_only_execution_preparation",
          "agentic_strategy_job_metadata",
        ],
        supportedJobs: ["strategy-evaluation", "risk-court-review", "quote-proof-preparation"],
        receiptHash,
        profileProof: proofHash(`bnb-agent:tradeproof:${receiptHash}:${createdAt}`),
        createdAt,
      });
      return;
    }

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
  console.log(`TradeProof CMC proxy listening on http://127.0.0.1:${PORT}`);
});
