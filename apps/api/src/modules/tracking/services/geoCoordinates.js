/**
 * Indian Logistics Hub Geographic Coordinates Resolver
 * Provides standard latitude and longitude for major Indian industrial and transport hubs.
 */

const INDIAN_HUB_COORDINATES = {
  // Northern Corridor
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  'ncr': { lat: 28.5355, lng: 77.3910 },
  'noida': { lat: 28.5355, lng: 77.3910 },
  'greater noida': { lat: 28.4744, lng: 77.5040 },
  'gurgaon': { lat: 28.4595, lng: 77.0266 },
  'gurugram': { lat: 28.4595, lng: 77.0266 },
  'faridabad': { lat: 28.4089, lng: 77.3178 },
  'ghaziabad': { lat: 28.6692, lng: 77.4538 },
  'ludhiana': { lat: 30.9010, lng: 75.8573 },
  'chandigarh': { lat: 30.7333, lng: 76.7794 },
  'amritsar': { lat: 31.6340, lng: 74.8723 },
  'jalandhar': { lat: 31.3260, lng: 75.5762 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'jodhpur': { lat: 26.2389, lng: 73.0243 },
  'udaipur': { lat: 24.5854, lng: 73.7125 },
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  'kanpur': { lat: 26.4499, lng: 80.3319 },
  'varanasi': { lat: 25.3176, lng: 82.9739 },
  'agra': { lat: 27.1767, lng: 78.0081 },
  'meerut': { lat: 28.9845, lng: 77.7064 },

  // Western Corridor
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'navi mumbai': { lat: 19.0330, lng: 73.0297 },
  'jnpt': { lat: 18.9499, lng: 72.9515 },
  'thane': { lat: 19.2183, lng: 72.9781 },
  'bhiwandi': { lat: 19.2967, lng: 73.0631 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'chakan': { lat: 18.7610, lng: 73.8566 },
  'nagpur': { lat: 21.1458, lng: 79.0882 },
  'nashik': { lat: 19.9975, lng: 73.7898 },
  'aurangabad': { lat: 19.8762, lng: 75.3433 },
  'chhatrapati sambhajinagar': { lat: 19.8762, lng: 75.3433 },
  'kolhapur': { lat: 16.7050, lng: 74.2433 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'surat': { lat: 21.1702, lng: 72.8311 },
  'vadodara': { lat: 22.3072, lng: 73.1812 },
  'rajkot': { lat: 22.3039, lng: 70.8022 },
  'gandhidham': { lat: 23.0753, lng: 70.1337 },
  'mundra': { lat: 22.8394, lng: 69.7258 },
  'kandla': { lat: 23.0333, lng: 70.2167 },

  // Southern Corridor
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'madras': { lat: 13.0827, lng: 80.2707 },
  'sriperumbudur': { lat: 12.9667, lng: 79.9500 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'secunderabad': { lat: 17.4399, lng: 78.4983 },
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'kochi': { lat: 9.9312, lng: 76.2673 },
  'cochin': { lat: 9.9312, lng: 76.2673 },
  'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
  'vizag': { lat: 17.6868, lng: 83.2185 },
  'vijayawada': { lat: 16.5062, lng: 80.6480 },
  'madurai': { lat: 9.9252, lng: 78.1198 },
  'mysore': { lat: 12.2958, lng: 76.6394 },
  'mysuru': { lat: 12.2958, lng: 76.6394 },

  // Eastern & Central Corridor
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'howrah': { lat: 22.5958, lng: 88.2636 },
  'haldia': { lat: 22.0667, lng: 88.0667 },
  'jamshedpur': { lat: 22.8046, lng: 86.2029 },
  'ranchi': { lat: 23.3441, lng: 85.3096 },
  'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
  'cuttack': { lat: 20.4625, lng: 85.8828 },
  'patna': { lat: 25.5941, lng: 85.1376 },
  'guwahati': { lat: 26.1445, lng: 91.7362 },
  'indore': { lat: 22.7196, lng: 75.8577 },
  'bhopal': { lat: 23.2599, lng: 77.4126 },
  'raipur': { lat: 21.2514, lng: 81.6296 },
  'jabalpur': { lat: 23.1815, lng: 79.9864 },
  'gwalior': { lat: 26.2183, lng: 78.1828 }
};

/**
 * Resolves latitude and longitude for a given location record.
 * Checks explicit coordinates first, then city lookup, then state center fallback.
 * @param {Object} location Location mongoose document or plain object
 * @returns {{ lat: number, lng: number, source: string }}
 */
function resolveCoordinates(location) {
  if (!location) {
    return { lat: 20.5937, lng: 78.9629, source: 'DEFAULT_INDIA_CENTER' };
  }

  // 1. Explicit valid coordinates on record
  if (
    typeof location.coordinates?.lat === 'number' &&
    typeof location.coordinates?.lng === 'number' &&
    location.coordinates.lat !== 0 &&
    location.coordinates.lng !== 0
  ) {
    return {
      lat: location.coordinates.lat,
      lng: location.coordinates.lng,
      source: 'EXPLICIT_RECORD'
    };
  }

  // 2. City name lookup in Indian Logistics Hub registry
  const city = (location.address?.city || location.name || '').trim().toLowerCase();
  if (INDIAN_HUB_COORDINATES[city]) {
    return {
      ...INDIAN_HUB_COORDINATES[city],
      source: 'CITY_GEOCODE'
    };
  }

  // Check substring match
  for (const [hubName, coords] of Object.entries(INDIAN_HUB_COORDINATES)) {
    if (city.includes(hubName) || hubName.includes(city)) {
      return {
        ...coords,
        source: 'FUZZY_GEOCODE'
      };
    }
  }

  // 3. Fallback to Geographic Center of India (Nagpur Zero Mile region)
  return {
    lat: 21.1458,
    lng: 79.0882,
    source: 'CENTRAL_HUB_FALLBACK'
  };
}

module.exports = {
  INDIAN_HUB_COORDINATES,
  resolveCoordinates
};
