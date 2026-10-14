# Sell through your agent

An agent with terminal access can use `node src/selling-agent.js --help`. This is a CLI entry point, not an installed ChatGPT connector. It uses the same authenticated APIs and duplicate protection as VINDE.

Configure `LIBERGENT_URL` and the seller's Supabase access token as `LIBERGENT_ACCESS_TOKEN` through the agent's secure environment. Never put credentials in prompts, command arguments, or committed files. Expired tokens need renewal through your authenticated session. Server setup and marketplace connections are described in [selling-publishing-setup.md](selling-publishing-setup.md).

Suggested instruction:

> Sell my iPhone 14 for 1500 lei in București through LiberGent. It has small scratches and includes the box and cable. Use my attached photos. Publish to my connected supported marketplaces and tell me which ones still need action.

Agent workflow:

1. Run `status`. If unavailable, explain the missing connection; do not claim publication.
2. Turn the seller's text into listing fields. Ask for missing price, location, condition, photos or required platform details; do not invent facts. Select marketplaces appropriate to the product.
3. Use `catalog` to find official OLX category/city IDs and required attributes. Upload seller-provided images with `upload`; use only returned image URLs.
4. Generate a UUID once per product and retain it across retries. Save the JSON below through stdin with `save`. Saving does not publish.
5. When the seller has requested publication, call `publish` with that ID and the supported destinations. Report each returned status separately. Call `get` or `refresh` after an uncertain response; never generate another ID merely to retry a submission.
6. Only `published` confirms publication. `pending`, `unknown`, `sending`, and `feed_ready` need further action or checking. Okazii's feed requires import setup in the seller's store. Other marketplaces need manual completion from VINDE.

Example save input (replace the sample data and IDs with the seller's actual details):

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "listing": {
    "title": "iPhone 14, 128 GB",
    "description": "Mici zgârieturi pe carcasă. Cutie și cablu incluse.",
    "price": 1500,
    "location": "București",
    "category": "Electronice",
    "condition": "Folosit — stare bună",
    "images": [],
    "contactName": "",
    "phone": "",
    "olx": { "categoryId": 0, "cityId": 0, "advertiserType": "private", "attributes": [] }
  }
}
```

The placeholder contact name and OLX IDs must be completed before OLX submission. Marketplace fees, moderation, and account restrictions can still prevent publication. The CLI does not purchase promotions or packages.
