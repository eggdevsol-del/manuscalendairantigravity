# Revenue Protection Algorithm v2.0
## Business Dashboard Priority System for Tattoo Artists

---

## Executive Summary

The Business sheet on the Dashboard is a **Revenue Protection System**. Every task surfaced represents money at risk: a consultation that could ghost, a deposit that hasn't been collected, an appointment that might no-show, or a relationship that's going cold.

The algorithm's job is to **surface the highest-risk revenue items first**, ensuring the artist takes action before money walks out the door.

### Why This Matters

| Statistic | Source |
|-----------|--------|
| 5% retention increase = 25-95% profit increase | Bain & Company / Harvard Business Review |
| 65% of revenue comes from repeat customers | BIA Advisory Services |
| Repeat customers spend 67% more than new customers | Business.com |
| Acquiring new customers costs 5-25x more than retaining | Bain & Company |
| First responders win 35-78% of sales | Vendasta, Ricochet360 |

---

## The Client Journey (Tattoo-Specific)

Based on your workflow, the complete client journey is:

```
1. CONSULT REQUEST        → New lead arrives
2. DISCUSSION             → Ideas, placement, references
3. PROTOCOL               → Project structure (sessions, timing)
4. PROPOSAL               → Dates + pricing sent
5. ACCEPTANCE + DEPOSIT   → Client confirms, pays deposit
6. REMINDERS              → 2 weeks → 1 week → 3 days prior
7. APPOINTMENT            → Tattoo session
8. POST-SESSION           → Thank you + review request
9. AFTERCARE              → Daily SMS for 2 weeks (manual, personal)
10. HEALED PHOTO          → 1 month follow-up (7-14 day healing window)
11. PROJECT COMPLETE      → 3 month follow-up
12. BIRTHDAY              → Annual wishes + gift opportunity
13. TATTOO ANNIVERSARY    → Annual milestone (highest transaction rate)
14. ONGOING               → Follow-ups every 2 months
```

Each stage has potential revenue leakage. The algorithm monitors all stages.

---

## Task Tiers: Revenue Protection Hierarchy

### TIER 1: MONEY ON THE TABLE (Immediate Revenue at Risk)
Tasks that represent **direct, immediate revenue loss** if not addressed.

### TIER 2: PIPELINE PROTECTION (Future Revenue at Risk)
Tasks that represent **leads going cold** or **deals stalling**.

### TIER 3: RELATIONSHIP MAINTENANCE (Lifetime Value)
Tasks that **strengthen client relationships** and drive **repeat business**.

### TIER 4: OPERATIONAL HYGIENE (Efficiency & Social Proof)
Tasks that **support the business** but aren't directly revenue-critical.

---

## TIER 1: MONEY ON THE TABLE

### 1.1 New Consultation Request (Unconverted Lead)

**Trigger:** `consultation.status = 'pending' AND consultation.viewed = 0`

| Age of Consultation | Priority | Score | Rationale |
|---------------------|----------|-------|-----------|
| < 1 hour | 🔴 CRITICAL | 950 | First responders win 35-78% of sales |
| 1-4 hours | 🔴 HIGH | 850 | Still warm, high conversion potential |
| 4-24 hours | 🟠 MEDIUM | 650 | Cooling but recoverable |
| 24-48 hours | 🟡 LOW | 450 | Getting cold |
| > 48 hours | 🟡 DECAYING | 300 - (hours × 2) min 100 | Decay formula |

**Task Title:** "New consultation request"
**Context:** "{clientName}: {subject}"
**Action:** Open consultation → Begin discussion

**Revenue Logic:** If communication is efficient, lead time from consult to appointment can be under 1 hour. Every hour of delay reduces conversion probability. Fresh leads convert 3-5x better than stale ones.

---

### 1.2 Consultation Viewed But Not Responded

**Trigger:** `consultation.status = 'pending' AND consultation.viewed = 1 AND hoursSinceViewed > 2`

