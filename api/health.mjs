import { getIntegrationHealth, sendJson } from "../server/tradeproof-service.mjs";

export default function handler(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  sendJson(response, 200, getIntegrationHealth());
}
