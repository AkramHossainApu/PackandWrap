// Firebase Functions v2 (Node 18+)
// Deploy: firebase deploy --only functions
// This exposes a single endpoint: /api/steadfastPlaceOrder (via Hosting rewrite)

import { onRequest } from "firebase-functions/v2/https";

// Optional: pin a region close to Bangladesh, e.g. asia-south1
export const steadfastPlaceOrder = onRequest(
  { cors: true /*, region: 'asia-south1'*/ },
  async (req, res) => {
    // Basic CORS preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).end();
    }

    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { apiKey, secretKey, order } = req.body || {};
    if (!apiKey || !secretKey || !order) {
      return res
        .status(400)
        .json({ message: "apiKey, secretKey and order are required" });
    }

    const base = "https://portal.steadfast.com.bd/api/v1";
    const headers = {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "Secret-Key": secretKey,
    };

    async function hit(path) {
      const r = await fetch(base + path, {
        method: "POST",
        headers,
        body: JSON.stringify(order),
      });
      const text = await r.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (!r.ok) {
        throw new Error(json?.message || json?.error || `HTTP ${r.status}`);
      }
      return json;
    }

    try {
      // Try modern endpoint first; fall back to legacy if needed
      let out;
      try {
        out = await hit("/place-order");
      } catch (_e) {
        out = await hit("/create_order");
      }
      return res.status(200).json(out);
    } catch (err) {
      return res.status(502).json({ message: String(err.message || err) });
    }
  }
);
