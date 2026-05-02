import { parseOlxMarkdown } from "../../parsers/olx.js";

export function createOlxStubAdapter({ markdown, crawlTs = new Date().toISOString() } = {}) {
  return {
    source: "olx",
    async discover() {
      const parsed = parseOlxMarkdown(markdown || "", 1);
      return parsed.items.map((_, index) => ({ index }));
    },
    async fetch_listing(handle) {
      const parsed = parseOlxMarkdown(markdown || "", 1);
      return parsed.items[handle.index] || null;
    },
    async normalize(rawListing) {
      return {
        listing: {
          externalId: rawListing?.url || "",
          title: rawListing?.title || "",
          url: rawListing?.url || "",
          price: rawListing?.price || null,
          currency: rawListing?.currency || null,
          location: rawListing?.location || null,
          postedAt: rawListing?.postedAt || null
        },
        metadata: {
          source: "olx",
          crawl_ts: crawlTs,
          observed_ts: crawlTs,
          reliability_score: 0.8,
          raw_payload_pointer: "fixture://olx-markdown"
        }
      };
    },
    async emit(record) {
      return record;
    }
  };
}
