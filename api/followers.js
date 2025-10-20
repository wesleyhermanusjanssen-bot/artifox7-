// Vercel Serverless Function — gebruikt Puppeteer (headless Chrome)
// om het aantal followers live van de Gamefound-pagina te halen.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

// ✅ Nieuwe correcte runtime-aanduiding
export const config = {
  runtime: "nodejs", // <-- DIT is nu correct
  maxDuration: 20,
  memory: 1024
};

export default async function handler(req, res) {
  const url = req.query.url || "https://gamefound.com/en/projects/artifox/artifox";
  let browser;
  try {
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1200, height: 800 },
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9,nl;q=0.8" });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.waitForTimeout(1000);

    const html = await page.content();
    let followers = null;

    let m =
      html.match(/Join\s+(\d{1,3}(?:[.,]\d{3})*|\d+)\s+followers/i) ||
      html.match(/\bFollow\b[^\d]{0,60}[\(\[]\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*[\)\]]/i) ||
      html.match(/[\(\[]\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*[\)\]][^\n]{0,60}\bFollow\b/i) ||
      html.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s+(followers|volgers)\b/i) ||
      html.match(/\bfollowers?\b.{0,120}?(\d{1,3}(?:[.,]\d{3})*|\d+)/i) ||
      html.match(/(\d{1,3}(?:[.,]\d{3})*|\d+).{0,120}?\bfollowers?\b/i);

    if (m) followers = parseInt(m[1].replace(/[^\d]/g, ""), 10);

    if (!Number.isFinite(followers)) {
      followers = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const s = walker.currentNode.nodeValue.trim();
          if (!s) continue;
          const rxList = [
            /Join\s+(\d{1,3}(?:[.,]\d{3})*|\d+)\s+followers/i,
            /(\d{1,3}(?:[.,]\d{3})*|\d+)\s+(followers|volgers)/i
          ];
          for (const rx of rxList) {
            const mm = s.match(rx);
            if (mm) return parseInt(mm[1].replace(/[^\d]/g, ""), 10);
          }
        }
        return null;
      });
    }

    if (!Number.isFinite(followers)) {
      return res.status(502).json({ error: "Kon aantal followers niet vinden (puppeteer)" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ followers });
  } catch (e) {
    return res.status(502).json({ error: "Puppeteer fout", detail: String(e) });
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
}
