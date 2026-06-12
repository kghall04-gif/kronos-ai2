export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { query, location = 'Hamilton, New Zealand' } = req.query;
  if (!query) return res.status(400).json({ error: 'Missing query param' });

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) return res.status(500).json({ error: 'Missing API key' });

  try {
    // Step 1: Geocode the location
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${key}`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return res.status(400).json({ error: 'Could not geocode location' });

    const { lat, lng } = geoData.results[0].geometry.location;

    // Step 2: Text Search
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=20000&key=${key}`
    );
    const searchData = await searchRes.json();
    if (!searchData.results?.length) return res.status(200).json([]);

    // Step 3: Fetch details for each place (up to 20)
    const places = searchData.results.slice(0, 20);
    const details = await Promise.all(
      places.map(async (place) => {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,business_status&key=${key}`
        );
        const detailData = await detailRes.json();
        const d = detailData.result || {};
        return {
          name: d.name || place.name,
          address: d.formatted_address || place.formatted_address || '',
          phone: d.formatted_phone_number || null,
          website: d.website || null,
          rating: d.rating || place.rating || null,
          reviewCount: d.user_ratings_total || place.user_ratings_total || 0,
          openNow: d.opening_hours?.open_now ?? null,
          status: d.business_status || 'OPERATIONAL',
        };
      })
    );

    return res.status(200).json(details);
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong', detail: err.message });
  }
}
