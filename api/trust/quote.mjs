import { buildTrustQuoteProof, sendJson } from "../../server/tradeproof-service.mjs";

export default function handler(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `https://${request.headers.host ?? "tradeproof.local"}`);
  sendJson(response, 200, buildTrustQuoteProof(url.searchParams));
}
