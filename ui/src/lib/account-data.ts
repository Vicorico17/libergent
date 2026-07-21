export const SAVED_LISTINGS_STORAGE_KEY = "libergent-saved-listings-v1";
const SAVED_LISTING_RECORDS_STORAGE_KEY = "libergent-saved-listing-records-v1";
const ALERTS_STORAGE_KEY = "libergent-account-alerts-v1";
const ACTIVITY_STORAGE_KEY = "libergent-account-activity-v1";

export type SavedListingRecord = {
  id: string;
  title: string;
  url: string;
  source: string;
  priceLabel: string;
  image: string;
  city: string;
  condition: string;
  query: string;
  savedAt: string;
};

export type AccountAlertRecord = {
  id: string;
  query: string;
  email: string;
  enabled: boolean;
  createdAt: string;
  syncStatus: "synced" | "local";
};

export type AccountActivityRecord = {
  id: string;
  query: string;
  tier: "free" | "premium";
  searchedAt: string;
  resultCount: number;
  bestOfferTitle: string;
  bestOfferPrice: string;
  bestOfferUrl: string;
};

function accountKey(prefix: string, userId: string) {
  return `${prefix}:${userId}`;
}

function readRecords<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function writeRecords<T>(key: string, records: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(records));
}

export function readSavedListingIds(userId: string) {
  return new Set(readRecords<string>(accountKey(SAVED_LISTINGS_STORAGE_KEY, userId)).filter((value) => typeof value === "string"));
}

export function writeSavedListingIds(userId: string, ids: Set<string>) {
  writeRecords(accountKey(SAVED_LISTINGS_STORAGE_KEY, userId), [...ids]);
}

export function readSavedListings(userId: string) {
  return readRecords<SavedListingRecord>(accountKey(SAVED_LISTING_RECORDS_STORAGE_KEY, userId))
    .filter((record) => record && typeof record.id === "string")
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function upsertSavedListing(userId: string, record: SavedListingRecord) {
  const records = readSavedListings(userId).filter((entry) => entry.id !== record.id);
  writeRecords(accountKey(SAVED_LISTING_RECORDS_STORAGE_KEY, userId), [record, ...records].slice(0, 250));
}

export function removeSavedListing(userId: string, listingId: string) {
  const ids = readSavedListingIds(userId);
  ids.delete(listingId);
  writeSavedListingIds(userId, ids);
  writeRecords(
    accountKey(SAVED_LISTING_RECORDS_STORAGE_KEY, userId),
    readSavedListings(userId).filter((record) => record.id !== listingId),
  );
}

export function readAccountAlerts(userId: string) {
  return readRecords<AccountAlertRecord>(accountKey(ALERTS_STORAGE_KEY, userId))
    .filter((record) => record && typeof record.id === "string")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function writeAccountAlerts(userId: string, alerts: AccountAlertRecord[]) {
  writeRecords(accountKey(ALERTS_STORAGE_KEY, userId), alerts.slice(0, 100));
}

export function readAccountActivity(userId: string) {
  return readRecords<AccountActivityRecord>(accountKey(ACTIVITY_STORAGE_KEY, userId))
    .filter((record) => record && typeof record.id === "string")
    .sort((a, b) => b.searchedAt.localeCompare(a.searchedAt));
}

export function recordAccountActivity(userId: string, activity: AccountActivityRecord) {
  const records = readAccountActivity(userId).filter((record) => record.id !== activity.id);
  writeRecords(accountKey(ACTIVITY_STORAGE_KEY, userId), [activity, ...records].slice(0, 100));
}
