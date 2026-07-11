import { invokeLLM } from "../_core/llm";
import { messageTags, messages } from "../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../drizzle/schema";

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

STRICT RULES:
- NEVER state or imply the artist has completed any work, created designs, drawn sketches, started drawing, or prepared anything
- NEVER make promises about deliverables or timelines the artist hasn't explicitly committed to
- NEVER fabricate details not present in the conversation data
- You may ONLY reference:
  • What the client has communicated (design preferences, questions, decisions)
  • Open questions the client hasn't answered yet
- Tone: warm, professional, concise
- The message should feel like a natural check-in or follow-up, not a delivery notification`;

const CONVERSATION_STATE_SYSTEM_PROMPT = `You summarise the current state of a tattoo artist-client conversation in ONE sentence (max 25 words).
Focus on: what's being discussed and what decision/action is pending.
NEVER imply the artist has done any work or prepared anything.
Only reference what the client has communicated.`;

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
  });

  const briefText = typeof result.choices[0]?.message?.content === "string"
    ? result.choices[0].message.content
    : "Failed to generate brief.";

  return { briefText, messageCount: tags.length };
}

export async function generatePersonalisedMessage(
  database: MySql2Database<typeof schema>,
  conversationId: number,
  artistId: string,
  channel: "sms" | "email",
  clientName: string,
  taskContext?: string
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
    ? "Write a SHORT SMS message (max 160 characters). Casual, friendly tone. No greeting formalities."
    : "Write a brief email (1-2 short paragraphs). Warm but slightly more formal. Include a greeting.";

  const contextParts: string[] = [];
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
  });

  return typeof result.choices[0]?.message?.content === "string"
    ? result.choices[0].message.content
    : `Hey ${clientName}, just checking in — let me know if you have any questions.`;
}

export async function summariseConversationState(
  database: MySql2Database<typeof schema>,
  conversationId: number,
  artistId: string
): Promise<string> {
  // Get brief if exists
  const brief = await database.query.designBriefs.findFirst({
    where: and(
      eq(schema.designBriefs.conversationId, conversationId),
      eq(schema.designBriefs.artistId, artistId)
    ),
  });

  // Get last 3 messages
  const recentMessages = await database.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: [desc(messages.createdAt)],
    limit: 3,
  });

  if (!brief && recentMessages.length === 0) {
    return "No conversation history.";
  }

  const contextParts: string[] = [];
  if (brief?.briefText) contextParts.push(`Brief: ${brief.briefText}`);
  if (recentMessages.length > 0) {
    contextParts.push(`Recent messages:\n${recentMessages.map(m => `- ${m.content}`).join("\n")}`);
  }

  const result = await invokeLLM({
    messages: [
      { role: "system", content: CONVERSATION_STATE_SYSTEM_PROMPT },
      { role: "user", content: contextParts.join("\n\n") },
    ],
    maxTokens: 60,
  });

  return typeof result.choices[0]?.message?.content === "string"
    ? result.choices[0].message.content
    : "Conversation in progress.";
}
