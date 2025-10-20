# Artifox Followers (Vercel + Puppeteer)

Deze versie gebruikt headless Chromium op Vercel om het *werkelijke* followers-getal te lezen
(ook als het pas na JS-rendering zichtbaar is).

## Deploy
1) Pak deze map uit.
2) Vercel Dashboard → Add New → Project → Import manually → Upload **Folder** (de uitgepakte map).
3) Laat Build Command en Output Directory leeg.
4) Vercel installeert automatisch de dependencies uit package.json.
5) Open je URL en test:
   https://<jouw>.vercel.app/api/followers.js?url=https://gamefound.com/en/projects/artifox/artifox

## Let op
- Eerste cold start kan ~5–10s duren i.v.m. opstarten van Chromium.
- In `followers.js` hebben we `maxDuration: 20` en `memory: 1024` ingesteld.
