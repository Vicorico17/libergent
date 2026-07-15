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

The LiberGent backend then uses `OPENCLAW_BRIDGE_URL` and `OPENCLAW_BRIDGE_TOKEN` to call the bridge. Inbound messages still need a separate OpenClaw plugin/forwarder because this deployment does not expose a confirmed generic inbound webhook.
