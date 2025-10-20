// Vercel Serverless Function — gebruikt Puppeteer (headless Chrome) om live het aantal followers op te halen.
// Dit werkt ook als het getal pas zichtbaar is na JavaScript-rendering.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const config = {
  maxDuration: 20, // tot 20 seconden runtime
  memory: 1024,    // 1 GB RAM (nodig voor headless Chrome)
};

export default async function handler(req, res) {
  const url = req.query.url || "https://gamefound.com/en/projects/artifox/artifox";
  let browser;
  try {
    const exePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1200, height: 800 },
      executablePath: exePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9,nl;q=0.8",
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Scrol een beetje zodat dynamische elementen geladen worden
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.waitForTimeout(1000);

    // Haal de hele HTML op
    const html = await page.content();

    let followers = null;
    let m =
      html.match(/Join\\s+(\\d{1,3}(?:[.,]\\d{3})*|\\d+)\\s+followers/i) ||
      html.match(/\\bFollow\\b[^\\d]{0,40}[\\(\\[]\\s*(\\d{1,3}(?:[.,]\\d{3})*|\\d+)\\s*[\\)\\]]/i) ||
      html.match(/[\\(\\[]\\s*(\\d{1,3}(?:[.,]\\d{3})*|\\d+)\\s*[\\)\\]][^\\n]{0,40}\\bFollow\\b/i) ||
      html.match(/(\\d{1,3}(?:[.,]\\d{3})*|\\d+)\\s+(followers|volgers)\\b/i) ||
      html.match(/\\bfollowers?\\b.{0,80}?(\\d{1,3}(?:[.,]\\d{3})*|\\d+)/i) ||
      html.match(/(\\d{1,3}(?:[.,]\\d{3})*|\\d+).{0,80}?\\bfollowers?\\b/i);

    if (m) followers = parseInt(m[1].replace(/[^\\d]/g, ""), 10);

    if (!Number.isFinite(followers)) {
      return res.status(502).json({ error: "Kon aantal followers niet vinden in pagina" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ followers });
  } catch (e) {
    return res.status(502).json({ error: "Puppeteer fout", detail: String(e) });
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
}
