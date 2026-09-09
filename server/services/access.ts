import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { conversations } from "../../drizzle/schema";

export const publicUserColumns = {
  id: true,
  name: true,
  avatar: true,
  city: true,
  bio: true,
  role: true,
} as const;

export async function requireConversationAccess(
  database: any,
  conversationId: number,
  userId: string,
  artistOnly = false
) {
  const conversation = await database.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (
    !conversation ||
    (conversation.artistId !== userId &&
      (artistOnly || conversation.clientId !== userId))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this conversation.",
    });
  }
  return conversation;
}

export function requireArtist(user: { role: string }) {
  if (user.role !== "artist" && user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Artist access required.",
    });
  }
}
