# Premium deal agent: seller contact through completed transaction

Updated: 2026-09-28 (local pilot implementation)

## Product goal

For a buyer-selected listing, LiberGent should find a supported way to reach the seller, conduct the conversation on the buyer's behalf within the buyer's instructions, negotiate useful terms, arrange the next step, and help the buyer complete the transaction. The buyer should be able to see and stop the agent's work at any time. Success is a buyer-confirmed completed purchase, with intermediate outcomes recorded separately: seller reached, replied, offer made, terms agreed, meeting or delivery arranged, and deal lost.

This is a **Premium buyer agent** goal. Search coverage and an inbox are supporting capabilities, not the outcome. An agent cannot claim a purchase is complete from a seller's message alone.

## Current repository inventory

| Capability | Current state | Evidence |
| --- | --- | --- |
| Initial message | Search cards generate a fixed Romanian message; the signed-in buyer confirms before `/api/whatsapp/send` calls the OpenClaw bridge. A listing link remains available. | `ui/src/app/search/page.tsx`, `src/worker.js`, `scripts/openclaw-bridge.js` |
| Access and disclosure | Existing one-off messaging requires login. New deal records and deal-linked replies require Premium. Both general-product and vehicle opening messages now identify the AI assistant. | `src/worker.js`, `ui/src/app/search/page.tsx` |
| Contact discovery | `/api/marketplace/contact` attempts supported listing phone extraction; the UI falls back to a listing phone or a buyer-entered number. | `src/worker.js`, `ui/src/app/search/page.tsx` |
| Private history | Authenticated `/api/conversations` reads account-filtered WhatsApp rows, now fetching the newest 1000. UI groups messages by listing and seller and has a buyer-confirmed reply composer. Direct client table access is disabled. | `src/conversations.js`, `src/supabase.js`, `supabase/whatsapp_messages.sql`, `ui/src/app/search/page.tsx` |
| Inbound replies | Token-protected `/api/openclaw/inbound` stores forwarded replies. A session-file polling forwarder exists, but its live deployment and provider receipt behavior are unverified. Ambiguous phone ownership is left unassigned. | `src/worker.js`, `scripts/openclaw-inbound-forwarder.js`, `docs/p0-progress-2026-09-15.md` |
| Delivery state | Bridge responses are normalized. Deal-linked replies now reserve a durable send attempt and reuse a stable idempotency key; older one-off sends still lack that protection. Real provider receipt callbacks are not implemented. | `src/worker.js`, `src/supabase.js`, `supabase/deals.sql` |
| Deal workflow | `/deals` and `/api/deals` provide a Premium buyer brief, price ceiling, opening and reply drafts, pause/resume, explicit seller terms, buyer acceptance, and buyer-confirmed completion. An optional OpenAI-backed proposal is available when credentials and model are configured; proposals still require buyer approval. There is no autonomous negotiation or follow-up scheduler. | `src/deals.js`, `src/deal-ai.js`, `src/worker.js`, `ui/src/app/deals/page.tsx`, `supabase/deals.sql` |

## Intended buyer journey

1. **Select a listing.** Show current price, source, seller contact options, and the age of listing data. The buyer asks LiberGent to pursue this specific item.
2. **Set a deal brief.** Capture maximum total price, opening offer, must-ask questions, preferred delivery or pickup, location and timing, and deal breakers. Show the channel and agent identity before the buyer authorizes outreach.
3. **Choose a supported channel.** Resolve the source's contact options and use only a verified permitted route. Where direct messaging is unavailable, prepare a marketplace message for the buyer to send and track the handoff. Do not treat a discovered phone number as blanket permission for automated WhatsApp outreach.
4. **Contact and negotiate.** The agent discloses that it acts for a buyer, asks about availability and condition, handles replies, makes offers within the brief, and follows up within frequency and time limits. It must pause for buyer input when a reply is ambiguous or a proposed term exceeds the brief.
5. **Agree and hand off.** Capture the seller's actual offer, the buyer's acceptance, exact item, total price, payment and delivery or meeting terms. Ask the buyer to approve any binding commitment, payment, deposit, or sharing of sensitive personal details. Never infer acceptance from keyword matching.
6. **Confirm outcome.** Ask the buyer whether the item was received and the transaction completed. Record completed, cancelled, unavailable, no response, or other failure reasons. Use those outcomes to improve channel choice and agent behavior.

## Required implementation work

### Implemented locally in this pass

