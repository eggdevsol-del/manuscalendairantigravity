import { invokeLLM, type InvokeResult } from "../_core/llm";
import { messageTags, messages, designBriefs } from "../../drizzle/schema";
import { and, eq, desc, asc } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../drizzle/schema";

/**
 * Extract text content from an LLM response.
 * Handles both plain string content and array content
 * (e.g. when thinking mode returns [{type:"thinking",...}, {type:"text", text:"..."}])
 */
function extractTextContent(result: InvokeResult): string | null {
  const content = result.choices[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // Find the first text part (skip thinking parts)
    for (const part of content) {
      if (typeof part === "object" && "text" in part && part.type === "text") {
        return part.text;
      }
    }
  }
  return null;
}

const DESIGN_BRIEF_SYSTEM_PROMPT = `You are a design brief compiler for a tattoo booking app.
Given tagged chat messages between an artist and their client, produce a concise design brief.

STRICT RULES:
- Never state or imply the artist has completed any work, created designs, drawn sketches, or prepared anything
- Never make promises about deliverables
- Only reference what the CLIENT has communicated
- Flag any contradictions between earlier and later messages
- If a category has no tagged messages, omit it entirely
- Be concise — max 200 words total

Output format (only include categories that have relevant data):
🎨 Concept: (what the client wants)
✨ Style: (aesthetic preferences)
📍 Placement: (body location)
📏 Size: (dimensions/coverage)
🎨 Colour: (palette preferences)
💰 Budget: (stated budget or range)
📅 Timeline: (scheduling preferences)
❓ Open Questions: (unresolved decisions)
⚠️ Contradictions: (if any earlier preferences were overridden)`;

const PERSONALISED_MESSAGE_SYSTEM_PROMPT = `You are drafting a message on behalf of a tattoo artist to their client. The artist will review and edit before sending.

STRICT OUTPUT RULES:
- Output ONLY the message body text. Nothing else.
- NEVER include "Subject:" or any subject line.
- NEVER include a sign-off (no "Best regards", "Kind regards", "Cheers", "Thanks", "Sincerely", etc.).
- NEVER include the artist's name, business name, or bracketed placeholders like [Your Name] or [Studio Name].
- The artist already has an email signature — do NOT add one.
- Be extremely concise. Every word must earn its place.

CONTENT RULES:
- NEVER state or imply the artist has completed any work, created designs, drawn sketches, or prepared anything.
- NEVER make promises about deliverables or timelines the artist hasn't explicitly committed to.
- NEVER fabricate details not present in the conversation.
- You may ONLY reference what the client has communicated.
- Tone: professional, direct, warm but not chatty.

TASK-TYPE GUIDANCE — match the message purpose to the task type:
- lead_follow_up / stale_conversation / follow_up_responded: Follow-up message. Check in, reference their project briefly, ask if they'd like to move forward.
- deposit_collection: Deposit reminder. Politely remind them a deposit is needed to secure their booking.
- appointment_confirmation / new_consultation: Confirmation message. Confirm the upcoming appointment, keep it brief and clear.
- post_appointment_thankyou: Thank you. Thank them for coming in, mention aftercare briefly if relevant.
- healed_photo_request: Photo request. Ask if they'd be willing to share healed photos for portfolio.
- birthday_outreach / tattoo_anniversary: Celebratory outreach. Brief warm message marking the occasion.
- new_lead: Welcome message. Acknowledge their enquiry, let them know you'll review it.

If the task type doesn't match any of the above, write a professional check-in relevant to the conversation context.`;

const CONVERSATION_STATE_SYSTEM_PROMPT = `You summarise the current state of a tattoo artist-client conversation in 1-3 sentences (max 60 words).
You are given the FULL conversation with timestamps. Weight recent messages most heavily — they reflect the current state.
Focus on: what the client wants, what's been agreed, current status, and what action is pending.
NEVER imply the artist has done any work, created designs, drawn sketches, or prepared anything unless explicitly stated in the conversation.
If the conversation is just starting, note the client's initial enquiry.
Note any time-sensitive context (e.g. upcoming appointments, deadlines).`;

export async function compileDesignBrief(
  database: MySql2Database<typeof schema>,
  conversationId: number,
  artistId: string
): Promise<{ briefText: string; messageCount: number }> {
  // Fetch all tagged messages for this conversation
  const tags = await database.query.messageTags.findMany({
    where: and(
      eq(messageTags.conversationId, conversationId),
      eq(messageTags.artistId, artistId)
    ),
    with: {
      message: true,
    },
  });

  if (tags.length === 0) {
    return { briefText: "No messages tagged yet. Tap messages in chat to build a design brief.", messageCount: 0 };
  }

  // Group tagged messages by tag category
  const grouped: Record<string, string[]> = {};
  for (const t of tags) {
    if (!grouped[t.tag]) grouped[t.tag] = [];
    const content = (t as any).message?.content;
    if (content) grouped[t.tag].push(content);
  }

  // Build the user prompt
  const taggedContent = Object.entries(grouped)
    .map(([tag, msgs]) => `[${tag.toUpperCase()}]\n${msgs.map((m, i) => `${i + 1}. "${m}"`).join("\n")}`)
    .join("\n\n");

  const userPrompt = `Here are the tagged messages from this client conversation:\n\n${taggedContent}\n\nCompile a design brief from these messages.`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: DESIGN_BRIEF_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 500,
    disableThinking: true,
  });

  const briefText = extractTextContent(result) || "Failed to generate brief.";

  return { briefText, messageCount: tags.length };
}

