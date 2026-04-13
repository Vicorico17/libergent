import { buildHistoryPayload } from "../src/history.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  sendJson(res, 200, await buildHistoryPayload());
}
