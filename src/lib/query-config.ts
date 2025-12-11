// Lightweight configuration for intent aliases and official source detection

export function getOfficialHosts(): string[] {
  const fromEnv = (process.env.OFFICIAL_DOMAINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const defaults = ['muscatairport.co.om', 'www.muscatairport.co.om'];
  return (fromEnv.length > 0 ? fromEnv : defaults).map(h => h.replace(/^www\./, ''));
}

export const ALIASES: Record<string, string[]> = {
  // Normalized → aliases that should map to it
  'parking rates': ['parking charges', 'parking fees', 'parking tariff', 'car park rates', 'car park charges', 'parking cost', 'rate for 1 hr', '1 hr rate', 'one hour rate'],
  'currency exchange': ['money exchange', 'foreign exchange', 'forex counter', 'exchange money', 'exchange currency'],
  'banking': ['atm', 'cash withdrawal', 'bank counter', 'banks'],
  'hotel': ['aerotel', 'airport hotel'],
  'e-gates': ['egates', 'e gate', 'electronic gate', 'automated immigration'],
  'smoking': ['smoking area', 'smoking zone'],
  'spa': ['spa services', 'be relax', 'berelax', 'massage', 'relaxation', 'be relax spa']
};

export function isOfficialSource(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).host.replace(/^www\./, '');
    const hosts = getOfficialHosts();
    return hosts.some(h => host.endsWith(h));
  } catch {
    // Fallback for non-URL strings
    const hosts = getOfficialHosts();
    return hosts.some(h => (url || '').includes(h));
  }
}

export function getStrictIntentsFromEnv(): Set<string> {
  const raw = process.env.KB_STRICT_INTENTS || '';
  const set = new Set<string>();
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
  // Provide sensible defaults if not set
  if (set.size === 0) {
    ['hotel-services','smoking-facilities','banking-services','currency-exchange','e-gates','children-travel','wifi-services','spa-services'].forEach(s => set.add(s));
  }
  return set;
}

export function getStrictScoreThreshold(): number {
  const n = Number(process.env.KB_STRICT_SCORE || '40');
  return Number.isFinite(n) ? n : 40;
}