| Hours Since Viewed | Priority | Score |
|--------------------|----------|-------|
| 2-6 hours | 🟠 MEDIUM | 700 |
| 6-12 hours | 🟠 MEDIUM | 600 |
| 12-24 hours | 🟡 LOW | 500 |
| > 24 hours | 🟡 LOW | 400 |

**Task Title:** "Respond to {clientName}"
**Context:** "Viewed {X} hours ago - awaiting your response"
**Action:** Open conversation

---

### 1.3 Deposit Not Collected (Confirmed Appointment)

**Trigger:** `appointment.status = 'confirmed' AND appointment.depositPaid = 0 AND appointment.depositAmount > 0`

| Time Until Appointment | Priority | Score | Rationale |
|------------------------|----------|-------|-----------|
| < 24 hours | 🔴 CRITICAL | 1000 | No-show risk is highest |
| 24-48 hours | 🔴 HIGH | 900 | Inside cancellation policy window |
| 48-72 hours | 🟠 MEDIUM | 750 | At cancellation policy boundary |
| 72 hours - 1 week | 🟡 LOW | 550 | Outside policy, still needs collection |
| > 1 week | 🟡 LOW | 400 | Time to collect |

**Task Title:** "Collect ${depositAmount} deposit"
**Context:** "{clientName} - {appointmentTitle} on {date}"
**Action:** Open conversation → Deposit info auto-sent on proposal acceptance

**Revenue Logic:** Deposit = commitment. No deposit = higher no-show risk. 100% deposit loss policy means deposit IS the revenue protection.

**Note:** For multi-session projects, deposit is per sitting (6 sittings = 6× deposit). Algorithm should track per-appointment.

---

### 1.4 Appointment Needs Confirmation (Within 48 Hours)

**Trigger:** `appointment.status = 'confirmed' AND appointment.confirmationSent = 0 AND hoursUntilAppointment < 48`

| Time Until Appointment | Priority | Score | Rationale |
|------------------------|----------|-------|-----------|
| < 12 hours | 🔴 CRITICAL | 980 | Last chance to confirm |
| 12-24 hours | 🔴 HIGH | 880 | Day-before confirmation |
| 24-48 hours | 🟠 MEDIUM | 680 | Standard confirmation window |

**Task Title:** "Confirm tomorrow's appointment"
**Context:** "{clientName} - {time}"
**Action:** Send confirmation (SMS + in-app)

**Revenue Logic:** Unconfirmed appointments have 20-40% higher no-show rates. Confirmation is free insurance.

---

### 1.5 Pending Appointment (Client Hasn't Confirmed)

**Trigger:** `appointment.status = 'pending' AND hoursUntilAppointment < 72`

| Time Until Appointment | Priority | Score |
|------------------------|----------|-------|
| < 24 hours | 🔴 CRITICAL | 920 |
| 24-48 hours | 🟠 MEDIUM | 720 |
| 48-72 hours | 🟡 LOW | 520 |

**Task Title:** "Awaiting client confirmation"
**Context:** "{clientName} - {date} appointment pending"
**Action:** Send reminder / follow up

---

## TIER 2: PIPELINE PROTECTION

### 2.1 Consultation Responded But Not Scheduled

**Trigger:** `consultation.status = 'responded' AND daysSinceUpdate > 1`

| Days Since Response | Priority | Score | Rationale |
|---------------------|----------|-------|-----------|
| 1-2 days | 🟠 MEDIUM | 650 | Daily follow-up cadence |
| 2-3 days | 🟠 MEDIUM | 550 | Still warm |
| 3-5 days | 🟡 LOW | 450 | Cooling |
| 5-7 days | 🟡 LOW | 350 | Cold but recoverable |
| > 7 days | ⚪ VERY LOW | 250 | Likely window shopper |

**Task Title:** "Follow up: {clientName}"
**Context:** "Responded {X} days ago - not yet scheduled"
**Action:** Open conversation → Propose dates

**Revenue Logic:** Daily follow-up cadence. Client is keen so lock in time. Within a few days it's clear if they're serious or window shopping.

---

### 2.2 Stale Conversation (Artist Sent Last Message)

