import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const SYMBOLS = ["BNB", "CAKE", "USDT"];
const ZERO_X_BASE_URL = "https://api.0x.org";
const BNB_CHAIN_ID = 56;
const BSC_RPC_URLS = (process.env.BSC_RPC_URLS ?? process.env.BSC_RPC_URL ?? "https://bsc-dataseed1.defibit.io,https://bsc-dataseed1.ninicoin.io,https://bsc-dataseed.binance.org")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const TOKEN_MAP = {
  BNB: {
    symbol: "BNB",
    decimals: 18,
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  },
  USDT: {
    symbol: "USDT",
    decimals: 18,
    address: "0x55d398326f99059fF775485246999027B3197955",
  },
  CAKE: {
    symbol: "CAKE",
    decimals: 18,
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  },
};

export function loadLocalEnv() {
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

export function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

export function toNumber(value, fallback = 0) {
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

export async function buildMarketFeed() {
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

export function getIntegrationHealth() {
  return {
    ok: true,
    hasCmcKey: Boolean(process.env.CMC_API_KEY ?? process.env.VITE_CMC_API_KEY),
    hasZeroXKey: Boolean(process.env.ZEROX_API_KEY ?? process.env.ZERO_X_API_KEY),
    hasTrustWalletCredentials: Boolean(
      (process.env.TRUST_WALLET_CLIENT_ID ?? process.env.VITE_TRUST_WALLET_CLIENT_ID) &&
        (process.env.TRUST_WALLET_CLIENT_SECRET ?? process.env.VITE_TRUST_WALLET_CLIENT_SECRET),
    ),
    hasBnbAgentKey: Boolean(process.env.BNB_AGENT_PRIVATE_KEY ?? process.env.VITE_BNB_AGENT_PRIVATE_KEY),
  };
}

const BACKTEST_BASE_PRICE = {
  BNB: 643.18,
  CAKE: 2.91,
  USDT: 1,
};

function decideBacktest(signal, constitution) {
  const riskChecks = [
    signal.liquidityScore >= constitution.minLiquidityScore,
    signal.volatility <= constitution.maxVolatility,
    signal.volatility + Math.max(signal.newsRisk / 12, 0) <= constitution.maxDrawdown,
    constitution.maxPositionSize <= 15,
    constitution.requirePositiveSentiment ? signal.sentiment >= 50 : true,
    signal.newsRisk <= 42,
  ];
  const allClear = riskChecks.every(Boolean);

  if (signal.asset === "USDT") {
    return { decision: "HOLD", ruleAdherence: 100 };
  }

  if (!allClear) {
    return {
      decision: "NO_TRADE",
      ruleAdherence: Math.round((riskChecks.filter(Boolean).length / riskChecks.length) * 100),
    };
  }

  if (signal.rsi > 70 || signal.fundingPressure > 0.35) {
    return { decision: "HOLD", ruleAdherence: 92 };
  }

  if (signal.sentiment > 58 && signal.change24h > 0.5 && signal.volumeChange24h > 8) {
    return { decision: "BUY", ruleAdherence: 100 };
  }

  if (signal.sentiment < 40 && signal.change24h < -2) {
    return { decision: "SELL", ruleAdherence: 100 };
  }

  return { decision: "HOLD", ruleAdherence: 88 };
}

function buildReplaySignal(asset, price, previousPrice, dayIndex) {
  const change24h = previousPrice > 0 ? ((price - previousPrice) / previousPrice) * 100 : 0;
  const cycle = Math.sin(dayIndex * 0.58);
  const volumeChange24h = 14 + cycle * 22 + Math.max(change24h, 0) * 4;
  const volatility = clamp(Math.abs(change24h) * 1.45 + Math.abs(Math.sin(dayIndex * 0.31)) * 2.4, 0.2, 9.8);
  const sentiment = clamp(Math.round(54 + change24h * 5 + cycle * 12), 15, 92);
  const rsi = clamp(Math.round(52 + change24h * 4.2 + Math.sin(dayIndex * 0.42) * 14), 18, 86);

  return {
    asset,
    price,
    change24h,
    volumeChange24h,
    sentiment,
    rsi,
    volatility: Number(volatility.toFixed(2)),
    liquidityScore: asset === "BNB" ? 91 : asset === "CAKE" ? 76 : 99,
    fundingPressure: Number(clamp(Math.abs(change24h) / 18 + Math.max(volumeChange24h, 0) / 240, 0.01, 0.55).toFixed(2)),
    newsRisk: clamp(Math.round(22 + volatility * 2.1 - sentiment / 12), 5, 68),
    dataSource: "backtest-replay",
  };
}

export function buildStrategyBacktest(searchParams) {
  const asset = String(searchParams.get("asset") ?? "BNB").toUpperCase();

  if (!SYMBOLS.includes(asset)) {
    throw new Error("Unsupported asset for strategy backtest.");
  }

  const windowDays = Math.min(Math.max(Math.round(toNumber(searchParams.get("windowDays"), 30)), 14), 90);
  const constitution = {
    maxPositionSize: Math.min(Math.max(toNumber(searchParams.get("maxPositionSize"), 12), 1), 25),
    maxDrawdown: Math.min(Math.max(toNumber(searchParams.get("maxDrawdown"), 8), 1), 30),
    minLiquidityScore: Math.min(Math.max(toNumber(searchParams.get("minLiquidityScore"), 72), 1), 99),
    maxVolatility: Math.min(Math.max(toNumber(searchParams.get("maxVolatility"), 7), 1), 20),
    stopLoss: Math.min(Math.max(toNumber(searchParams.get("stopLoss"), 4.5), 0.5), 25),
    requirePositiveSentiment: searchParams.get("requirePositiveSentiment") !== "false",
  };
  const feeBps = 25;
  const slippageBps = Math.min(Math.max(toNumber(searchParams.get("slippageBps"), 75), 10), 500);
  const startingCapitalUsd = 10000;
  const createdAt = new Date().toISOString();
  const today = new Date(`${createdAt.slice(0, 10)}T00:00:00.000Z`);
  let price = searchParams.has("price")
    ? toNumber(searchParams.get("price"), BACKTEST_BASE_PRICE[asset] ?? 1)
    : BACKTEST_BASE_PRICE[asset] ?? 1;
  let previousPrice = price;
  let equity = startingCapitalUsd;
  let peakEquity = startingCapitalUsd;
  let positionPct = 0;
  let entryPrice = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  const windows = [];

  for (let index = windowDays - 1; index >= 0; index -= 1) {
    const dayNumber = windowDays - index;
    const drift = asset === "USDT" ? 0 : Math.sin(dayNumber * 0.47) * 0.018 + Math.cos(dayNumber * 0.19) * 0.009;
    previousPrice = price;
    price = Number(Math.max(0.0001, price * (1 + drift)).toFixed(asset === "BNB" ? 2 : 5));

    const signal = buildReplaySignal(asset, price, previousPrice, dayNumber);
    const { decision, ruleAdherence } = decideBacktest(signal, constitution);
    const previousEquity = equity;

    if (positionPct > 0) {
      const markReturn = previousPrice > 0 ? ((price - previousPrice) / previousPrice) * (positionPct / 100) : 0;
      equity *= 1 + markReturn;

      if (entryPrice > 0 && ((price - entryPrice) / entryPrice) * 100 <= -constitution.stopLoss) {
        losses += 1;
        positionPct = 0;
        equity *= 1 - (feeBps + slippageBps) / 10000;
      }
    }

    if (decision === "BUY" && positionPct === 0) {
      positionPct = constitution.maxPositionSize;
      entryPrice = price;
      trades += 1;
      equity *= 1 - (feeBps + slippageBps) / 10000;
    }

    if ((decision === "SELL" || decision === "NO_TRADE") && positionPct > 0) {
      if (equity >= previousEquity) {
        wins += 1;
      } else {
        losses += 1;
      }

      positionPct = 0;
      equity *= 1 - (feeBps + slippageBps) / 10000;
    }

    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - index);

    windows.push({
      day: day.toISOString().slice(0, 10),
      price,
      decision,
      positionPct,
      pnlPct: Number((((equity - startingCapitalUsd) / startingCapitalUsd) * 100).toFixed(2)),
      drawdownPct: Number(drawdownPct.toFixed(2)),
      ruleAdherence,
    });
  }

  const closedTrades = wins + losses;
  const ruleAdherencePct = windows.length
    ? Math.round(windows.reduce((sum, item) => sum + item.ruleAdherence, 0) / windows.length)
    : 0;
  const maxDrawdownPct = windows.reduce((max, item) => Math.max(max, item.drawdownPct), 0);
  const proofBase = JSON.stringify({ asset, windowDays, constitution, feeBps, slippageBps, windows });

  return {
    mode: "backtest-ready",
    asset,
    windowDays,
    assumptions: {
      startingCapitalUsd,
      feeBps,
      slippageBps,
      maxPositionPct: constitution.maxPositionSize,
      stopLossPct: constitution.stopLoss,
    },
    metrics: {
      totalReturnPct: Number((((equity - startingCapitalUsd) / startingCapitalUsd) * 100).toFixed(2)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      winRatePct: closedTrades ? Math.round((wins / closedTrades) * 100) : 0,
      trades,
      ruleAdherencePct,
    },
    windows,
    inputSchema: {
      asset: "BNB | CAKE | USDT",
      windowDays: "14..90",
      maxPositionSize: "number percent",
      maxDrawdown: "number percent",
      minLiquidityScore: "1..99",
      maxVolatility: "number percent",
      stopLoss: "number percent",
      slippageBps: "basis points",
    },
    outputSchema: {
      metrics: "return, drawdown, win rate, trade count, rule adherence",
      windows: "daily price, decision, position, pnl, drawdown, rule adherence",
      proofId: "deterministic proof hash for the replay payload",
    },
    proofId: proofHash(proofBase),
    createdAt,
  };
}

function parseUnits(amount, decimals) {
  const value = String(amount ?? "0").trim();

  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error("Amount must be a positive decimal number.");
  }

  const [whole, fraction = ""] = value.split(".");
  const padded = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);
  const baseUnits = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");

  if (baseUnits <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  return baseUnits.toString();
}

function getTradeToken(symbol) {
  const token = TOKEN_MAP[String(symbol ?? "").toUpperCase()];

  if (!token) {
    throw new Error("Unsupported token. TradeProof currently supports BNB, USDT, and CAKE.");
  }

  return token;
}

function validateTaker(address) {
  const taker = String(address ?? "");

  if (!/^0x[a-fA-F0-9]{40}$/.test(taker)) {
    throw new Error("A connected EVM wallet address is required.");
  }

  return taker;
}

function strip0x(value) {
  return String(value).replace(/^0x/i, "");
}

function pad64(value) {
  return strip0x(value).padStart(64, "0");
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeAddress(address) {
  return pad64(address.toLowerCase());
}

function encodePath(addresses) {
  return `${encodeUint(addresses.length)}${addresses.map(encodeAddress).join("")}`;
}

async function bscRpc(method, params) {
  let lastError = null;

  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const payload = await response.json();

      if (payload.error) {
        throw new Error(payload.error.message ?? "BSC RPC request failed.");
      }

      return payload.result;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : "All BSC RPC endpoints failed.");
}

function decodeUintArray(hexValue) {
  const hex = strip0x(hexValue);
  const length = Number.parseInt(hex.slice(64, 128), 16);
  const values = [];

  for (let index = 0; index < length; index += 1) {
    const start = 128 + index * 64;
    values.push(BigInt(`0x${hex.slice(start, start + 64)}`).toString());
  }

  return values;
}

async function buildPancakeNativeQuote({ sellToken, buyToken, sellAmount, sellAmountBaseUnits, taker, slippageBps, createdAt }) {
  if (sellToken.symbol !== "BNB" || buyToken.symbol === "BNB") {
    return null;
  }

  const path = [WBNB_ADDRESS, buyToken.address];
  const getAmountsOutSelector = "d06ca61f";
  const getAmountsOutData = `0x${getAmountsOutSelector}${encodeUint(sellAmountBaseUnits)}${encodeUint(64)}${encodePath(path)}`;
  const output = await bscRpc("eth_call", [{ to: PANCAKE_V2_ROUTER, data: getAmountsOutData }, "latest"]);
  const amounts = decodeUintArray(output);
  const buyAmount = amounts[amounts.length - 1];
  const minBuyAmount = ((BigInt(buyAmount) * BigInt(10000 - Number(slippageBps))) / 10000n).toString();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  const swapSelector = "7ff36ab5";
  const swapData = `0x${swapSelector}${encodeUint(minBuyAmount)}${encodeUint(128)}${encodeAddress(taker)}${encodeUint(deadline)}${encodePath(path)}`;
  const proofBase = `pancake:${sellToken.symbol}:${buyToken.symbol}:${sellAmountBaseUnits}:${taker}:${createdAt}`;

  return {
    mode: "live-pancake",
    chainId: BNB_CHAIN_ID,
    sellToken: sellToken.symbol,
    buyToken: buyToken.symbol,
    sellAmount,
    sellAmountBaseUnits,
    taker,
    buyAmount,
    minBuyAmount,
    transaction: {
      to: PANCAKE_V2_ROUTER,
      data: swapData,
      value: sellAmountBaseUnits,
    },
    route: { source: "PancakeSwap V2", path },
    message: "Live PancakeSwap quote prepared for native BNB. User wallet must sign; TradeProof never takes custody.",
    proofId: proofHash(`${proofBase}:${buyAmount}:${minBuyAmount}`),
    createdAt,
  };
}

async function zeroXFetch(path, searchParams) {
  const apiKey = process.env.ZEROX_API_KEY ?? process.env.ZERO_X_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url = new URL(`${ZERO_X_BASE_URL}${path}`);
  for (const [key, value] of searchParams.entries()) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "0x-api-key": apiKey,
      "0x-version": "v2",
      Accept: "application/json",
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.reason ?? `0x request failed with ${response.status}`);
  }

  return payload;
}

