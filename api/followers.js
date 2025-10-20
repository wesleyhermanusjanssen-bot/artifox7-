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
      "Accept-L