**Trigger:** `lastMessage.senderId = artistId AND daysSinceLastMessage >= 2`

| Days Since Artist's Last Message | Priority | Score |
|----------------------------------|----------|-------|
| 2 days | 🟠 MEDIUM | 600 |
| 3 days | 🟠 MEDIUM | 500 |
| 4-5 days | 🟡 LOW | 400 |
| 6-7 days | 🟡 LOW | 300 |
| > 7 days | ⚪ ARCHIVE | 200 (or remove) |

**Task Title:** "Follow up with {clientName}"
**Context:** "No response in {X} days"
**Action:** Open conversation → Gentle follow-up

**Revenue Logic:** If artist sent last message and client hasn't responded, deal is cooling. A gentle follow-up can recover 15-25% of these.

---

### 2.3 Cold Lead - Last Chance

**Trigger:** `consultation.status IN ('pending', 'responded') AND daysSinceCreated BETWEEN 45 AND 60`

| Days Since Created | Priority | Score |
|--------------------|----------|-------|
| 45-50 days | 🟡 LOW | 280 |
| 50-60 days | ⚪ VERY LOW | 200 |

**Task Title:** "Last chance: {clientName}"
**Context:** "Lead from {X} days ago - offer discount?"
**Action:** Open conversation → Discount opportunity

**Revenue Logic:** At 2 months there's almost no chance of converting a cold lead. This is the last chance - reframe as discount opportunity. Only show if artist is up to date on priority tasks.

**After 60 days:** Archive the lead. No task shown.

---

## TIER 3: RELATIONSHIP MAINTENANCE

### 3.1 Post-Appointment Follow-up (Same Day)

**Trigger:** `appointment.status = 'completed' AND daysSinceAppointment = 0`

| Priority | Score |
|----------|-------|
| 🟡 LOW | 400 |

**Task Title:** "Thank {clientName}"
**Context:** "Session completed today - send thank you"
**Action:** Send thank you message + review request

---

### 3.2 Aftercare Reminder

**Trigger:** `appointment.status = 'completed' AND daysSinceAppointment BETWEEN 1 AND 14 AND dailyAftercareSent = false`

| Day | Priority | Score |
|-----|----------|-------|
| Days 1-7 | 🟡 LOW | 380 |
| Days 8-14 | ⚪ VERY LOW | 300 |

**Task Title:** "Aftercare: {clientName}"
**Context:** "Day {X} - send daily check-in"
**Action:** Send personal SMS (not automated)

**Revenue Logic:** Manual aftercare via SMS is ideal. Personalization creates connection and return business. "It's a personal message, not AI sending automated reminders."

---

### 3.3 Healed Photo Request

**Trigger:** `appointment.status = 'completed' AND daysSinceAppointment BETWEEN 14 AND 30`

**Healing Timeline:** Peeling at 3-4 days, settles around 7 days, fully healed within 7-14 day range. Request at 14 days from last appointment for that project.

| Days Since Appointment | Priority | Score |
|------------------------|----------|-------|
| 14-18 days | 🟡 LOW | 350 |
| 18-25 days | 🟡 LOW | 300 |
| 25-30 days | ⚪ VERY LOW | 250 |

**Task Title:** "Request healed photo"
**Context:** "{clientName}'s {tattooDescription} should be healed"
**Action:** Send healed photo request

**Revenue Logic:** Healed photos = portfolio content = social proof = more clients. Not priority 1 but good for records and showing other clients results.

---

### 3.4 Multi-Session Project Check-in

**Trigger:** `hasMultipleSessions = true AND daysSinceLastSession >= 30 AND projectStatus = 'in_progress'`

| Days Since Last Session | Priority | Score |
|-------------------------|----------|-------|
| 30-45 days | 🟡 LOW | 380 |
| 45-60 days | 🟡 LOW | 320 |
| > 60 days | ⚪ VERY LOW | 260 |

**Task Title:** "Check in: {clientName}'s project"
**Context:** "{projectName} - {X} days since last session"
**Action:** Open conversation → Schedule next session

