import { useEffect, useMemo, useState } from "react";
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
import type { Constitution, MarketFeed, MarketSignal } from "./types";

function Logo() {
  return (
    <div className="brand-mark" aria-label="TradeProof logo">
      <svg viewBox="0 0 40 40" role="img">
        <path d="M20 4 33 9v10c0 8.7-5.4 14.1-13 17-7.6-2.9-13-8.3-13-17V9l13-5Z" />
        <path d="M13 21.2 18 26l10-12" />
        <path d="M15 16h3m4 0h3m-7-4v8m7-12v12" />
      </svg>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "good" | "warn" | "neutral"; children: string }) {
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

function App() {
  const [marketFeed, setMarketFeed] = useState<MarketFeed>({
    mode: "fallback",
    generatedAt: new Date().toISOString(),
    message: "Using deterministic demo market scenarios until the CMC proxy responds.",
    assets: marketScenarios,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MarketSignal>(marketScenarios[0]);
  const [constitution, setConstitution] = useState<Constitution>(defaultConstitution);
  const visibleScenarios = marketFeed.assets.length ? marketFeed.assets : marketScenarios;
  const sponsorStack = sponsorIntegrations.map((integration) =>
    integration.name === "CoinMarketCap Agent Hub"
      ? { ...integration, status: marketFeed.mode === "live" ? ("live-ready" as const) : ("pending-key" as const) }
      : integration,
  );
  const receipt = useMemo(() => generateReceipt(selectedAsset, constitution), [selectedAsset, constitution]);
  const approvedCount = receipt.courtVotes.filter((vote) => vote.vote === "approve").length;

  async function refreshMarketFeed() {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/market");
      const feed = (await response.json()) as MarketFeed;
      const nextAssets = feed.assets.length ? feed.assets : marketScenarios;

      setMarketFeed({ ...feed, assets: nextAssets });
      setSelectedAsset((current) => nextAssets.find((asset) => asset.asset === current.asset) ?? nextAssets[0]);
    } catch {
      setMarketFeed({
        mode: "fallback",
        generatedAt: new Date().toISOString(),
        message: "CMC proxy is offline. Using deterministic demo market scenarios.",
        assets: marketScenarios,
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshMarketFeed();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, []);

  function exportReceipt() {
    const payload = JSON.stringify(receipt, null, 2);
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
              <h2>Execution Proof</h2>
            </div>
            <div className="proof-block">
              <strong>Trust Wallet</strong>
              <p>{receipt.trustWalletAction}</p>
            </div>
            <div className="proof-block">
              <strong>BNB Agent</strong>
              <p>{receipt.bnbAgentIdentity}</p>
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
