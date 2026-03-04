const puppeteer = require('puppeteer-core');
async function scrapeZoopla(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Zoopla is Next.js — all data in __NEXT_DATA__ script tag
    const raw = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      if (el) {
        try { return JSON.parse(el.textContent); } catch (e) { return null; }
      }
      return null;
    });

    if (raw) {
      const parsed = parseNextData(raw, url);
      if (parsed) return parsed;
    }

    // Fallback: DOM scraping
    return await scrapeDom(page, url);

  } finally {
    if (browser) await browser.close();
  }
}

// ── Parse __NEXT_DATA__ ───────────────────────────────────────────────────────
function parseNextData(data, url) {
  try {
    // Zoopla nests listing under props.pageProps.listing or similar
    const pageProps = (((data.props || {}).pageProps) || {});
    const listing = pageProps.listing || pageProps.propertyDetails || pageProps.data || {};

    // Try multiple paths Zoopla uses
    const details = listing.details || listing.propertyDetail || listing;

    if (!details || !details.address) return null;

    const addr = details.address || {};
    const price = details.pricing || details.price || {};
    const media = details.media || {};
    const content = details.content || {};

    // Photos
    const photos = (media.images || []).map(img => ({
      url: img.url || img.srcUrl || '',
      caption: img.caption || ''
    }));

    // Floorplans
    const floorplans = (media.floorplans || []).map(fp => ({
      url: fp.url || '',
      caption: 'Floorplan'
    }));

    // Features
    const features = content.bulletPoints ||
                     details.features ||
                     details.keyFeatures || [];

    // Rooms
    const rooms = (details.floorLevels || []).flatMap(level =>
      (level.rooms || []).map(r => ({
        name: r.roomName || r.name || '',
        dimensions: r.dimensions || '',
        description: r.description || ''
      }))
    );

    // Agent
    const branch = details.branch || details.agent || {};

    // EPC
    const epc = details.epc || details.energyEfficiency || {};

    const priceNum = price.numericPrice ||
                     parseInt((price.displayPrice || '').replace(/[^0-9]/g, '')) || 0;

    return {
      source: 'zoopla',
      url,
      zooplaId: extractZooplaId(url),

      address: [addr.displayAddress || addr.streetName, addr.postcode]
        .filter(Boolean).join(', '),
      postcode: addr.postcode || '',

      price: priceNum,
      priceDisplay: price.displayPrice || '',
      status: details.listingStatus || details.saleType || 'For Sale',
      beds: details.beds || details.numBedrooms || 0,
      baths: details.baths || details.numBathrooms || 0,
      propertyType: details.propertyType || details.propertySubType || '',
      tenure: details.tenure || '',

      description: content.description || details.description || '',
      features: Array.isArray(features) ? features : [],
      rooms,

      photos,
      floorplans,

      epc: {
        currentRating: epc.currentRating || epc.eer || '',
        potentialRating: epc.potentialRating || '',
        url: epc.url || ''
      },

      lat: (details.location || {}).latitude || null,
      lng: (details.location || {}).longitude || null,

      agentName: branch.name || branch.branchName || '',
      agentPhone: branch.phone || branch.telephone || '',

      addedDate: details.firstPublishedDate || details.addedDate || '',

      scrapedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('[zoopla parseNextData error]', err.message);
    return null;
  }
}

// ── DOM fallback ──────────────────────────────────────────────────────────────
async function scrapeDom(page, url) {
  const data = await page.evaluate(() => {
    const getText = sel => {
      const el = document.querySelector(sel);
      return el ? el.innerText.trim() : '';
    };

    // Price
    const priceText = getText('[data-testid="price"]') ||
                      getText('p[data-testid="listing-price"]') || '';
    const priceNum = parseInt((priceText || '').replace(/[^0-9]/g, '')) || 0;

    // Address
    const address = getText('h1[data-testid="address-heading"]') ||
                    getText('address') ||
                    getText('h1');

    // Description
    const desc = getText('[data-testid="listing_description"]') ||
                 getText('.listing-description') || '';

    // Features
    const features = Array.from(
      document.querySelectorAll('[data-testid="listing_features"] li, .dp-features__list li')
    ).map(li => li.innerText.trim());

    // Photos
    const photos = Array.from(document.querySelectorAll('img'))
      .filter(img => img.src && img.src.includes('lid.zoocdn.com'))
      .map(img => ({ url: img.src.replace('_354_255', '_800_600'), caption: img.alt || '' }));

    // Beds / baths
    const bedsText = getText('[data-testid="beds-label"]') || '';
    const bathsText = getText('[data-testid="baths-label"]') || '';

    return { priceText, priceNum, address, desc, features, photos, bedsText, bathsText };
  });

  return {
    source: 'zoopla',
    url,
    zooplaId: extractZooplaId(url),
    address: data.address,
    price: data.priceNum,
    priceDisplay: data.priceText,
    beds: parseInt(data.bedsText) || 0,
    baths: parseInt(data.bathsText) || 0,
    description: data.desc,
    features: data.features,
    photos: data.photos,
    rooms: [],
    floorplans: [],
    epc: {},
    scrapedAt: new Date().toISOString(),
    _fallback: true
  };
}

function extractZooplaId(url) {
  const m = url.match(/\/(\d+)\/?$/);
  return m ? m[1] : '';
}

module.exports = { scrapeZoopla };
browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process'
  ]
});
