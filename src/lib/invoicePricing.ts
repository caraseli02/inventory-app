export function parseWeightKgFromProductName(name: string): number | undefined {
  if (!name) return undefined;

  const match = name.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (!match) return undefined;

  const rawValue = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(rawValue) || rawValue <= 0) return undefined;

  const unit = match[2].toLowerCase();
  if (unit === 'kg' || unit === 'l') return rawValue;
  if (unit === 'g' || unit === 'ml') return rawValue / 1000;

  return undefined;
}
