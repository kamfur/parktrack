const LEGACY_DIRECTION = new Set(["departure", "arrival"]);

export function uniqueFlightDirections(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of values) {
    const value = raw?.trim();
    if (!value || LEGACY_DIRECTION.has(value.toLowerCase())) continue;
    const key = value.toLocaleLowerCase("pl");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }

  return unique.sort((left, right) => left.localeCompare(right, "pl", { sensitivity: "base" }));
}

export function filterFlightDirections(options: string[], query: string): string[] {
  const needle = query.trim().toLocaleLowerCase("pl");
  if (!needle) return options;
  return options.filter((option) => option.toLocaleLowerCase("pl").includes(needle));
}