export async function buildSwapQuote(searchParams, quoteType = "price") {
  const sellToken = getTradeToken(searchParams.get("sellToken") ?? "BNB");
  const buyToken = getTradeToken(searchParams.get("buyToken") ?? "USDT");
  const sellAmount = searchParams.get("sellAmount") ?? "0.01";
  const taker = validateTaker(searchParams.get("taker"));
  const slippageBps = String(Math.min(Math.max(toNumber(searchParams.get("slippageBps"), 75), 10), 500));
  const sellAmountBaseUnits = parseUnits(sellAmount, sellToken.decimals);
  const createdAt = new Date().toISOString();
  const proofBase = `${quoteType}:${sellToken.symbol}:${buyToken.symbol}:${sellAmountBaseUnits}:${taker}:${createdAt}`;

  if (sellToken.symbol === buyToken.symbol) {
    return {
      mode: "blocked",
      chainId: BNB_CHAIN_ID,
      sellToken: sellToken.symbol,
      buyToken: buyToken.symbol,
      sellAmount,
      sellAmountBaseUnits,
      taker,
      message: "Sell and buy token must be different.",
      proofId: proofHash(proofBase),
      createdAt,
    };
  }

  const pancakeQuote = await buildPancakeNativeQuote({
    sellToken,
    buyToken,
    sellAmount,
    sellAmountBaseUnits,
    taker,
    slippageBps,
    createdAt,
  });

  if (pancakeQuote) {
    return pancakeQuote;
  }

  const params = new URLSearchParams({
    chainId: String(BNB_CHAIN_ID),
    sellToken: sellToken.address,
    buyToken: buyToken.address,
    sellAmount: sellAmountBaseUnits,
    taker,
    slippageBps,
  });
  const payload = await zeroXFetch(`/swap/allowance-holder/${quoteType}`, params);

  if (!payload) {
    return {
      mode: "missing-api-key",
      chainId: BNB_CHAIN_ID,
      sellToken: sellToken.symbol,
      buyToken: buyToken.symbol,
      sellAmount,
      sellAmountBaseUnits,
      taker,
      message: "ZEROX_API_KEY is not configured. Add it to enable real executable swap quotes.",
      proofId: proofHash(proofBase),
      createdAt,
    };
  }

  return {
      mode: "live-0x",
    chainId: BNB_CHAIN_ID,
    sellToken: sellToken.symbol,
    buyToken: buyToken.symbol,
    sellAmount,
    sellAmountBaseUnits,
    taker,
    price: payload.price,
    buyAmount: payload.buyAmount,
    minBuyAmount: payload.minBuyAmount,
    estimatedPriceImpact: payload.estimatedPriceImpact,
    allowanceTarget: payload.allowanceTarget ?? payload?.issues?.allowance?.spender,
    transaction: payload.transaction,
    route: payload.route,
    issues: payload.issues,
    message:
      quoteType === "quote"
        ? "Firm executable 0x quote prepared. User wallet must sign; TradeProof never takes custody."
        : "Live 0x indicative price prepared for BNB Chain.",
    proofId: proofHash(`${proofBase}:${payload.buyAmount ?? ""}:${payload.transaction?.to ?? ""}`),
    createdAt,
  };
}

export function buildTrustQuoteProof(searchParams) {
  const hasCredentials = Boolean(
    (process.env.TRUST_WALLET_CLIENT_ID ?? process.env.VITE_TRUST_WALLET_CLIENT_ID) &&
      (process.env.TRUST_WALLET_CLIENT_SECRET ?? process.env.VITE_TRUST_WALLET_CLIENT_SECRET),
  );
  const asset = searchParams.get("asset") ?? "BNB";
  const decision = searchParams.get("decision") ?? "NO_TRADE";
  const price = toNumber(searchParams.get("price"), 0);
  const notionalUsd = decision === "BUY" ? 250 : 0;
  const createdAt = new Date().toISOString();

  return {
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
  };
}

export function buildBnbAgentProfile(searchParams) {
  const hasAgentKey = Boolean(process.env.BNB_AGENT_PRIVATE_KEY ?? process.env.VITE_BNB_AGENT_PRIVATE_KEY);
  const receiptHash = searchParams.get("receiptHash") ?? "pending";
  const createdAt = new Date().toISOString();

  return {
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
  };
}
