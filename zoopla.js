const fetch = require('node-fetch');

async function scrapeZoopla(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9'
    }
  });

  const html = await response.text();

  // Extract __NEXT_DATA__ JSON
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s);
  if (!match) throw new Error('Could not find __NEXT_DATA__ in Zoopla page');

  const data = JSON.parse(match[1]);
  const pageProps = ((data.props || {}).pageProps) || {};
  const listing = pageProps.listing || pageProps.propertyDetails || {};
  const details = listing.details || listing;

  const addr = details.address || {};
  const price = details.pricing || details.price || {};
  const media = details.media || {};
  const content = details.content || {};

  const photos = (media.images || []).map(img => ({ url: img.url || '', caption: img.caption || '' }));
  const floorplans = (media.floorplans || []).map(fp => ({ url: fp.url || '', caption: 'Floorplan' }));
  const features = content.bulletPoints || details.keyFeatures || [];
  const priceNum = parseInt((price.displayPrice || '').replace(/[^0-9]/g, '')) || 0;
  const branch = details.branch || {};

  return {
    source: 'zoopla',
    url,
    zooplaId: (url.match(/\/(\d+)\/?$/) || [])[1] || '',
    address: addr.displayAddress || addr.streetName || '',
    postcode: addr.postcode || '',
    price: priceNum,
    priceDisplay: price.displayPrice || '',
    beds: details.beds || details.numBedrooms || 0,
    baths: details.baths || details.numBathrooms || 0,
    propertyType: details.propertyType || '',
    tenure: details.tenure || '',
    description: content.description || details.description || '',
    features: Array.isArray(features) ? features : [],
    rooms: [],
    photos,
    floorplans,
    epc: {},
    lat: (details.location || {}).latitude || null,
    lng: (details.location || {}).longitude || null,
    agentName: branch.name || '',
    agentPhone: branch.phone || '',
    scrapedAt: new Date().toISOString()
  };
}

module.exports = { scrapeZoopla };
