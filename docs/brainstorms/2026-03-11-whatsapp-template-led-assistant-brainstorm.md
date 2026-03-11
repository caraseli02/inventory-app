---
date: 2026-03-11
topic: whatsapp-template-led-assistant
---

# WhatsApp template-led assistant for Q&A and assisted order intake

## What We're Building

Keep the WhatsApp product as `Q&A + assisted order intake`, but narrow the interaction model:

- customer starts with freeform text
- system understands intent and current state
- once the next step is known, move the customer into Twilio Content Template Builder flows with buttons/options
- all order state changes stay deterministic and server-validated

This is not a pure chat agent. It is a guided commerce assistant with freeform entry and constrained transactional steps.

## Why This Approach

The current product direction is right, but the implementation has drifted too far into one large orchestration file. [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) is now the main complexity hotspot. At the same time, external best practice points in the same direction: validate every webhook strictly, prefer structured/constrained actions, and avoid relying on freeform model output for transactional state changes.

Using Twilio templates and buttons more heavily simplifies the happy path:
- clearer user choices
- fewer parsing errors
- lower prompt-injection surface
- easier testing
- better WhatsApp commerce UX

## Approaches Considered

### Approach A: Thin conversational front door, template-led flow, deterministic order backend

LLM handles understanding, Q&A, and clarification. Templates/buttons handle the guided flow after intent is known. Order creation, confirmation, cancellation, and stock effects remain deterministic.

**Pros:**
- Smallest solution that still fits the product goal
- Best balance of UX, safety, and testability
- Aligns with Twilio template capabilities already in use

**Cons:**
- Less flexible than a full chat-first agent
- Requires deliberate state modeling

### Approach B: Full agent loop with freeform transactional output

LLM stays central across most of the order flow and emits order payloads or freeform transaction text.

**Pros:**
- Flexible
- Handles messy language better

**Cons:**
- Pushes complexity into prompt + parsing logic
- Higher reliability and security risk
- Reinforces the current large-file problem

### Approach C: Template/menu-first bot with freeform fallback

The main flow starts with menus/buttons, and freeform text is only fallback.

**Pros:**
- Very reliable
- Very testable

**Cons:**
- More rigid UX
- Weaker match for the desired “WhatsApp assistant” feel

## Recommendation

Choose Approach A.

Product shape:
- freeform first
- templates guide the rest
- deterministic transactional core

This keeps the conversational value of WhatsApp while removing unnecessary freedom from the risky parts of the flow.

## Key Decisions

- Keep the product scope as Q&A plus assisted pickup ordering.
- Default to Twilio Content Template Builder for known next-step interactions.
- Treat confirm/cancel/disambiguation/pickup-time/category-choice as template-driven states.
- Keep final order creation and stock-affecting operations deterministic.
- Do not rely on freeform `ORDER:{...}` style output as the long-term core contract.
- Make shrinking and splitting [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts) the main design priority for the next planning pass.

## Open Questions

- Which order steps should always use templates in v1: only confirm/cancel, or also item disambiguation and pickup-time selection?
- How much off-script Q&A should stay fully freeform before switching to a guided flow?
- Whether Twilio template coverage should become the default for most browse/order states, with plain text only as fallback.

## Next Steps

→ `/workflows:plan` to define the target module split, the WhatsApp state model, and the minimal template set for v1.
