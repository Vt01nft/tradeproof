export type Decision = "BUY" | "SELL" | "HOLD" | "NO_TRADE";

export type SponsorStatus = "live-ready" | "credentials-ready" | "mocked" | "pending-key";

export type AssetSymbol = "BNB" | "CAKE" | "USDT";

export interface MarketSignal {
  asset: AssetSymbol;
  price: number;
  change24h: number;
  volumeChange24h: number;
  sentiment: number;
  rsi: number;
  volatility: number;
  liquidityScore: number;
  fundingPressure: number;
  newsRisk: number;
  dataSource: "demo-scenario" | "live-cmc-rest";
}

export interface Constitution {
  maxPositionSize: number;
  maxDrawdown: number;
  minLiquidityScore: number;
  maxVolatility: number;
  stopLoss: number;
  requirePositiveSentiment: boolean;
  executionMode: "strategy-only" | "quote-only" | "paper-trade";
}

export interface CourtVote {
  role: string;
  vote: "approve" | "reject" | "hold";
  summary: string;
  score: number;
}

export interface TradeReceipt {
  id: string;
  timestamp: string;
  decision: Decision;
  asset: AssetSymbol;
  confidence: number;
  marketRegime: string;
  thesis: string;
  invalidation: string;
  courtVotes: CourtVote[];
  riskChecks: Record<string, boolean>;
  strategyRules: string[];
  cmcSources: string[];
  trustWalletAction: string;
  bnbAgentIdentity: string;
  receiptHash: string;
}

export interface SponsorIntegration {
  name: string;
  status: SponsorStatus;
  role: string;
}

export interface MarketFeed {
  mode: "live" | "fallback";
  generatedAt: string;
  message: string;
  assets: MarketSignal[];
}

export interface IntegrationHealth {
  ok: boolean;
  hasCmcKey: boolean;
  hasTrustWalletCredentials: boolean;
  hasBnbAgentKey: boolean;
}

export interface TrustWalletProof {
  mode: "quote-ready" | "credentials-missing";
  provider: string;
  action: string;
  asset: AssetSymbol;
  chain: string;
  notionalUsd: number;
  estimatedUnits: number;
  userControl: string;
  policy: string[];
  proofId: string;
  createdAt: string;
}

export interface BnbAgentProof {
  mode: "profile-ready" | "credentials-missing";
  provider: string;
  standard: string;
  name: string;
  description: string;
  capabilities: string[];
  supportedJobs: string[];
  receiptHash: string;
  profileProof: string;
  createdAt: string;
}
