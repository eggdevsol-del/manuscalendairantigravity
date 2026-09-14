/** A person's account role does not determine which side of a booking they are on. */
export function isConversationArtist(
  user: { id: string; role: string } | null | undefined,
  conversation: { artistId: string | null } | null | undefined
) {
  return (
    !!user &&
    (user.role === "artist" || user.role === "admin") &&
    conversation?.artistId === user.id
  );
}

export function isConversationClient(
  user: { id: string } | null | undefined,
  clientId: string | null | undefined
) {
  return !!user && clientId === user.id;
}
