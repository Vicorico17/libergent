# VINDE publishing

VINDE now uses the same saved announcement and hosted photos for OLX direct publishing and an Okazii XML import feed. Eight destinations remain available for assisted posting. No marketplace is reported as published merely because its page was opened or its feed was generated.

## Enable the backend

1. Apply `supabase/selling.sql` in the existing Supabase project. This adds private owner-scoped tables and the public `selling-images` bucket. The backend requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`). Existing Supabase browser authentication must be configured.
2. Set `SELLING_PUBLIC_URL` to the canonical app origin, such as `https://libergent.com`. In local development use the frontend origin, e.g. `http://localhost:3000`, so authorization returns to the frontend and its API proxy.
3. Generate a 32-byte encryption key using `openssl rand -hex 32`. Store the resulting 64 hexadecimal characters in the server secret `SELLING_ENCRYPTION_KEY`. Keep this key stable; replacing it makes stored OLX connections unreadable until users reconnect.
4. Obtain OLX partner access and set server secrets `OLX_CLIENT_ID` and `OLX_CLIENT_SECRET`. Register exactly `https://YOUR-ORIGIN/api/selling/olx/callback` with OLX. Never expose any of these secrets via `NEXT_PUBLIC_*`.
5. Deploy the application and have each seller choose **Conectează contul OLX** in VINDE. Credentials are exchanged server-side, encrypted with AES-GCM, and bound to the authenticated LiberGent user. Users can disconnect locally; OLX authorization can also be revoked in OLX.

The application displays disabled integration controls until configuration exists. Schema/bucket configuration problems return errors rather than simulated success. Changes in this task do not run the migration, configure secrets, or deploy automatically.

## Seller workflow

Enter a product; category-appropriate destinations are preselected and can be customized. **Publică peste tot** submits through ready integrations and starts a one-platform-at-a-time assisted queue for the remaining destinations. Each assisted step offers copy/open, per-field copying, photo links, explicit seller confirmation, and postponement. Opening a platform never marks it as published. Progress is saved locally for the current announcement. The UI separates **Anunțul tău** from **Conectează platformele**. The latter shows available connections and clearly labels manual-only platforms. Okazii’s **Obține linkul de conectare** creates/retrieves the seller’s persistent feed before any announcement is published; it does not confirm that Okazii has configured or consumed the feed. Original photos persist locally in IndexedDB across reloads and account-authorization redirects. They become publicly readable marketplace assets when uploaded for submission. Existing announcements can be recovered from the last 100 saved announcements in the publishing panel.

For OLX, select a leaf category, city and any district/required attributes from OLX's current catalog. Supply contact details and choose private/business seller. The backend sends `/api/partner/adverts` with the user's OAuth access token and `Version: 2.0`. A receipt with `active` is shown as published; every other provider status remains pending and can be refreshed. Creating a listing does not automatically buy packages, promotions or enable auto-extension.

For Okazii, submitting includes the product in one persistent, unguessable feed URL per seller. Configure that URL once in **Import produse → Import automat** in the seller's Okazii shop, map categories, and set delivery, payment and polling options there. Subsequent submitted announcements appear in the same feed. Titles are limited to 80 characters in this export; description and original title remain intact in LiberGent. Feed inclusion is not a confirmed import/publication. Removing a product from the feed does not guarantee removal of an already imported Okazii listing; withdraw it in Okazii too.

Facebook Marketplace, Publi24, LaJumate, Vinted, Autovit and Anunțul.ro use the clearly marked manual workflow with per-field copy and links. They do not have working auto-post integrations in this implementation. In particular, Vinted's official integration is limited to allowlisted Pro businesses; generic consumer accounts cannot be treated as connected API accounts.

## Reliability and operational limits

- Authentication protects all private routes. Every private database query includes the authenticated owner; no anonymous/direct browser policies grant table access.
- OAuth state is random, expires in ten minutes, is bound to an HttpOnly browser cookie, and is consumed once before exchanging a code.
- One durable publication record per owner, announcement and platform prevents double-click/reload/concurrent-request duplicates.
- Definitive HTTP validation rejection allows a corrected retry. A moderation rejection is a confirmed provider record, not permission to publish a duplicate. Timeout, malformed receipt, 5xx or a lost local receipt remains unknown/sending; never blindly resend.
- Refresh now looks up an unknown/sending submission without a provider ID using its exact `external_id` (the draft UUID), limited to two matches. One matching valid receipt can recover publication; absent, multiple, mismatched or malformed results do not permit a resend. This is read-only and uses the connected seller's OLX token. A late refresh cannot overwrite a concurrently confirmed receipt.
- Provider statuses distinguish published, pending, inactive and moderation-rejected adverts. Reapply `supabase/selling.sql` before the matching backend/UI deployment; it upgrades the status constraint without deleting publication records. Status mapping and external-ID lookup follow the [official OLX Partner API](https://developer.olx.ro/api/doc); live seller-account acceptance is still required.
- Provider failures are isolated: OLX failing does not prevent Okazii feed inclusion.
- Once sent to OLX, that announcement's saved snapshot cannot be overwritten by the draft-save endpoint. Edits do not update a live OLX listing; use OLX to edit or withdraw it. “Alt produs / anunț nou” creates a new identity for another product.
- There is no sold/inventory synchronization or automatic cross-platform delisting yet.
- Public image objects currently remain until removed through storage administration. Periodically clean unreferenced images and expired `selling_oauth_states` rows. Do not delete images referenced by active listings or feed entries.
- Okazii feed reads use owner-scoped keyset pagination, tolerating database page caps below the requested 200 rows. The current bound is 2,000 drafts and 21 database pages. Broken/non-progressing pages or limits return 503, never a partial XML inventory. Very large inventories and concurrent edits during feed generation still need separate acceptance/scaling work.

## Verification

`node --test src/selling.test.js` covers encryption/owner binding, input and image checks, escaped feed output, authorization/state, OLX payloads, duplicate prevention, ambiguous timeouts, definitive retries, partial failure and truthful provider status. Run UI TypeScript and ESLint checks too. Live publishing requires actual configured OLX partner credentials and seller authorization; mocked tests do not verify production acceptance.

Sources checked during implementation:
- [OLX Partner API](https://developer.olx.ro/api/doc)
- [Okazii import setup](https://ajutor.okazii.ro/magazine-okazii-ro/import-produse.html)
- [Okazii XML schema](https://ajutor.okazii.ro/wp-content/uploads/2017/12/product-import-manual_RO.pdf)
- [Vinted Pro API access](https://pro-docs.svc.vinted.com/)
