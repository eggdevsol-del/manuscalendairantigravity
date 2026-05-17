import geoip from 'geoip-lite';

export function resolveCountry(ip: string): 'AU' | 'NZ' {
  // If no IP is provided (e.g., local dev sometimes), default to AU
  if (!ip) return 'AU';

  const geo = geoip.lookup(ip);
  
  if (geo?.country === 'NZ') {
    return 'NZ';
  }
  
  // Default to AU for anything unresolved, unexpected, or AU itself.
  return 'AU';
}