- Premium-only deal records and account-scoped API, with a dedicated SQL migration and local Node API parity.
- Brief validation, offer ceiling, separate stage transitions, pause/stop, and buyer-confirmed purchase state.
- Transactional database stage-event logging and a buyer-visible deal timeline.
- An opening-message draft and conservative reply proposal tied to the seller conversation, with buyer review before sending.
- An optional server-side structured model proposal using only the brief and recent message text; it does not include the seller phone, uses `store: false`, and validates the proposed price before returning it for buyer review.
- Editable, buyer-confirmed replies in the existing conversation panel; deal-linked replies use a durable send attempt and a stable idempotency key.
- Fail-closed inbound attribution when one seller number spans multiple buyers or listings; the inbound forwarder retries application-level failures.
- Unit and Worker tests for Premium access, deal transitions, ownership, price ceilings, reply behavior, and duplicate-send prevention; UI lint and build pass.

### 1. Prove the existing channel works

- Run a controlled production test of contact lookup, user confirmation, send, provider receipt, inbound reply, account isolation, history persistence, and failure recovery.
- Replace the session-file inbound poller with a supported event or webhook integration where available. The current forwarder rejects `ok: false` responses so failed persistence can be retried.
- Extend durable send attempts to older one-off messages. Add a review/reconciliation path for `unknown` attempts before any explicit new send.
- Record real provider receipt transitions; keep `queued`, `sent`, and `delivered` distinct.
- Verify allowed contact methods by marketplace and channel before enabling automated outreach. Keep link-out for unsupported sources.
- Keep the agent's identity clear in every message template. New deal actions check Premium entitlement; the older one-off send route remains a logged-in feature.

### 2. Model a deal, not just messages

- Extend the account-owned deal record with verified channel capability, seller identity, and agent authorization. The current record has listing, brief, stage, terms, pause, and outcome.
- Use durable message and event records with provider IDs, timestamps, delivery state, actor, and listing association. Give inbound messages an explicit thread identity; a phone number alone can represent several listings or buyers.
- Add explicit, reviewable agreement and completion state transitions. Seller wording alone no longer sets `deal_agreed`; keep model interpretation as a suggestion with evidence from messages.
- Define retention, deletion, access controls, and limits for seller contact data and transcripts.

### 3. Build the buyer-facing controls

- Add a deal brief and clear “Ask LiberGent to contact this seller” action for eligible listings; show unsupported channels honestly.
- Add provider-send and appointment events to the current stage timeline, plus stronger buyer handoff controls. The current UI has reply editing/confirmation, terms, pause/stop, and listing link-out.
- Notify the buyer when the seller replies, the agent needs a decision, a deal is agreed, or contact fails. Show the difference between seller acceptance and buyer-confirmed completion.

### 4. Build the agent loop

- On each seller event, load the correct deal brief and thread, classify the reply, update a proposed next action, and check every action against authorization and channel rules before sending.
- Start with buyer-approved replies. Then allow bounded autonomous replies and offers only within explicit price, content, time, and frequency limits. Escalate uncertainty, changed terms, payment requests, personal-data requests, and final acceptance to the buyer.
- Add scheduled follow-ups with caps and stop conditions; stop immediately on seller refusal, opt-out, unavailable listing, buyer pause, or completed deal.
- Make agent decisions and sent messages auditable. Keep a human-review path for failures and disputes.

### 5. Measure the outcome

- Track eligible listings, outreach authorized, send accepted by provider, delivered, seller replied, offer made, terms agreed, buyer accepted, and purchase confirmed. Record loss reasons and channel.
- Review conversion by marketplace, channel, listing category, and agent version alongside cost per contact and completed deal. Do not present “message sent” or inferred “deal agreed” as a completed transaction.

## First releasable slice

The local pilot UI, API, and schema are implemented, but the SQL in `supabase/deals.sql` has not been applied to a target Supabase project and the flow has not passed a controlled production test. The first message remains a draft for a supported marketplace contact route; replies can be sent through an existing WhatsApp conversation after buyer confirmation. Channel permissions, real delivery receipts, and correct reply attribution must be verified before advertising agent-run outreach. Bounded autonomous negotiation follows only after that pilot provides reliable delivery, reply attribution, and measured safety and conversion results.

## Acceptance criteria for the full goal

- A Premium buyer can give the agent a bounded brief for a supported listing and see every seller contact and current deal state.
- The agent chooses a permitted channel, reaches the seller, handles replies and follow-ups within the brief, and asks the buyer before exceeding authority or accepting final terms.
- Every outbound attempt is idempotent, has a durable record, and uses provider evidence for delivery status. Inbound replies attach to the correct buyer and listing or remain unassigned for review.
- A seller agreement, buyer acceptance, and completed purchase are separate explicit events. The buyer can pause or stop the agent at any point.
- The team can measure confirmed completed purchases and failure reasons, not only message volume.
