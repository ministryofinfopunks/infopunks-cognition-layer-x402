import type { AppConfig } from "./env.js";

export interface ToolPrice {
  priceUsd: string;
  priceAtomic: string;
}

export function usdToAtomic(value: string): string {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error("Tool price must be a positive decimal with at most 6 fractional digits.");
  }
  const parts = value.split(".");
  const whole = parts[0] ?? "0";
  const fraction = parts[1] ?? "";
  const atomic = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (atomic <= 0n) {
    throw new Error("Tool price must be greater than zero.");
  }
  return atomic.toString();
}

export function resolveToolPrice(config: AppConfig, envKey: string, fallback: string): ToolPrice {
  void config;
  const rawValue = process.env[envKey];
  const priceUsd = String(rawValue ?? fallback).trim();
  return {
    priceUsd,
    priceAtomic: usdToAtomic(priceUsd)
  };
}