**Revenue Logic:** On-going projects should receive follow-ups between sittings if spaced a month or more apart.

---

### 3.5 Birthday Outreach

**Trigger:** `user.birthday IS NOT NULL AND daysUntilBirthday BETWEEN 0 AND 7`

| Days Until Birthday | Priority | Score |
|---------------------|----------|-------|
| 0 (Today) | 🟡 LOW | 400 |
| 1-3 days | 🟡 LOW | 350 |
| 4-7 days | ⚪ VERY LOW | 280 |

**Task Title:** "Birthday: {clientName}"
**Context:** "{date} - Send wishes or voucher?"
**Action:** Send birthday message / issue voucher

**Research Support:**
- Birthday emails have 3x higher open rates than mass promotions (Experian)
- 481% higher order rate for birthday promotions (PostcardMania)
- 77% of consumers say personalized birthday content impacts brand loyalty (Experian)
- 88% increase in brand loyalty from birthday outreach (Adweek)

**Revenue Logic:** Tattooing is intimate. Artists become friends with clients. Birthday outreach strengthens that bond and creates rebooking opportunities.

---

### 3.6 Tattoo Anniversary (HIGHEST TRANSACTION RATE)

**Trigger:** `appointment.status = 'completed' AND isAnniversaryOfAppointment = true`

| Anniversary Type | Priority | Score |
|------------------|----------|-------|
| 1 year anniversary | 🟡 LOW | 420 |
| 2+ year anniversary | ⚪ VERY LOW | 320 |

**Task Title:** "Tattoo anniversary: {clientName}"
**Context:** "{X} year(s) since {tattooDescription}"
**Action:** Send anniversary message / offer voucher

**Research Support:**
- Anniversary mailings have **0.63% transaction rate** - HIGHEST of all personalized outreach (CheetahMail)
- Birthday mailings: 0.49% transaction rate
- Anniversary outreach outperforms birthday outreach by 28%

**Revenue Logic:** This is statistically the most effective type of personalized outreach. The emotional trigger ("One year ago today, you got your memorial piece for your grandmother") is powerful. Opportunity to:
- Strengthen rapport
- Offer vouchers/discounts
- Trigger rebooking
- Generate referrals

---

### 3.7 Rebooking Opportunity (Dormant Client)

**Trigger:** `daysSinceLastAppointment >= 90 AND totalAppointments >= 1`

| Days Since Last Appointment | Priority | Score |
|-----------------------------|----------|-------|
| 90-120 days | ⚪ VERY LOW | 280 |
| 120-180 days | ⚪ VERY LOW | 240 |
| > 180 days | ⚪ VERY LOW | 200 |

**Task Title:** "Rebook {clientName}?"
**Context:** "Last visit: {X} months ago"
**Action:** Open conversation → Check in / offer rebooking

---

## TIER 4: OPERATIONAL HYGIENE

### 4.1 Review Request

**Trigger:** `appointment.status = 'completed' AND daysSinceAppointment BETWEEN 21 AND 30 AND reviewNotRequested`

| Priority | Score |
|----------|-------|
| ⚪ VERY LOW | 250 |

**Task Title:** "Ask {clientName} for review"
**Context:** "Tattoo healed - good time for review"
**Action:** Send review request with Google/Facebook links

---

## Scoring Formula

```typescript
FINAL_SCORE = BASE_SCORE × TIME_MULTIPLIER × VALUE_MULTIPLIER × RELATIONSHIP_MULTIPLIER

Where:
- BASE_SCORE = Score from tables above
- TIME_MULTIPLIER = Urgency escalation (0.5 to 2.0)
- VALUE_MULTIPLIER = appointmentPrice / avgPrice (0.5 to 2.0)
- RELATIONSHIP_MULTIPLIER = 1.0 + (clientSignals × 0.05) capped at 1.3
```

### Time Multiplier

