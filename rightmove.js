const puppeteer = require('puppeteer-core');
async function scrapeRightmove(url) {
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

    // Rightmove embeds all listing data in window.PAGE_MODEL — extract it
    const raw = await page.evaluate(() => {
      return window.PAGE_MODEL || null;
    });

    if (!raw) {
      // Fallback: DOM scraping if PAGE_MODEL not available
      return await scrapeDom(page, url);
    }

    return parsePageModel(raw, url);

  } finally {
    if (browser) await browser.close();
  }
}

// ── Parse window.PAGE_MODEL ───────────────────────────────────────────────────
function parsePageModel(model, url) {
  const p = model.propertyData || {};

  // Photos
  const photos = (p.images || []).map(img => ({
    url: img.srcUrl || img.url || '',
    caption: img.caption || ''
  }));

  // Floorplans
  const floorplans = (p.floorplans || []).map(fp => ({
    url: fp.url || fp.srcUrl || '',
    caption: fp.caption || 'Floorplan'
  }));

  // Room breakdown
  const rooms = (p.roomsInformation || []).map(r => ({
    name: r.roomLabel || r.name || '',
    dimensions: r.roomDimensions || '',
    description: r.roomDescription || ''
  }));

  // Key features
  const features = p.keyFeatures || [];

  // Location
  const loc = p.location || {};
  const address = p.address || {};

  // Price
  const price = p.prices || {};
  const priceValue = price.primaryPrice || '';
  const priceNum = parseInt((priceValue || '').replace(/[^0-9]/g, '')) || 0;

  // Agent
  const agent = p.customer || {};

  // EPC
  const epc = p.epc || {};

  // Let type / tenure
  const tenure = (p.tenure || {}).tenureType || '';

  // Listing status
  const status = (p.status || {}).displayText || 'For Sale';

  // Added / reduced dates
  const added = p.listingUpdate || {};

  return {
    source: 'rightmove',
    url,
    rightmoveId: extractRightmoveId(url),

    // Address
    address: [
      address.displayAddress || '',
    ].filter(Boolean).join(', '),
    postcode: (address.displayAddress || '').split(',').pop().trim(),

    // Core details
    price: priceNum,
    priceDisplay: priceValue,
    status,
    beds: p.bedrooms || 0,
    baths: p.bathrooms || 0,
    propertyType: p.propertySubType || p.propertyType || '',
    tenure,

    // Content
    description: p.text ? (p.text.description || '') : '',
    features,
    rooms,

    // Media
    photos,
    floorplans,

    // EPC
    epc: {
      currentRating: epc.eer ? epc.eer.currentRating : '',
      potentialRating: epc.eer ? epc.eer.potentialRating : '',
      url: epc.url || ''
    },

    // Location
    lat: loc.latitude || null,
    lng: loc.longitude || null,

    // Agent
    agentName: agent.branchDisplayName || agent.companyName || '',
    agentPhone: agent.contactTelephone || '',
    agentBranchId: agent.branchId || '',

    // Dates
    addedDate: added.listingUpdateDate || '',
    addedReason: added.listingUpdateReason || '',

    scrapedAt: new Date().toISOString()
  };
}

// ── DOM fallback ──────────────────────────────────────────────────────────────
async function scrapeDom(page, url) {
  const data = await page.evaluate(() => {
    const getText = sel => {
      const el = document.querySelector(sel);
      return el ? el.innerText.trim() : '';
    };
    const getAttr = (sel, attr) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute(attr) : '';
    };

    // Photos
    const photos = Array.from(document.querySelectorAll('img[src*="media.rightmove.co.uk"]'))
      .map(img => ({ url: img.src, caption: img.alt || '' }))
      .filter(p => p.url.includes('/property-images/'));

    // Price
    const priceText = getText('[data-testid="price"]') || getText('.property-header-price strong');
    const priceNum = parseInt((priceText || '').replace(/[^0-9]/g, '')) || 0;

    // Beds / baths from page title or articles
    const bedsText = getText('[data-testid="beds-label"]') || '';
    const bathsText = getText('[data-testid="baths-label"]') || '';

    // Description
    const desc = getText('.property-description') ||
                 getText('[data-testid="description"]') ||
                 getText('.sect-text');

    // Key features
    const features = Array.from(
      document.querySelectorAll('.key-features li, [data-testid="key-features"] li')
    ).map(li => li.innerText.trim());

    // Address
    const address = getText('h1[itemprop="name"]') ||
                    getText('[data-testid="address-label"]') ||
                    getText('.property-header-bedroom-and-price h1');

    return { photos, priceText, priceNum, bedsText, bathsText, desc, features, address };
  });

  return {
    source: 'rightmove',
    url,
    rightmoveId: extractRightmoveId(url),
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

function extractRightmoveId(url) {
  const m = url.match(/properties\/(\d+)/);
  return m ? m[1] : '';
}

module.exports = { scrapeRightmove };
