import { createHash } from "node:crypto";

function sanitizeString(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 16).map((item) => sanitizeValue(item));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "receipt")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sanitizeValue(item)] as const);
    return Object.fromEntries(entries);
  }
  return String(value);
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

export function createReceiptHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function createSanitizedResultHash(value: unknown): string {
  return createReceiptHash(sanitizeValue(value));
}
