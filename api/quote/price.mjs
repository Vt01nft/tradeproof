import { buildSwapQuote, sendJson } from "../../server/tradeproof-service.mjs";

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `https://${request.headers.host ?? "tradeproof.local"}`);

  try {
    sendJson(response, 200, await buildSwapQuote(url.searchParams, "price"));
  } catch (error) {
    sendJson(response, 400, { mode: "error", message: error instanceof Error ? error.message : "Quote failed." });
  }
}
