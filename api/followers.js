// Vercel Node Function that launches headless Chrome and extracts the follower count.
// This version is robust AND returns detailed diagnostics when it fails (use ?verbose=1).

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const config = {
  runtime: "nodejs",   // ✅ correct for Vercel now
  maxDuration: 30,     // give Chrome time to boot
  memory: 1024
};

export default async function handler(req, res) {
  const url = req.query.url || "https://gamefound.com/en/projects/artifox/artifox";
  const verbose = String(req.query.verbose || "") === "1";
  let browser;

  try {
    // Some platforms need these toggles explicit
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();

    const launchArgs = [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote"
    ];

    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: { width: 1280, height: 800 },
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9,nl;q=0.8" });

    // Load and give late UI a moment to render
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.waitForTimeout(800);

    // If there's a visible "Follow" button/label, wait briefly (non-fatal)
    try {
      await page.waitForSelector("text/Follow", { timeout: 4000 });
    } catch (_) {}

    const html = await page.content();

    // Try several patterns in the HTML first
    const tryMatch = (...regexes) => {
      for (const rx of regexes) {
        const m = html.match(rx);
        if (m) return parseInt(String(m[1]).replace(/[^\d]/g, ""), 10);
      }
      return null;
    };

    let followers = tryMatch(
      /Join\s+(\d{1,3}(?:[.,]\d{3})*|\d+)\s+followers/i,
      /\bFollow\b[^\d]{0,60}[\(\[]\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*[\)\]]/i,
      /[\(\[]\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*[\)\]][^\n]{0,60}\bFollow\b/i,
      /(\d{1,3}(?:[.,]\d{3})*|\d+)\s+(followers|volgers)\b/i,
      /\bfollowers?\b.{0,120}?(\d{1,3}(?:[.,]\d{3})*|\d+)/i,
      /(\d{1,3}(?:[.,]\d{3})*|\d+).{0,120}?\bfollowers?\b/i
    );

    // Last resort: scan text nodes
    if (!Number.isFinite(followers)) {
      followers = await page.evaluate(() => {
        const rxList = [
          /Join\s+(\d{1,3}(?:[.,]\d{3})*|\d+)\s+followers/i,
          /(\d{1,3}(?:[.,]\d{3})*|\d+)\s+(followers|volgers)/i
        ];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const s = (walker.currentNode.nodeValue || "").trim();
          if (!s) continue;
          for (const rx of rxList) {
            const m = s.match(rx);
            if (m) return parseInt(String(m[1]).replace(/[^\d]/g, ""), 10);
          }
        }
        return null;
      });
    }

    if (!Number.isFinite(followers)) {
      const payload = { error: "Could not parse followers (puppeteer)" };
      if (verbose) payload.sample = html.slice(0, 1200);
      return res.status(502).json(payload);
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ followers });
  } catch (e) {
    const payload = { error: "Puppeteer launch/run error", detail: String(e) };
    if (verbose) {
      payload.env = {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      };
    }
    return res.status(502).json(payload);
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
}
