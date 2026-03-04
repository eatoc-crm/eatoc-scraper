const express = require('express');
const cors = require('cors');
const { scrapeRightmove } = require('./rightmove');
const { scrapeZoopla } = require('./zoopla');
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.EATOC_SCRAPER_KEY;

app.use(cors());
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (!API_KEY) return next(); // no key set = open (dev mode)
  const provided = req.headers['x-api-key'] || req.query.key;
  if (provided !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  next();
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'EATOC Scraper', version: '1.0.0' });
});

// ── Single property scrape ────────────────────────────────────────────────────
// POST /scrape  { "url": "https://www.rightmove.co.uk/properties/12345678" }
// POST /scrape  { "url": "https://www.zoopla.co.uk/for-sale/details/12345678" }
app.post('/scrape', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  console.log(`[scrape] ${url}`);

  try {
    let data;
    if (url.includes('rightmove.co.uk')) {
      data = await scrapeRightmove(url);
    } else if (url.includes('zoopla.co.uk')) {
      data = await scrapeZoopla(url);
    } else {
      return res.status(400).json({ error: 'URL must be a Rightmove or Zoopla listing' });
    }
    res.json({ success: true, source: data.source, property: data });
  } catch (err) {
    console.error(`[scrape error] ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Batch scrape ──────────────────────────────────────────────────────────────
// POST /scrape/batch  { "urls": ["https://...", "https://..."] }
// Max 20 at a time, sequential with 2s delay to be polite
app.post('/scrape/batch', auth, async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'urls array is required' });
  }
  if (urls.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 URLs per batch' });
  }

  console.log(`[batch] ${urls.length} properties`);

  const results = [];
  for (const url of urls) {
    try {
      let data;
      if (url.includes('rightmove.co.uk')) {
        data = await scrapeRightmove(url);
      } else if (url.includes('zoopla.co.uk')) {
        data = await scrapeZoopla(url);
      } else {
        results.push({ url, success: false, error: 'Unsupported portal' });
        continue;
      }
      results.push({ url, success: true, property: data });
    } catch (err) {
      results.push({ url, success: false, error: err.message });
    }
    // polite delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  res.json({
    success: true,
    total: urls.length,
    scraped: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  });
});

app.listen(PORT, () => {
  console.log(`EATOC Scraper running on port ${PORT}`);
  if (!API_KEY) console.warn('WARNING: EATOC_SCRAPER_KEY not set — service is open!');
});
