# Picture search

The camera button on the homepage, search results, and shared search bar opens a photo picker. The browser resizes JPEG, PNG, and WebP photos to at most 1280 pixels on the longest edge and encodes JPEG before uploading. Users review/edit the suggested Romanian query before running the normal marketplace search. This is photo-to-query recognition, not visual ranking of marketplace photos.

`POST /api/image-search` accepts raw image bytes with the matching image content type. The shared Node/Worker handler enforces a 4 MiB actual-body limit and checks file signatures. It calls Groq with a 25-second timeout and validates the JSON response. Photos are sent to Groq; LiberGent does not persist them or log their contents.

Set `GROQ_API_KEY` as a Cloudflare secret using `npx wrangler secret put GROQ_API_KEY`. For `wrangler dev`, use an ignored `.dev.vars`; the Node development server reads `.env.local` or `.env`. Never put credentials in `NEXT_PUBLIC_*` variables. `GROQ_VISION_MODEL` optionally overrides the default `qwen/qwen3.8-27b`.

Production enables `IMAGE_SEARCH_LIMITS_ENABLED=1`, with dedicated client (2/minute) and shared (3/minute) rate-limit bindings. These are per-location burst controls, not a global daily spending cap. Groq's own quota still applies; HTTP 429 offers a text-search fallback. Review these limits if moving to a paid Groq plan.

Verification: `node --test src/image-search.test.js`, UI lint/build, and browser checks for upload, editable query, empty-query handling, navigation, and mobile layout. Live recognition must also be checked against the configured account/model.