export async function generatePersonalisedMessage(
  database: MySql2Database<typeof schema>,
  conversationId: number,
  artistId: string,
  channel: "sms" | "email",
  clientName: string,
  taskContext?: string,
  taskType?: string
): Promise<string> {
  // Fetch the cached brief
  const brief = await database.query.designBriefs.findFirst({
    where: and(
      eq(schema.designBriefs.conversationId, conversationId),
      eq(schema.designBriefs.artistId, artistId)
    ),
  });

  // Fetch last 5 messages for recency context
  const recentMessages = await database.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: [desc(messages.createdAt)],
    limit: 5,
  });

  const channelGuidance = channel === "sms"
    ? "Write a SHORT SMS (max 160 characters). Direct and professional. No greeting, no sign-off. Just the message."
    : "Write a brief email body (2-3 sentences max). Professional tone. Start with 'Hi [client name],' then the message. No sign-off, no signature, no subject line.";

  const contextParts: string[] = [];
  if (taskType) contextParts.push(`Task Type: ${taskType}`);
  if (brief?.briefText) contextParts.push(`Design Brief:\n${brief.briefText}`);
  if (taskContext) contextParts.push(`Task Context: ${taskContext}`);
  if (recentMessages.length > 0) {
    contextParts.push(`Recent messages (newest first):\n${recentMessages.map(m => `- ${m.content}`).join("\n")}`);
  }

  const userPrompt = `Client name: ${clientName}\n\n${contextParts.join("\n\n")}\n\n${channelGuidance}`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: PERSONALISED_MESSAGE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: channel === "sms" ? 100 : 300,
    disableThinking: true,
  });

  // Clean up any residual formatting the LLM might add
  let draft = extractTextContent(result)
    || `Hi ${clientName}, just checking in — let me know if you have any questions.`;

  // Strip any "Subject:" line the LLM might include despite instructions
  draft = draft.replace(/^subject:.*\n?/i, "").trim();
  // Strip any trailing sign-offs
  draft = draft.replace(/\n\n?(best regards|kind regards|regards|cheers|thanks|sincerely|warm regards)[,.]?[\s\S]*/i, "").trim();

  return draft;
}

const SUMMARY_TTL_MS = 30 * 60 * 1000; // 30 minutes (fallback)

export async function summariseConversationState(
  database: MySql2Database<typeof schema>,
  conversationId: number,
  artistId: string
): Promise<string> {
  // Get conversation to check lastMessageAt for cache invalidation
  const conversation = await database.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });

  // Check for cached summary in designBriefs table
  const cached = await database.query.designBriefs.findFirst({
    where: and(
      eq(schema.designBriefs.conversationId, conversationId),
      eq(schema.designBriefs.artistId, artistId)
    ),
  });

  // Cache is valid if: exists, within TTL, AND no new messages since generation
  if (
    cached?.conversationSummary &&
    cached.summaryGeneratedAt
  ) {
    const summaryAge = Date.now() - new Date(cached.summaryGeneratedAt).getTime();
    const lastMsg = conversation?.lastMessageAt
      ? new Date(conversation.lastMessageAt).getTime()
      : 0;
    const summaryTime = new Date(cached.summaryGeneratedAt).getTime();

    // Return cached if within TTL AND no new messages since summary was generated
    if (summaryAge < SUMMARY_TTL_MS && lastMsg <= summaryTime) {
      return cached.conversationSummary;
    }
  }

  // Fetch the entire conversation (up to 100 messages) in chronological order
  const allMessages = await database.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: [asc(messages.createdAt)],
    limit: 100,
  });

  if (allMessages.length === 0) {
    return "No conversation history.";
  }

  // Format all messages with timestamps for the LLM
  const formattedMessages = allMessages.map((m) => {
    const role = m.senderId === artistId ? "Artist" : "Client";
    const timestamp = m.createdAt
      ? new Date(m.createdAt).toLocaleString("en-NZ", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "unknown time";
    return `[${timestamp}] ${role}: ${m.content}`;
  }).join("\n");

  // Build context
  const contextParts: string[] = [
    `Full conversation (${allMessages.length} messages):\n${formattedMessages}`,
  ];

  const result = await invokeLLM({
    messages: [
      { role: "system", content: CONVERSATION_STATE_SYSTEM_PROMPT },
      { role: "user", content: contextParts.join("\n\n") },
    ],
    maxTokens: 120,
    disableThinking: true,
  });

  const summary = extractTextContent(result) || "Conversation in progress.";

  // Cache the summary via upsert into designBriefs
  try {
    if (cached) {
      await database
        .update(designBriefs)
        .set({
          conversationSummary: summary,
          summaryGeneratedAt: new Date().toISOString(),
        })
        .where(eq(designBriefs.id, cached.id));
    } else {
      // Create a minimal designBriefs row just for the summary cache
      await database.insert(designBriefs).values({
        conversationId,
        artistId,
        briefText: "",
        messageCount: 0,
        conversationSummary: summary,
        summaryGeneratedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    // Non-critical — caching failure shouldn't break the response
    console.error("Failed to cache conversation summary:", e);
  }

  return summary;
}