```typescript
function getTimeMultiplier(hoursUntilDeadline: number): number {
  if (hoursUntilDeadline < 0) return 0.5;      // Overdue (damage done)
  if (hoursUntilDeadline < 6) return 2.0;      // Critical window
  if (hoursUntilDeadline < 24) return 1.5;     // Same day
  if (hoursUntilDeadline < 48) return 1.2;     // Tomorrow
  if (hoursUntilDeadline < 72) return 1.0;     // Within 3 days
  return 0.8;                                   // Future
}
```

### Value Multiplier

```typescript
function getValueMultiplier(appointmentPrice: number, avgPrice: number): number {
  if (!appointmentPrice || !avgPrice) return 1.0;
  const ratio = appointmentPrice / avgPrice;
  return Math.max(0.5, Math.min(2.0, ratio));
}
```

**Example:** A $2000 back piece gets 2x priority over a $200 flash piece.

### Relationship Multiplier (Client Value Signals)

Client value signals (each adds 0.05 to multiplier, capped at 1.3):
- Quick message responses
- Repeat bookings (count)
- Referrals made
- Reviews left
- Deposits paid quickly
- Always shows up (no cancellations)

```typescript
function getRelationshipMultiplier(client: Client): number {
  let signals = 0;
  if (client.avgResponseTimeHours < 24) signals++;
  if (client.totalAppointments >= 2) signals += client.totalAppointments - 1;
  if (client.referralCount > 0) signals += client.referralCount;
  if (client.hasLeftReview) signals++;
  if (client.avgDepositPaymentDays < 3) signals++;
  if (client.cancellationRate === 0) signals++;
  
  return Math.min(1.3, 1.0 + (signals * 0.05));
}
```

**Note:** High-value clients get slight priority boost, but new clients become high-value clients. Don't deprioritize new clients—offer high-value clients more value (perks, not just priority).

---

## Display Rules

### Maximum Visible Tasks

| Setting | Default | Notes |
|---------|---------|-------|
| Default task limit | 10 items | User requested increase from 6 |
| Minimum | 4 items | For overwhelmed artists |
| Maximum | 15 items | For high-volume artists |

**Capacity Scaling:** Include a button under the last task to "Set daily tasks amount" so artist can adjust.

### Sorting

1. Sort by FINAL_SCORE descending
2. Within same score (±50), sort by TIME_MULTIPLIER descending (most urgent first)
3. Tier 1 tasks always appear before Tier 2-4 when scores are close

### Priority Color Mapping

| Score Range | Priority | Color | Left Edge |
|-------------|----------|-------|-----------|
| ≥ 800 | 🔴 CRITICAL | Red | 3px red line + 20% red gradient |
| 500-799 | 🟠 HIGH | Orange | 3px orange line + 20% orange gradient |
| 300-499 | 🟡 MEDIUM | Amber | 3px amber line + 20% amber gradient |
| < 300 | 🟢 LOW | Green | 3px green line + 20% green gradient |

### Cold Lead Visibility

Cold lead tasks (> 45 days) should only appear if:
- Artist has no Tier 1 tasks
- Artist has < 3 Tier 2 tasks
- Artist is "up to date" on priority tasks

---

## Seasonal Adjustments

### January (Post-Christmas)

**Trigger:** `currentMonth = 1`

**Adjustment:** Increase no-show risk scores by 20% for appointments without deposits.

**Rationale:** People have no money after Christmas. Higher no-show/cancel risk.

---

## Artist Settings Integration

### Goal Advanced Bookings

Allow artist to set their booking goal (e.g., "I want to be booked 3-6 months in advance").

The algorithm can then:
- Increase urgency on lead conversion when booking window is short
- Decrease urgency when fully booked
- Surface "you're under-booked" warnings

**Implementation:** Add to onboarding or settings:
```
How far in advance do you want to be booked?
[ ] 1-2 months
[ ] 2-4 months  
[ ] 3-6 months (recommended)
[ ] 6-12 months
```

### Cancellation Policy

Default: 72 hours notice to reschedule/cancel, deposit non-refundable.

Algorithm should factor in this policy deadline for confirmation task urgency.

---

## Data Sources (Schema Mapping)

