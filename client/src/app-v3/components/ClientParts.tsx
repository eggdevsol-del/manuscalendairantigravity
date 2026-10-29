/* The client's own surfaces, as in the prototype: their tattoos as postcards, artists to discover as
   cards, and their Tattoi pass. Every value comes from the client's bookings, offers and the discover feed. */
import { Link } from "wouter";
import { Compass, Sparkles } from "lucide-react";
import { getAssetUrl } from "@/lib/assets";
import { Avatar } from "../design/primitives";
import type { clientProjects, discoverArtists } from "../design/landingData";
import { StageRing } from "./DetailStages";

/** One postcard for each tattoo: its picture, the artist, and a ring for the sittings that are done. */
export function ProjectPostcards({
  projects,
}: {
  projects: ReturnType<typeof clientProjects>;
}) {
  return (
    <div className="iosm-posts">
      {projects.map(p => (
        <Link
          key={p.key}
          href={p.href}
          className="iosm-post tall"
          aria-label={`${p.name} with ${p.artist}, ${p.done} of ${p.total} sittings done`}
        >
          {p.image ? (
            <img src={getAssetUrl(p.image)} alt="" />
          ) : (
            <span className="iosm-post-blank">
              <Sparkles />
            </span>
          )}
          <span>
            <i>
              {p.done} of {p.total} sitting{p.total === 1 ? "" : "s"}
            </i>
            <strong>{p.name}</strong>
            <em>with {p.artist}</em>
            <StageRing fraction={p.done / p.total} label="" size={40} />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Artists to discover as cards: their newest work, name, city and styles. Each opens their page. */
export function ArtistCards({
  artists,
}: {
  artists: ReturnType<typeof discoverArtists>;
}) {
  return (
    <div className="iosm-posts">
      {artists.map(a => (
        <Link
          key={a.id}
          href={`/${a.slug}`}
          className="iosm-post tall"
          aria-label={`${a.name}${a.city ? `, ${a.city}` : ""}`}
        >
          {a.image ? (
            <img src={getAssetUrl(a.image)} alt="" />
          ) : (
            <span className="iosm-post-blank">
              <Compass />
            </span>
          )}
          <span>
            {a.styles.length > 0 && <i>{a.styles.join(", ")}</i>}
            <strong>{a.name}</strong>
            {a.city && <em>{a.city}</em>}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** The client's Tattoi pass: their name and photo, with how many vouchers and tattoos they have. */
export function PassCard({
  name,
  avatar,
  detail,
  facts,
}: {
  name: string;
  avatar?: string | null;
  detail?: string | null;
  facts: string[];
}) {
  return (
    <section className="iosm-pass" aria-label={`Tattoi client pass for ${name}`}>
      <span>Tattoi client</span>
      <b>{name}</b>
      {detail && <small>{detail}</small>}
      <Avatar name={name} src={avatar} />
      {facts.length > 0 && <em>{facts.join(" · ")}</em>}
    </section>
  );
}
