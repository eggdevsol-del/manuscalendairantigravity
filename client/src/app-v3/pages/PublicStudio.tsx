import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ActionLink,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
} from "../design/primitives";

export default function PublicStudio() {
  const [, params] = useRoute("/studio/:slug");
  const profile = trpc.studios.getStudioProfile.useQuery(
    { slug: params?.slug || "" },
    { enabled: !!params?.slug, retry: false }
  );
  const data = profile.data;
  return (
    <Screen
      publicView
      title={data?.studio.name || "Your studio"}
      subtitle="Find your artist. Start your next tattoo."
      action={
        <ActionLink href="/login" tone="quiet">
          Sign in
        </ActionLink>
      }
    >
      <Feedback
        loading={profile.isLoading}
        error={profile.error}
        onRetry={() => profile.refetch()}
      />
      {data && (
        <>
          <Panel>
            <Row
              title={data.studio.name}
              icon={
                <Avatar name={data.studio.name} src={data.studio.logoUrl} />
              }
            />
            {data.studio.description && <p>{data.studio.description}</p>}
          </Panel>
          <Section title="Choose your artist">
            {!data.artists.length && (
              <Feedback empty="Online bookings aren’t open for this studio yet. Contact the studio to arrange your appointment." />
            )}
            {data.artists.map(artist => (
              <Row
                key={artist.id}
                title={artist.name || "Artist"}
                detail={artist.bio || "View work and request a booking"}
                icon={<Avatar name={artist.name} src={artist.avatar} />}
                href={`/start/${encodeURIComponent(artist.publicSlug!)}`}
              />
            ))}
          </Section>
          <p className="v3-muted">
            Send your idea first. Your artist will review your request before
            you choose dates or pay a deposit.
          </p>
        </>
      )}
    </Screen>
  );
}
