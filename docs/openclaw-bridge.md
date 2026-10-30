# OpenClaw WhatsApp bridge

This bridge runs on the OpenClaw VPS and exposes only an authenticated server-to-server send endpoint. It invokes the confirmed local OpenClaw CLI; it does not expose the gateway token to the browser.

On the OpenClaw host, from a checkout of this repository:

```bash
OPENCLAW_BRIDGE_TOKEN='generate-a-long-random-secret' \
OPENCLAW_DOCKER_CONTAINER='openclaw-dngq-openclaw-1' \
OPENCLAW_BRIDGE_HOST='127.0.0.1' \
OPENCLAW_BRIDGE_PORT='8788' \
node scripts/openclaw-bridge.js
```

Put an HTTPS reverse proxy in front of `127.0.0.1:8788` and expose only:

```text
GET  /health
POST /whatsapp/send
```

The POST endpoint expects an `Authorization: Bearer ...` header and:

```json
{
  "target": "+40722123456",
  "message": "Salut! ...",
  "media": null
}
```

The LiberGent backend then uses `OPENCLAW_BRIDGE_URL` and `OPENCLAW_BRIDGE_TOKEN` to call the bridge. The repository includes `scripts/openclaw-inbound-forwarder.js`, which polls OpenClaw session files and posts messages to the token-protected `/api/openclaw/inbound` endpoint. Its deployment and reliable receipt behavior still need production acceptance; use a supported provider event or webhook integration when available.

All `/api/whatsapp/send` requests require a UUID `idempotencyKey`, pass it to the bridge and reserve it in `deal_send_attempts` before delivery. Reapply `supabase/deals.sql` **before deploying this Worker/UI change**: it allows a null `deal_id` for one-off messages and adds `listing_url`. Missing schema or storage fails closed before a bridge call; older clients without keys receive 400. The route requires Agent access.

The same key cannot be reused by another account or for another seller, message, listing or deal. Accepted attempts return their saved receipt; pending, failed and unknown attempts return 409 without another bridge call. A timed-out or unknown attempt must be reconciled against the provider before starting a new attempt. This is per-key protection, not semantic deduplication of independently created requests.

The search UI keeps one-off attempt keys in session storage, scoped by a hash of account, seller, listing and message. Retries and reloads in the same tab reuse them. Initial-contact keys remain for the tab session; reply keys clear after confirmed acceptance with saved history so a later intentional reply can start a new attempt. No message text or credentials are stored there. Separate tabs/new sessions can create different keys; provider reconciliation and cross-session duplicate safeguards remain open. Storage-disabled browsers cannot initiate an untracked send.
