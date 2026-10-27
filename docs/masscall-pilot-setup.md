# Dedicated Masscall pilot setup

This code connects a Premium deal to one recorded call through a separate Masscall service. It is limited to explicitly listed internal test destinations. No live calls are enabled by these repository changes.

## Prepare the two runtimes

1. Apply `supabase/deals.sql` to the Libergent Supabase project. The new `deal_calls` table is service-role only and stores buyer approval, contact permission acknowledgement, call state, and recording metadata.
2. Run a separate Masscall deployment and bridge with a dedicated Twilio subaccount, a number owned by that subaccount, a distinct bridge secret and model key, and no owner dashboard token. Restrict access to its `/v1/calls` service route.
3. Set the same random 32+ character service token as `MASSCALL_SERVICE_TOKEN` in Libergent and `LIBERGENT_SERVICE_TOKEN` in the dedicated Masscall instance. Set `MASSCALL_SERVICE_URL` to that instance's HTTPS origin, and use the same dedicated number for `MASSCALL_CALLER_ID` and `LIBERGENT_CALLER_ID`.
4. Set matching comma-separated `LIBERGENT_ALLOWED_DESTINATIONS` to internal recipients who have authorized the call and recording. Set `LIBERGENT_RECORDING_RETENTION_DAYS` to an integer from 1 to 30. The hourly Libergent cron deletes provider recordings older than this many days; the buyer can delete a finished recording sooner.
5. Keep `LIBERGENT_CALLING_ENABLED=0`, `MASSCALL_LIBERGENT_MODE=0`, and `ENABLE_LIVE_CALLS=false` until the configuration, contact source, recording consent, costs, and call behavior have been reviewed. Enable these flags for the controlled pilot only.

The Masscall service checks its dedicated token, mode, caller number ownership, pilot destination list, Romanian number format, bridge configuration, and five-minute Twilio time limit. Libergent checks Premium entitlement, deal ownership, deal state, a per-deal daily call limit, buyer approval, and the contact and recording acknowledgements. A unique key reserves each call before dialing; a database index permits only one pending or active pilot call across the service. The buyer can refresh status, stop a call, play a ready recording, and delete it through deal-scoped endpoints.

## Current limits

- A timed-out submission with no returned provider call ID remains `unknown` and must be investigated manually. Retrying with a new key is unsafe. An acceptance callback was proposed but is not part of this implementation.
- Status and recording readiness are read when the buyer refreshes the call. There are no provider event callbacks or automatic state reconciliation for calls without a provider ID.
- The pilot allowlist is the destination gate. There is no marketplace-wide permission engine, seller opt-out registry, provider cost accounting, or multi-call budget. Do not invite sellers or expand the allowlist until those operating rules are implemented and tested.
- The recording starts through the existing Masscall Twilio path. Only pre-consented internal pilot recipients should be called. The buyer acknowledgement is an evidence marker, not independent proof of the recipient's consent.

No migration, deployment, provider account change, number provisioning, or live call was performed while preparing this integration.
