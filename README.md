# EATOC Scraper

Headless Chrome scraper for Rightmove and Zoopla listings. Runs on Railway, called by the EATOC CRM Data Migration page.

---

## What it returns

For each property URL you give it:

- Full description
- All photos (full resolution URLs)
- All floorplans
- Room-by-room breakdown with dimensions
- Key features list
- Beds, baths, property type, tenure
- Price
- EPC current/potential rating
- Lat/lng coordinates
- Agent name and phone
- Added date

---

## Deploy to Railway — Step by Step

### Step 1 — Create a GitHub repo

1. Go to [github.com](https://github.com) and click **New repository**
2. Name it `eatoc-scraper`
3. Set it to **Private**
4. Click **Create repository**
5. Upload all these files to the repo (drag and drop in the GitHub UI works fine):
   - `Dockerfile`
   - `package.json`
   - `server.js`
   - `scrapers/rightmove.js`
   - `scrapers/zoopla.js`
   - `README.md`

   **Important:** The `scrapers` folder must be a folder inside the repo, not loose files.

### Step 2 — Create a Railway project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `eatoc-scraper` repo
5. Railway will detect the Dockerfile automatically
6. Click **Deploy** — first build takes 3–5 minutes (it's installing Chrome)

### Step 3 — Set environment variables

Once deployed, click your service in Railway, then go to **Variables** tab:

| Variable | Value |
|----------|-------|
| `EATOC_SCRAPER_KEY` | Make up a strong password, e.g. `eatoc-scraper-2026-xK9mP` |
| `PORT` | `3000` |

Click **Save** — Railway will redeploy automatically.

### Step 4 — Get your Railway URL

1. In Railway, click your service
2. Go to **Settings** tab
3. Under **Domains**, click **Generate Domain**
4. You'll get a URL like: `https://eatoc-scraper-production.up.railway.app`

### Step 5 — Configure the EATOC CRM

1. Open your CRM and go to **Settings → Data Migration**
2. In the **Scraper Service URL** field, paste your Railway URL:
   `https://eatoc-scraper-production.up.railway.app`
3. In the **Scraper API Key** field, paste the `EATOC_SCRAPER_KEY` value you set
4. Click **Save Scraper Config**

---

## Testing it works

Open your browser and visit:
```
https://your-railway-url.up.railway.app/
```

You should see:
```json
{ "status": "ok", "service": "EATOC Scraper", "version": "1.0.0" }
```

That means it's running. Now test a scrape from the CRM.

---

## API reference

### POST /scrape
Scrape a single property.

```json
{
  "url": "https://www.rightmove.co.uk/properties/163278540"
}
```

Headers:
```
x-api-key: your-eatoc-scraper-key
Content-Type: application/json
```

### POST /scrape/batch
Scrape up to 20 properties at once.

```json
{
  "urls": [
    "https://www.rightmove.co.uk/properties/163278540",
    "https://www.zoopla.co.uk/for-sale/details/67890123"
  ]
}
```

---

## Monthly cost

Railway hobby plan: ~£5/month. No AI API costs for scraping.

---

## Troubleshooting

**Build fails:** Check that the `scrapers/` folder is present in your GitHub repo with both files inside.

**"Unauthorised" error:** Check the API key matches exactly between Railway Variables and CRM settings.

**Scrape returns empty data:** Rightmove/Zoopla may have changed their page structure. Check Railway logs (click your service → Logs tab) for error details and report to David.

**Timeout errors:** Some listings take longer. The scraper allows 30 seconds per page. If consistently timing out, Railway may need more RAM — upgrade to the $10/month plan.

