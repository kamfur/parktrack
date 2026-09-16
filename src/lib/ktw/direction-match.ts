/** Canonical origin keys plus spellings staff/drivers actually type. */
export const DIRECTION_ALIASES: readonly { key: string; patterns: readonly string[] }[] = [
  {
    key: "london",
    patterns: ["london", "londyn", "luton", "gatwick", "stansted", "heathrow", "ltn", "lgw", "stn", "lhr"],
  },
  { key: "dortmund", patterns: ["dortmund", "dtm"] },
  { key: "frankfurt", patterns: ["frankfurt", "hahn", "fra", "hhn"] },
  { key: "cologne", patterns: ["cologne", "koln", "koeln", "kolonia", "cgn"] },
  { key: "eindhoven", patterns: ["eindhoven", "ein"] },
  { key: "amsterdam", patterns: ["amsterdam", "ams"] },
  { key: "brussels", patterns: ["brussels", "bruksela", "bru", "crl", "charleroi"] },
  { key: "milan", patterns: ["milan", "mediolan", "bergamo", "mxp", "bgy", "lin"] },
  { key: "rome", patterns: ["rome", "rzym", "fiumicino", "ciampino", "fco", "cia"] },
  { key: "dublin", patterns: ["dublin", "dub"] },
  { key: "athens", patterns: ["athens", "ateny", "ath"] },
  { key: "tel aviv", patterns: ["tel aviv", "tel-aviv", "telaviv", "tlv"] },
  { key: "antalya", patterns: ["antalya", "antalia", "ayt"] },
  { key: "barcelona", patterns: ["barcelona", "bcn"] },
  { key: "paris", patterns: ["paris", "paryz", "cdg", "ory", "bva", "beauvais"] },
  { key: "oslo", patterns: ["oslo", "osl"] },
  { key: "stockholm", patterns: ["stockholm", "stokholm", "arn", "bma", "nyo"] },
  { key: "copenhagen", patterns: ["copenhagen", "kopenhaga", "cph"] },
  { key: "malaga", patterns: ["malaga", "agp"] },
  { key: "alicante", patterns: ["alicante", "alc"] },
  { key: "split", patterns: ["split", "spu"] },
  { key: "dubrovnik", patterns: ["dubrovnik", "dbv"] },
  { key: "zaragoza", patterns: ["zaragoza", "zaz"] },
  { key: "bari", patterns: ["bari", "bri"] },
  { key: "naples", patterns: ["naples", "napoli", "nap"] },
  { key: "catania", patterns: ["catania", "cta"] },
  { key: "malta", patterns: ["malta", "mla"] },
  { key: "larnaca", patterns: ["larnaca", "larnaka", "lca"] },
  { key: "heraklion", patterns: ["heraklion", "iraklion", "her"] },
  { key: "rhodes", patterns: ["rhodes", "rodos", "rho"] },
  { key: "corfu", patterns: ["corfu", "korfu", "cfu"] },
];

const LEGACY_DIRECTION = new Set(["departure", "arrival"]);

export function foldDirectionText(value: string): string {
  return value.trim().toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/\p{M}/gu, "");
}

function tokens(folded: string): string[] {
  return folded.split(/[^a-z0-9]+/).filter(Boolean);
}

function textContainsPattern(haystack: string, pattern: string): boolean {
  const needle = foldDirectionText(pattern);
  if (!needle) return false;
  if (needle.length <= 3) {
    return tokens(haystack).includes(needle);
  }
  return haystack.includes(needle);
}

/** Canonical origin key for a stored flight_direction, or null when it cannot be mapped. */
export function matchDirectionKey(direction: string | null | undefined): string | null {
  if (direction == null) return null;
  const folded = foldDirectionText(direction);
  if (!folded) return null;
  if (LEGACY_DIRECTION.has(folded)) return null;

  for (const alias of DIRECTION_ALIASES) {
    if (alias.patterns.some((pattern) => textContainsPattern(folded, pattern))) {
      return alias.key;
    }
  }
  return null;
}

/** True when a KTW board origin label belongs to the same destination key. */
export function originMatchesKey(originLabel: string, key: string): boolean {
  const alias = DIRECTION_ALIASES.find((entry) => entry.key === key);
  if (!alias) return false;
  const foldedOrigin = foldDirectionText(originLabel);
  if (!foldedOrigin) return false;
  return alias.patterns.some((pattern) => textContainsPattern(foldedOrigin, pattern));
}
