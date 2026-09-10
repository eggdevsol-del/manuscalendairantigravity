import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  ActionLink,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  SearchField,
} from "../design/primitives";
export default function Discover() {
  const [tag, setTag] = useState("");
  const [filter, setFilter] = useState("");
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const query = trpc.feed.getDiscoverFeed.useQuery({
    limit: 20,
    cursor: cursors[cursors.length - 1],
    tag: filter || undefined,
  });
  const work = query.data?.cards.find(card => card.id === selected);
  return (
    <Screen
      title="Discover artists"
      subtitle="Find work you connect with. Book directly with the artist."
      back="/bookings"
      wide
    >
      <form
        className="v3-inline"
        onSubmit={event => {
          event.preventDefault();
          setFilter(tag.trim());
          setCursors([undefined]);
          setSelected(null);
        }}
      >
        <SearchField
          value={tag}
          onChange={setTag}
          label="Search style tags"
          placeholder="Try fine line, realism or Japanese"
        />
        <Action type="submit">Find work</Action>
        {filter && (
          <Action
            tone="quiet"
            onClick={() => {
              setTag("");
              setFilter("");
              setCursors([undefined]);
            }}
          >
            Clear
          </Action>
        )}
      </form>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data?.cards.length === 0 && (
        <Feedback
          empty={
            filter
              ? "No work matches that style tag yet. Try another style."
              : "Artists’ published work will appear here."
          }
        />
      )}
      <div className="v3-shop-grid">
        {query.data?.cards.map(card => (
          <Panel key={card.id}>
            <button
              className="v3-media-open"
              aria-label={`View work by ${card.artistName}`}
              onClick={() => {
                setSelected(card.id);
                setVideoFailed(false);
              }}
            >
              <img
                className="v3-shop-image"
                src={card.imageUrl}
                alt={card.description || `Tattoo by ${card.artistName}`}
                loading="lazy"
              />
              {card.videoUrl && <span>Play video</span>}
            </button>
            <Row
              title={card.artistName}
              detail={card.artistCity}
              icon={<Avatar name={card.artistName} src={card.artistAvatar} />}
              href={`/book/${encodeURIComponent(card.artistSlug!)}`}
            />
          </Panel>
        ))}
      </div>
      <div className="v3-inline">
        {cursors.length > 1 && (
          <Action
            tone="secondary"
            disabled={query.isFetching}
            onClick={() => {
              setSelected(null);
              setCursors(previous => previous.slice(0, -1));
            }}
          >
            Previous work
          </Action>
        )}
        {query.data?.nextCursor && (
          <Action
            disabled={query.isFetching}
            onClick={() => {
              setSelected(null);
              setCursors(previous => [...previous, query.data!.nextCursor!]);
            }}
          >
            More work
          </Action>
        )}
      </div>
      <SheetShell
        isOpen={!!work}
        title={work?.artistName || "Artist’s work"}
        onClose={() => setSelected(null)}
      >
        {work && (
          <div className="v3-stack">
            {work.videoUrl && !videoFailed ? (
              <video
                key={work.id}
                className="v3-media-full"
                src={work.videoUrl}
                poster={work.imageUrl}
                controls
                playsInline
                preload="metadata"
                onError={() => setVideoFailed(true)}
              />
            ) : (
              <img
                className="v3-media-full"
                src={work.imageUrl}
                alt={work.description || "Tattoo reference"}
              />
            )}
            {videoFailed && (
              <p className="v3-muted">
                Video is unavailable. You can still view the artist’s work and
                booking page.
              </p>
            )}
            <p>{work.description}</p>
            <ActionLink
              href={`/book/${encodeURIComponent(work.artistSlug!)}`}
              tone="primary"
            >
              View artist & request a booking
            </ActionLink>
          </div>
        )}
      </SheetShell>
    </Screen>
  );
}