| Task Type | Primary Table | Key Fields |
|-----------|---------------|------------|
| New Consultation | `consultations` | status, viewed, createdAt |
| Deposit Collection | `appointments` | depositPaid, depositAmount, startTime |
| Appointment Confirmation | `appointments` | confirmationSent, startTime |
| Stale Conversation | `conversations`, `messages` | lastMessageAt, senderId |
| Aftercare | `appointments` | status, startTime, followUpSent |
| Birthday | `users` | birthday |
| Tattoo Anniversary | `appointments` | status, startTime (completed) |
| Rebooking | `appointments` | MAX(endTime) per client |

---

## Implementation Architecture

### Server-Side Task Generation

```typescript
// server/services/businessTaskGenerator.ts

export async function generateBusinessTasks(artistId: string): Promise<BusinessTask[]> {
  const [
    pendingConsultations,
    upcomingAppointments,
    staleConversations,
    completedAppointments,
    clientBirthdays,
    tattooAnniversaries,
  ] = await Promise.all([
    getPendingConsultations(artistId),
    getUpcomingAppointments(artistId, 14), // Next 14 days
    getStaleConversations(artistId, 2),    // No response in 2+ days
    getCompletedAppointments(artistId, 30), // Last 30 days
    getUpcomingBirthdays(artistId, 7),
    getTattooAnniversaries(artistId, 7),
  ]);
  
  const tasks: BusinessTask[] = [
    ...generateConsultationTasks(pendingConsultations),
    ...generateDepositTasks(upcomingAppointments),
    ...generateConfirmationTasks(upcomingAppointments),
    ...generateFollowUpTasks(staleConversations),
    ...generateAftercareTasks(completedAppointments),
    ...generateHealedPhotoTasks(completedAppointments),
    ...generateBirthdayTasks(clientBirthdays),
    ...generateAnniversaryTasks(tattooAnniversaries),
  ];
  
  return tasks
    .map(task => ({ ...task, score: calculateFinalScore(task) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, artistSettings.maxVisibleTasks || 10);
}
```

### Event-Driven Updates

Tasks regenerate when these mutations occur:

| Event | Trigger |
|-------|---------|
| New consultation | `consultations.create` |
| Consultation status change | `consultations.update` |
| Message sent/received | `messages.create` |
| Appointment created/updated | `appointments.create/update` |
| Deposit marked paid | `appointments.update` |
| Appointment completed | `appointments.update` |

### Cache Invalidation

```typescript
// After any relevant mutation
await queryClient.invalidateQueries(['dashboard', 'businessTasks']);
```

---

## Summary: What This Algorithm Does

1. **Protects Immediate Revenue** - Surfaces unpaid deposits and unconfirmed appointments before it's too late
2. **Converts Leads Faster** - Prioritizes fresh consultations when conversion probability is highest (first responders win 35-78% of sales)
3. **Prevents Ghosting** - Catches stale conversations with daily follow-up cadence
4. **Enforces Cancellation Policy** - Escalates tasks around the 72-hour policy boundary
5. **Maintains Relationships** - Reminds about birthdays and tattoo anniversaries (highest transaction rate)
6. **Builds Social Proof** - Prompts for healed photos and reviews at optimal times
7. **Adapts to Value** - Higher-value appointments get higher priority
8. **Rewards Loyal Clients** - Repeat clients with good signals get slightly elevated priority
9. **Respects Artist Capacity** - Configurable task limits with scaling

The artist doesn't need to think about what to do next. The algorithm tells them: **"This is the most important thing for your revenue right now."**

---

## Research Citations

1. Bain & Company / Frederick Reichheld - "5% retention increase = 25-95% profit increase" (Harvard Business Review, 2014)
2. Experian - Birthday email statistics (3x open rates, 77% brand loyalty impact)
3. CheetahMail 2010 - Anniversary mailings have 0.63% transaction rate (highest)
4. PostcardMania - 481% higher order rate for birthday promotions
5. Vendasta / Ricochet360 - First responders win 35-78% of sales
6. BIA Advisory Services - 65% of revenue from repeat customers
7. Business.com - Repeat customers spend 67% more
