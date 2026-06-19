import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Check,
  Copy,
  FileJson,
  Gavel,
  KeyRound,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import "./App.css";
import { defaultConstitution, marketScenarios, sponsorIntegrations } from "./data/marketScenarios";
import { generateReceipt } from "./lib/strategy";
import type {
  BnbAgentProof,
  Constitution,
  IntegrationHealth,
  MarketFeed,
  MarketSignal,
  SwapQuote,
  TradeIntent,
  TradeTokenSymbol,
  TrustWalletProof,
  WalletState,
} from "./types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

const BNB_CHAIN_ID = 56;
const TRADE_TOKENS: TradeTokenSymbol[] = ["BNB", "USDT", "CAKE"];

function Logo() {
  return (
    <div className="brand-mark" aria-label="TradeProof logo">
      <svg viewBox="0 0 256 256" role="img">
        <path d="M64 210V112C64 75.55 93.55 46 130 46C166.45 46 196 75.55 196 112C196 148.45 166.45 178 130 178C93.55 178 64 148.45 64 112" />
        <path d="M130 78V178" />
        <path d="M130 128H184C214.38 128 239 103.38 239 73C239 42.62 214.38 18 184 18C153.62 18 129 42.62 129 73" />
        <path d="M64 128H130" />
      </svg>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "good" | "warn" | "neutral" | "secure"; children: string }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function Gauge({ value, label }: { value: number; label: string }) {
  return (
    <div className="gauge">
      <div className="gauge-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="bar">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="check-row">
      <span className={ok ? "check ok" : "check fail"}>{ok ? <Check size={14} /> : <X size={14} />}</span>
      <span>{label}</span>
    </div>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeChainId(chainId: unknown) {
  if (typeof chainId === "string") {
    return chainId.startsWith("0x") ? Number.parseInt(chainId, 16) : Number(chainId);
  }

  return typeof chainId === "number" ? chainId : null;
}

function App() {
  const [marketFeed, setMarketFeed] = useState<MarketFeed>({
    mode: "fallback",
    generatedAt: new Date().toISOString(),
    message: "Using deterministic demo market scenarios until the CMC proxy responds.",
    assets: marketScenarios,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth>({
    ok: false,
    hasCmcKey: false,
    hasZeroXKey: false,
    hasTrustWalletCredentials: false,
    hasBnbAgentKey: false,
  });
  const [trustProof, setTrustProof] = useState<TrustWalletProof | null>(null);
  const [bnbProof, setBnbProof] = useState<BnbAgentProof | null>(null);
  const [wallet, setWallet] = useState<WalletState>({ address: "", chainId: null, status: "disconnected" });
  const [sellToken, setSellToken] = useState<TradeTokenSymbol>("BNB");
  const [buyToken, setBuyToken] = useState<TradeTokenSymbol>("USDT");
  const [sellAmount, setSellAmount] = useState("0.01");
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [tradeIntent, setTradeIntent] = useState<TradeIntent>({ status: "idle" });
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const feedRequestRef = useRef(0);
  const [selectedAsset, setSelectedAsset] = useState<MarketSignal>(marketScenarios[0]);
  const [constitution, setConstitution] = useState<Constitution>(defaultConstitution);
  const visibleScenarios = marketFeed.assets.length ? marketFeed.assets : marketScenarios;
  const sponsorStack = sponsorIntegrations.map((integration) =>
    integration.name === "CoinMarketCap Agent Hub"
      ? { ...integration, status: marketFeed.mode === "live" ? ("live-ready" as const) : ("pending-key" as const) }
      : integration.name === "Trust Wallet Agent Kit"
        ? {
            ...integration,
            status: integrationHealth.hasTrustWalletCredentials ? ("credentials-ready" as const) : integration.status,
          }
        : integration.name === "BNB AI Agent SDK"
          ? {
              ...integration,
              status: integrationHealth.hasBnbAgentKey ? ("credentials-ready" as const) : integration.status,
            }
      : integration,
  );
  const receipt = useMemo(() => generateReceipt(selectedAsset, constitution), [selectedAsset, constitution]);
  const approvedCount = receipt.courtVotes.filter((vote) => vote.vote === "approve").length;
  const canRequestQuote = wallet.status === "connected" && receipt.decision !== "NO_TRADE" && sellToken !== buyToken;

  async function refreshMarketFeed() {
    const requestId = feedRequestRef.current + 1;
    feedRequestRef.current = requestId;
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/market");
      const feed = (await response.json()) as MarketFeed;
      const healthResponse = await fetch("/api/health");
      const health = (await healthResponse.json()) as IntegrationHealth;
      const nextAssets = feed.assets.length ? feed.assets : marketScenarios;

      if (requestId !== feedRequestRef.current) {
        return;
      }

      setMarketFeed({ ...feed, assets: nextAssets });
      setIntegrationHealth(health);
      setSelectedAsset((current) => nextAssets.find((asset) => asset.asset === current.asset) ?? nextAssets[0]);
    } catch {
      if (requestId !== feedRequestRef.current) {
        return;
      }

      setMarketFeed({
        mode: "fallback",
        generatedAt: new Date().toISOString(),
        message: "CMC proxy is offline. Using deterministic demo market scenarios.",
        assets: marketScenarios,
      });
    } finally {
      if (requestId === feedRequestRef.current) {
        setIsRefreshing(false);
      }
    }
  }

  function useDemoScenarios() {
    feedRequestRef.current += 1;
    setIsRefreshing(false);
    setMarketFeed({
      mode: "fallback",
      generatedAt: new Date().toISOString(),
      message: "Deterministic demo scenarios are active for video walkthroughs and judge review.",
      assets: marketScenarios,
    });
    setSelectedAsset(marketScenarios[0]);
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setWallet({ address: "", chainId: null, status: "unavailable", error: "No injected wallet found." });
      return;
    }

    setWallet((current) => ({ ...current, status: "connecting", error: undefined }));

    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const chainId = normalizeChainId(await window.ethereum.request({ method: "eth_chainId" }));
      const address = accounts[0] ?? "";

      setWallet({
        address,
        chainId,
        status: chainId === BNB_CHAIN_ID ? "connected" : "wrong-chain",
      });
    } catch (error) {
      setWallet({
        address: "",
        chainId: null,
        status: "disconnected",
        error: error instanceof Error ? error.message : "Wallet connection failed.",
      });
    }
  }

  async function switchToBnbChain() {
    if (!window.ethereum) {
      return;
    }

    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x38",
            chainName: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: ["https://bsc-dataseed.binance.org"],
            blockExplorerUrls: ["https://bscscan.com"],
          },
        ],
      });
    }

    const chainId = normalizeChainId(await window.ethereum.request({ method: "eth_chainId" }));
    setWallet((current) => ({
      ...current,
      chainId,
      status: current.address && chainId === BNB_CHAIN_ID ? "connected" : "wrong-chain",
    }));
  }

  function disconnectWallet() {
    setWallet({ address: "", chainId: null, status: "disconnected" });
    setSwapQuote(null);
    setTradeIntent({ status: "idle" });
  }

  async function requestSwapQuote(type: "price" | "firm" = "price") {
    if (!wallet.address) {
      setTradeIntent({ status: "wallet_required" });
      return null;
    }

    if (wallet.chainId !== BNB_CHAIN_ID) {
      setTradeIntent({ status: "wrong_chain" });
      return null;
    }

    if (receipt.decision === "NO_TRADE") {
      setTradeIntent({ status: "blocked", error: "The constitution blocks execution for this market state." });
      return null;
    }

    setIsQuoting(true);

    try {
      const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount,
        taker: wallet.address,
        slippageBps: "75",
      });
      const response = await fetch(`/api/quote/${type}?${params.toString()}`);
      const quote = (await response.json()) as SwapQuote;

      setSwapQuote(quote);
      setTradeIntent({
        status: quote.mode === "live-0x" || quote.mode === "live-pancake" ? "quote_ready" : quote.mode === "blocked" ? "blocked" : "failed",
        error: quote.mode === "live-0x" || quote.mode === "live-pancake" ? undefined : quote.message,
      });
      return quote;
    } catch (error) {
      setTradeIntent({ status: "failed", error: error instanceof Error ? error.message : "Quote failed." });
      return null;
    } finally {
      setIsQuoting(false);
    }
  }

  async function executeSwap() {
    if (!window.ethereum) {
      setTradeIntent({ status: "wallet_required", error: "No injected wallet found." });
      return;
    }

    setIsSigning(true);

    try {
      const quote = await requestSwapQuote("firm");

      if (!quote?.transaction || (quote.mode !== "live-0x" && quote.mode !== "live-pancake")) {
        setTradeIntent({ status: "failed", error: quote?.message ?? "No executable transaction returned." });
        return;
      }

      setTradeIntent({ status: "signing" });
      const txHash = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address,
            to: quote.transaction.to,
            data: quote.transaction.data,
            value: `0x${BigInt(quote.transaction.value || "0").toString(16)}`,
            gas: quote.transaction.gas ? `0x${BigInt(quote.transaction.gas).toString(16)}` : undefined,
            gasPrice: quote.transaction.gasPrice ? `0x${BigInt(quote.transaction.gasPrice).toString(16)}` : undefined,
          },
        ],
      })) as string;

      setTradeIntent({ status: "submitted", txHash });
    } catch (error) {
      setTradeIntent({ status: "failed", error: error instanceof Error ? error.message : "Swap signing failed." });
    } finally {
      setIsSigning(false);
    }
  }

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshMarketFeed();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, []);

  const refreshSponsorProofs = useCallback(async () => {
    try {
      const trustResponse = await fetch(
        `/api/trust/quote?asset=${receipt.asset}&decision=${receipt.decision}&price=${selectedAsset.price}`,
      );
      const agentResponse = await fetch(`/api/agent/profile?receiptHash=${receipt.receiptHash}`);

      setTrustProof((await trustResponse.json()) as TrustWalletProof);
      setBnbProof((await agentResponse.json()) as BnbAgentProof);
    } catch {
      setTrustProof(null);
      setBnbProof(null);
    }
  }, [receipt.asset, receipt.decision, receipt.receiptHash, selectedAsset.price]);

  useEffect(() => {
    const proofTimer = window.setTimeout(() => {
      void refreshSponsorProofs();
    }, 0);

    return () => window.clearTimeout(proofTimer);
  }, [refreshSponsorProofs]);

  function exportReceipt() {
    const payload = JSON.stringify(
      {
        ...receipt,
        wallet,
        swapQuote,
        tradeIntent,
        sponsorProofs: {
          trustWallet: trustProof,
          bnbAgent: bnbProof,
        },
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${receipt.id.toLowerCase()}-receipt.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <aside className="side-panel">
        <div className="brand">
          <Logo />
          <div>
            <h1>TradeProof</h1>
            <p>Constitution-bound AI trading agent</p>
          </div>
        </div>

        <section className="panel compact">
          <div className="section-title">
            <ShieldCheck size={17} />
            <h2>Agent Constitution</h2>
          </div>
          <label>
            Max position
            <input
              type="range"
              min="4"
              max="18"
              value={constitution.maxPositionSize}
              onChange={(event) =>
                setConstitution({ ...constitution, maxPositionSize: Number(event.target.value) })
              }
            />
            <span>{constitution.maxPositionSize}%</span>
          </label>
          <label>
            Max volatility
            <input
              type="range"
              min="2"
              max="11"
              step="0.5"
              value={constitution.maxVolatility}
              onChange={(event) => setConstitution({ ...constitution, maxVolatility: Number(event.target.value) })}
            />
            <span>{constitution.maxVolatility}%</span>
          </label>
          <label>
            Min liquidity
            <input
              type="range"
              min="50"
              max="95"
              value={constitution.minLiquidityScore}
              onChange={(event) =>
                setConstitution({ ...constitution, minLiquidityScore: Number(event.target.value) })
              }
            />
            <span>{constitution.minLiquidityScore}</span>
          </label>
          <div className="segmented" aria-label="Execution mode">
            {(["strategy-only", "quote-only", "paper-trade"] as const).map((mode) => (
              <button
                className={constitution.executionMode === mode ? "active" : ""}
                key={mode}
                onClick={() => setConstitution({ ...constitution, executionMode: mode })}
              >
                {mode.replace("-", " ")}
              </button>
            ))}
          </div>
        </section>

        <section className="panel compact">
          <div className="section-title">
            <KeyRound size={17} />
            <h2>Sponsor Stack</h2>
          </div>
          <div className="sponsor-list">
            {sponsorStack.map((integration) => (
              <div className="sponsor" key={integration.name}>
                <div>
                  <strong>{integration.name}</strong>
                  <p>{integration.role}</p>
                </div>
                <StatusPill
                  tone={
                    integration.status === "live-ready"
                      ? "good"
                      : integration.status === "credentials-ready"
                        ? "secure"
                      : integration.status === "pending-key"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {integration.status}
                </StatusPill>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">BNB Hack: Track 2 + Track 1-ready demo</p>
            <h2>Accountable strategy generation for self-custody AI agents</h2>
          </div>
          <div className="action-row">
            <button className="secondary-action" onClick={useDemoScenarios}>
              Demo Mode
            </button>
            {wallet.status === "connected" ? (
              <button className="secondary-action" onClick={disconnectWallet}>
                {shortAddress(wallet.address)}
              </button>
            ) : (
              <button className="secondary-action" onClick={connectWallet}>
                Connect Wallet
              </button>
            )}
            <button className="secondary-action" onClick={refreshMarketFeed} disabled={isRefreshing}>
              <Activity size={18} />
              {isRefreshing ? "Refreshing" : "Refresh CMC"}
            </button>
            <button className="primary-action" onClick={exportReceipt}>
              <FileJson size={18} />
              Export Receipt
            </button>
          </div>
        </header>

        <section className={`feed-banner ${marketFeed.mode}`}>
          <div>
            <strong>{marketFeed.mode === "live" ? "Live CoinMarketCap feed" : "Fallback demo feed"}</strong>
            <p>{marketFeed.message}</p>
          </div>
          <span>{new Date(marketFeed.generatedAt).toLocaleTimeString()}</span>
        </section>

        <nav className="asset-tabs" aria-label="Market scenarios">
          {visibleScenarios.map((scenario) => (
            <button
              className={scenario.asset === selectedAsset.asset ? "active" : ""}
              key={scenario.asset}
              onClick={() => setSelectedAsset(scenario)}
            >
              <span>{scenario.asset}</span>
              <small>{scenario.change24h > 0 ? "+" : ""}{scenario.change24h.toFixed(2)}%</small>
            </button>
          ))}
        </nav>

        <section className="decision-band">
          <div>
            <p className="eyebrow">Current decision</p>
            <div className="decision-line">
              <span className={`decision ${receipt.decision.toLowerCase().replace("_", "-")}`}>
                {receipt.decision.replace("_", " ")}
              </span>
              <h3>{receipt.asset} under {receipt.marketRegime}</h3>
            </div>
            <p>{receipt.thesis}</p>
            <div className="price-line">
              <span>${selectedAsset.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              <span>{selectedAsset.dataSource === "live-cmc-rest" ? "CMC REST" : "Demo scenario"}</span>
            </div>
          </div>
          <div className="receipt-hash">
            <Copy size={16} />
            <span>{receipt.receiptHash}</span>
          </div>
        </section>

        <section className="grid metrics-grid">
          <Gauge value={receipt.confidence} label="Confidence" />
          <Gauge value={selectedAsset.sentiment} label="Sentiment" />
          <Gauge value={selectedAsset.liquidityScore} label="Liquidity" />
          <Gauge value={Math.round(100 - selectedAsset.volatility * 10)} label="Volatility safety" />
        </section>

        <section className="grid main-grid">
          <article className="panel">
            <div className="section-title">
              <Gavel size={18} />
              <h2>Trade Court</h2>
              <StatusPill tone={approvedCount >= 2 ? "good" : "warn"}>{`${approvedCount}/3 approve`}</StatusPill>
            </div>
            <div className="court-list">
              {receipt.courtVotes.map((vote) => (
                <div className="court-card" key={vote.role}>
                  <div>
                    <strong>{vote.role}</strong>
                    <StatusPill tone={vote.vote === "approve" ? "good" : vote.vote === "reject" ? "warn" : "neutral"}>
                      {vote.vote}
                    </StatusPill>
                  </div>
                  <p>{vote.summary}</p>
                  <Gauge value={vote.score} label="Score" />
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <Activity size={18} />
              <h2>Risk Gates</h2>
            </div>
            <div className="checks">
              {Object.entries(receipt.riskChecks).map(([label, ok]) => (
                <CheckRow key={label} label={label.replace(/([A-Z])/g, " $1").toLowerCase()} ok={ok} />
              ))}
            </div>
            <div className="callout">
              <strong>Invalidation</strong>
              <p>{receipt.invalidation}</p>
            </div>
          </article>
        </section>

        <section className="grid bottom-grid">
          <article className="panel">
            <div className="section-title">
              <BadgeCheck size={18} />
              <h2>Strategy Skill Output</h2>
            </div>
            <ol className="rules-list">
              {receipt.strategyRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </article>

          <article className="panel">
            <div className="section-title">
              <WalletCards size={18} />
              <h2>Trading Desk</h2>
            </div>
            <div className="trade-desk">
              <div className="trade-row">
                <label>
                  Sell
                  <select value={sellToken} onChange={(event) => setSellToken(event.target.value as TradeTokenSymbol)}>
                    {TRADE_TOKENS.map((token) => (
                      <option key={token} value={token}>
                        {token}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Buy
                  <select value={buyToken} onChange={(event) => setBuyToken(event.target.value as TradeTokenSymbol)}>
                    {TRADE_TOKENS.map((token) => (
                      <option key={token} value={token}>
                        {token}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Amount
                <input value={sellAmount} onChange={(event) => setSellAmount(event.target.value)} />
              </label>
              {wallet.status === "wrong-chain" ? (
                <button className="primary-action full-width" onClick={switchToBnbChain}>
                  Switch to BNB Chain
                </button>
              ) : (
                <div className="trade-actions">
                  <button className="secondary-action" onClick={() => void requestSwapQuote("price")} disabled={!canRequestQuote || isQuoting}>
                    {isQuoting ? "Quoting" : "Preview Quote"}
                  </button>
                  <button className="primary-action" onClick={executeSwap} disabled={!canRequestQuote || isSigning}>
                    {isSigning ? "Signing" : "Sign Swap"}
                  </button>
                </div>
              )}
              <div className={`intent ${tradeIntent.status}`}>
                <strong>{tradeIntent.status.replace("_", " ")}</strong>
                <p>
                  {tradeIntent.txHash
                    ? `Submitted: ${tradeIntent.txHash}`
                    : tradeIntent.error ?? "Wallet-signed trading is constitution-gated and runs only on BNB Chain."}
                </p>
              </div>
              {swapQuote ? (
                <div className="quote-preview">
                  <strong>{swapQuote.mode === "live-pancake" ? "PancakeSwap quote" : swapQuote.mode === "live-0x" ? "0x quote" : "Quote status"}</strong>
                  <p>{swapQuote.message}</p>
                  <code>{swapQuote.proofId}</code>
                  {swapQuote.buyAmount ? <span>Buy amount: {swapQuote.buyAmount}</span> : null}
                  {swapQuote.minBuyAmount ? <span>Min buy: {swapQuote.minBuyAmount}</span> : null}
                </div>
              ) : null}
            </div>
            <div className="proof-block">
              <strong>Trust Wallet</strong>
              <p>{trustProof ? `${trustProof.action} on ${trustProof.chain}. ${trustProof.userControl}` : receipt.trustWalletAction}</p>
              {trustProof ? <code>{trustProof.proofId}</code> : null}
            </div>
            <div className="proof-block">
              <strong>BNB Agent</strong>
              <p>{bnbProof ? `${bnbProof.standard}: ${bnbProof.description}` : receipt.bnbAgentIdentity}</p>
              {bnbProof ? <code>{bnbProof.profileProof}</code> : null}
            </div>
            <div className="source-tags">
              {receipt.cmcSources.map((source) => (
                <span key={source}>{source}</span>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

export default App;
