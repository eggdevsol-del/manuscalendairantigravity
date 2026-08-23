---
name: tattoi-messaging-and-realtime
description: Real-time chat synchronization, staged query invalidation, structured message types, push notifications, and LLM Design Brief enrichment.
---

# Tattoi Messaging & Real-Time Synchronization

## 1. Staged Query Invalidation Rules

When a client or artist takes an action that mutates booking, proposal, or payment state (e.g. accepting a session plan or paying a deposit):

1. **Immediate Invalidation (0ms)**:
   * Instantly invalidate TRPC caches:
     * `utils.messages.list.invalidate({ conversationId })`
     * `utils.sessionPlans.getByConversation.invalidate({ conversationId })`
     * `utils.sessionPlans.getById.invalidate({ sessionPlanId })`
     * `utils.appointments.getByConversation.invalidate(conversationId)`
     * `utils.appointments.getClientBookings.invalidate()`
2. **Staged Consistency Refreshes (600ms & 1500ms)**:
   * Run two staged timeouts at **600ms** and **1500ms** to account for asynchronous Stripe webhooks and background database transactions, ensuring the UI is 100% synchronized before 2 seconds elapse.

---

## 2. Structured Message Types & Visual Payloads

Messages support rich structured payloads via `messageType` and `metadata`:

| `messageType` / Payload Type | Component / Visual Renderer | Purpose |
|---|---|---|
| **`text`** | Standard bubble (`isOwn ? bg-primary : bg-muted`) | Regular conversation chat |
| **`image`** | Clickable thumbnail with full-res modal viewer | Photo sharing |
| **`reference_grid`** | 2-3 column interactive image collage | Group of tattoo reference photos |
| **`placement_grid`** | Body placement photo collage | Placement and sizing references |
| **`session_plan`** | `SessionPlanCard.tsx` | Multi-sitting project proposal with deposit checkout |
| **`session_plan_accepted`** | Green badge pill with confirmation text | System audit trail when deposit is paid |
| **`balance_paid`** | Green receipt pill | Final payment confirmation |
| **`studio_invite`** | Studio invitation action card | Studio roster invite |

---

## 3. Real-Time Push Notifications (OneSignal)

* **Trigger**: Emitted on new chat messages, proposal submissions, and appointment reminders.
* **Payload**:
  * `title`: Sender full name or studio name.
  * `body`: Message preview text.
  * `data.url`: Deep link to target conversation (`/chat/:conversationId`).

---

## 4. LLM Design Brief Generation (`designBrief.ts`)

* **Function**: Evaluates the conversation thread and generates a concise, structured artist design brief synthesizing style, placement, budget, and custom client requests.
* **Refresh**: Auto-refreshes on user toggle or manual refresh icon click with loading spinner state.
