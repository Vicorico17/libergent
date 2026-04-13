import fs from "node:fs";
import path from "node:path";
import { buildHistoryEntry, buildHistoryPayloadFromEntries, MAX_HISTORY_ENTRIES } from "./history-base.js";
import { insertSearchEventToSupabase, isSupabaseConfigured, readSupabaseHistoryPayload } from "./supabase.js";

const DATA_ROOT = process.env.VERCEL ? "/tmp/libergent" : process.cwd();
const DATA_DIR = path.join(DATA_ROOT, "data");
const HISTORY_FILE = path.join(DATA_DIR, "search-history.json");

function ensureHistoryFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "[]\n", "utf8");
  }
}

function readHistoryEntries() {
  ensureHistoryFile();

  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistoryEntries(entries) {
  ensureHistoryFile();
  fs.writeFileSync(HISTORY_FILE, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

export async function logSearchEvent({ query, condition, provider, siteKeys, payload }) {
  const entries = readHistoryEntries();
  const entry = buildHistoryEntry({ query, condition, provider, siteKeys, payload });

  entries.unshift(entry);
  writeHistoryEntries(entries.slice(0, MAX_HISTORY_ENTRIES));

  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    await insertSearchEventToSupabase(entry);
  } catch (error) {
    console.warn("Failed to persist search event to Supabase:", error instanceof Error ? error.message : String(error));
  }
}

export async function buildHistoryPayload() {
  if (isSupabaseConfigured()) {
    try {
      return await readSupabaseHistoryPayload();
    } catch (error) {
      console.warn("Failed to read Supabase search history, falling back to local file:", error instanceof Error ? error.message : String(error));
    }
  }

  return buildHistoryPayloadFromEntries(readHistoryEntries());
}
