const fetch = require('node-fetch');

async function scrapeRightmove(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.google.co.uk/',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive'
    }
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} from Rightmove`);

  const html = await response.text();

  // Check if blocked
  if (html.includes('captcha') || html.includes('blocked') || html.length < 5000) {
    throw new Error('Rightmove returned a block/captcha page');
  }

  const match = html.match(/window\.PAGE_MODEL\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
  if (!match) throw new Error('Could not find PAGE_MODEL in Rightmove page');

  const model = JSON.parse(match[1]);
  const p = model.propertyData || {};
  const photos = (p.images || []).map(img => ({ url: img.srcUrl || '', caption: img.caption || '' }));
  const floorplans = (p.floorplans || []).map(fp => ({ url: fp.url || '', caption: 'Floorplan' }));
  const rooms = (p.roomsInformation || []).map(r => ({ name: r.roomLabel || '', dimensions: r.roomDimensions || '', description: r.roomDescription || '' }));
  const features = p.keyFeatures || [];
  const address = p.address || {};
  const price = p.prices || {};
  const priceNum = parseInt((price.primaryPrice || '').replace(/[^0-9]/g, '')) || 0;
  const agent = p.customer || {};
  const epc = p.epc || {};
  const loc = p.location || {};

  return {
    source: 'rightmove',
    url,
    rightmoveId: (url.match(/properties\/(\d+)/) || [])[1] || '',
    address: address.displayAddress || '',
    postcode: (address.displayAddress || '').split(',').pop().trim(),
    price: priceNum,
    priceDisplay: price.primaryPrice || '',
    beds: p.bedrooms || 0,
    baths: p.bathrooms || 0,
    propertyType: p.propertySubType || p.propertyType || '',
    tenure: (p.tenure || {}).tenureType || '',
    description: p.text ? (p.text.description || '') : '',
    features,
    rooms,
    photos,
    floorplans,
    epc: { currentRating: epc.eer ? epc.eer.currentRating : '', potentialRating: epc.eer ? epc.eer.potentialRating : '' },
    lat: loc.latitude || null,
    lng: loc.longitude || null,
    agentName: agent.branchDisplayName || '',
    agentPhone: agent.contactTelephone || '',
    scrapedAt: new Date().toISOString()
  };
}

module.exports = { scrapeRightmove };
