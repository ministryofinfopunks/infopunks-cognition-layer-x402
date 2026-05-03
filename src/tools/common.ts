const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it", "its", "of", "on",
  "or", "that", "the", "their", "this", "to", "was", "were", "will", "with", "into", "than", "then", "over", "under"
]);

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

export function uniqueTokens(value: string): string[] {
  return Array.from(new Set(tokenize(value)));
}

export function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = Array.from(leftSet).filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toPercent(value: number): number {
  return Math.round(clamp(value, 0, 1) * 100);
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
