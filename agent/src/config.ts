import path from "node:path";

export const BUSINESSES = ["alpha", "bravo", "charlie", "delta"] as const;
export type Business = (typeof BUSINESSES)[number];

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const INVOICES_DIR = path.join(ROOT, "samples", "invoices");
export const LEDGERS_DIR = path.join(ROOT, "samples", "ledgers");
export const KEYS_DIR = path.join(ROOT, ".keys");
export const WASM_PATH = path.join(ROOT, "contract", "res", "deloop.wasm");
