/**
 * seed-mock-artists.ts
 * ─────────────────────────────────────────────────────────
 * 1. Deletes all artists except bookings@pmasontattoo.com
 * 2. Creates 25 Brisbane mock artists with full settings,
 *    avatars, banners, keywords, and lat/lng coordinates
 * 3. Creates conversations + opening messages linked to
 *    the first client found in the system (bob lazar)
 *
 * Run: pnpm tsx server/scripts/seed-mock-artists.ts
 */

import "dotenv/config";
import { eq, ne, and, inArray } from "drizzle-orm";
import { getDb } from "../services/core";
import { users, artistSettings, conversations, messages } from "../../drizzle/schema";
import { nanoid } from "nanoid";

// ── Brisbane suburbs with precise lat/lng ───────────────────
const BRISBANE_LOCATIONS = [
  { suburb: "Fortitude Valley", address: "Shop 3, 52 Brunswick St, Fortitude Valley QLD 4006", lat: "-27.4578", lng: "153.0389" },
  { suburb: "New Farm", address: "14 Merthyr Rd, New Farm QLD 4005", lat: "-27.4683", lng: "153.0442" },
  { suburb: "West End", address: "88 Vulture St, West End QLD 4101", lat: "-27.4795", lng: "153.0118" },
  { suburb: "Paddington", address: "210 Given Tce, Paddington QLD 4064", lat: "-27.4597", lng: "152.9989" },
  { suburb: "Newstead", address: "3 Longland St, Newstead QLD 4006", lat: "-27.4536", lng: "153.0432" },
  { suburb: "Woolloongabba", address: "71 Logan Rd, Woolloongabba QLD 4102", lat: "-27.4895", lng: "153.0329" },
  { suburb: "Spring Hill", address: "20 Leichhardt St, Spring Hill QLD 4000", lat: "-27.4600", lng: "153.0206" },
  { suburb: "Toowong", address: "94 Sherwood Rd, Toowong QLD 4066", lat: "-27.4858", lng: "152.9834" },
  { suburb: "Milton", address: "5 Park Rd, Milton QLD 4064", lat: "-27.4728", lng: "152.9877" },
  { suburb: "Albion", address: "37 Sandgate Rd, Albion QLD 4010", lat: "-27.4367", lng: "153.0354" },
  { suburb: "Hamilton", address: "140 Racecourse Rd, Hamilton QLD 4007", lat: "-27.4448", lng: "153.0644" },
  { suburb: "Hawthorne", address: "18 Florence St, Hawthorne QLD 4171", lat: "-27.4644", lng: "153.0672" },
  { suburb: "Bulimba", address: "43 Oxford St, Bulimba QLD 4171", lat: "-27.4617", lng: "153.0622" },
  { suburb: "Greenslopes", address: "162 Logan Rd, Greenslopes QLD 4120", lat: "-27.5035", lng: "153.0466" },
  { suburb: "Camp Hill", address: "756 Old Cleveland Rd, Camp Hill QLD 4152", lat: "-27.4960", lng: "153.0553" },
  { suburb: "Coorparoo", address: "55 Chatsworth Rd, Coorparoo QLD 4151", lat: "-27.5009", lng: "153.0512" },
  { suburb: "Stones Corner", address: "2 Cavendish Rd, Stones Corner QLD 4120", lat: "-27.4966", lng: "153.0449" },
  { suburb: "Windsor", address: "81 Lutwyche Rd, Windsor QLD 4030", lat: "-27.4474", lng: "153.0179" },
  { suburb: "Kangaroo Point", address: "7 Main St, Kangaroo Point QLD 4169", lat: "-27.4812", lng: "153.0386" },
  { suburb: "Teneriffe", address: "22 Longland St, Teneriffe QLD 4005", lat: "-27.4556", lng: "153.0425" },
  { suburb: "Bowen Hills", address: "44 Campbell St, Bowen Hills QLD 4006", lat: "-27.4456", lng: "153.0331" },
  { suburb: "Ascot", address: "12 Racecourse Rd, Ascot QLD 4007", lat: "-27.4344", lng: "153.0535" },
  { suburb: "South Brisbane", address: "193 Melbourne St, South Brisbane QLD 4101", lat: "-27.4803", lng: "153.0199" },
  { suburb: "Nundah", address: "90 Sandgate Rd, Nundah QLD 4012", lat: "-27.4051", lng: "153.0554" },
  { suburb: "Chermside", address: "375 Gympie Rd, Chermside QLD 4032", lat: "-27.3869", lng: "153.0284" },
];

// ── Mock artists data ────────────────────────────────────────
const MOCK_ARTISTS = [
  {
    name: "Kai Ngata",
    email: "kai.ngata.ink@gmail.com",
    businessName: "Kai Ngata Tattoo",
    displayName: "Kai Ngata",
    keywords: "tāmoko, māori, traditional, black and grey, polynesian",
    bio: "Specialising in traditional Māori tāmoko and Polynesian patterns. Brisbane-based with 12 years experience.",
    avatar: "https://i.pravatar.cc/150?img=11",
    banner: "https://picsum.photos/seed/kaiink/600/200",
    slug: "kaingatatattoo",
  },
  {
    name: "Jade Morrison",
    email: "jade.morrison.tattoo@gmail.com",
    businessName: "Jade Morrison Studio",
    displayName: "Jade Morrison",
    keywords: "realism, portrait, colour, botanical, fine line",
    bio: "Award-winning realism artist. Portraits and botanical pieces are my passion.",
    avatar: "https://i.pravatar.cc/150?img=47",
    banner: "https://picsum.photos/seed/jadestudio/600/200",
    slug: "jadestudio",
  },
  {
    name: "Marcus Chen",
    email: "marcus.chen.ink@gmail.com",
    businessName: "Black Dragon Ink",
    displayName: "Marcus Chen",
    keywords: "japanese, irezumi, koi, dragon, blackwork, traditional",
    bio: "Traditional Japanese irezumi specialist. Full suits and large-scale pieces welcome.",
    avatar: "https://i.pravatar.cc/150?img=33",
    banner: "https://picsum.photos/seed/blackdragon/600/200",
    slug: "blackdragonink",
  },
  {
    name: "Priya Sharma",
    email: "priya.sharma.tattoo@gmail.com",
    businessName: "Sacred Lotus Tattoo",
    displayName: "Priya Sharma",
    keywords: "fine line, minimalist, geometric, mandala, dot work",
    bio: "Delicate fine line work and geometric mandala designs. Clean, precise, intentional.",
    avatar: "https://i.pravatar.cc/150?img=44",
    banner: "https://picsum.photos/seed/sacredlotus/600/200",
    slug: "sacredlotustattoo",
  },
  {
    name: "Zane Russell",
    email: "zane.russell.ink@gmail.com",
    businessName: "Dark Matter Tattoo",
    displayName: "Zane Russell",
    keywords: "blackwork, dark art, horror, neo-traditional, illustrative",
    bio: "Dark art and horror-inspired pieces. Neo-traditional with a blackwork twist.",
    avatar: "https://i.pravatar.cc/150?img=15",
    banner: "https://picsum.photos/seed/darkmatter/600/200",
    slug: "darkmatterink",
  },
  {
    name: "Aroha Te Koha",
    email: "aroha.tekoha.ink@gmail.com",
    businessName: "Aroha Ink",
    displayName: "Aroha Te Koha",
    keywords: "tāmoko, polynesian, black and grey, cultural, traditional",
    bio: "Passionate about preserving and sharing Pacific cultural art through tattooing.",
    avatar: "https://i.pravatar.cc/150?img=48",
    banner: "https://picsum.photos/seed/arohaink/600/200",
    slug: "arohaink",
  },
  {
    name: "Tyler Banks",
    email: "tyler.banks.tattoo@gmail.com",
    businessName: "Coastal Ink Co.",
    displayName: "Tyler Banks",
    keywords: "watercolour, new school, colour, surrealism, abstract",
    bio: "Bright, vibrant watercolour and new school designs. If you want something wild and colourful, I'm your guy.",
    avatar: "https://i.pravatar.cc/150?img=17",
    banner: "https://picsum.photos/seed/coastalink/600/200",
    slug: "coastalinkcobne",
  },
  {
    name: "Sofia Reyes",
    email: "sofia.reyes.ink@gmail.com",
    businessName: "La Rosa Tattoo",
    displayName: "Sofia Reyes",
    keywords: "chicano, portrait, black and grey, realism, lettering",
    bio: "Chicano realism and black & grey portraits. Every piece tells a story.",
    avatar: "https://i.pravatar.cc/150?img=49",
    banner: "https://picsum.photos/seed/larosatattoo/600/200",
    slug: "larosatattoo",
  },
  {
    name: "Daniel Kiru",
    email: "daniel.kiru.ink@gmail.com",
    businessName: "Kiru & Co. Tattoo",
    displayName: "Daniel Kiru",
    keywords: "geometric, sacred geometry, blackwork, minimalist, tribal",
    bio: "Sacred geometry and precise geometric blackwork. Mathematics meets art.",
    avatar: "https://i.pravatar.cc/150?img=22",
    banner: "https://picsum.photos/seed/kiruco/600/200",
    slug: "kiruandco",
  },
  {
    name: "Emma Whitfield",
    email: "emma.whitfield.tattoo@gmail.com",
    businessName: "Wildflower Tattoo",
    displayName: "Emma Whitfield",
    keywords: "botanical, floral, fine line, colour, watercolour, feminine",
    bio: "Botanical and floral fine line work. Nature-inspired beauty etched in skin.",
    avatar: "https://i.pravatar.cc/150?img=46",
    banner: "https://picsum.photos/seed/wildflower/600/200",
    slug: "wildflowertattoo",
  },
  {
    name: "Leo Tanaka",
    email: "leo.tanaka.ink@gmail.com",
    businessName: "Ronin Tattoo",
    displayName: "Leo Tanaka",
    keywords: "japanese, samurai, blackwork, irezumi, neo-traditional",
    bio: "Japanese traditional and neo-traditional. Ronin by trade, artist by soul.",
    avatar: "https://i.pravatar.cc/150?img=35",
    banner: "https://picsum.photos/seed/ronintattoo/600/200",
    slug: "ronintattoo",
  },
  {
    name: "Chloe Barnes",
    email: "chloe.barnes.tattoo@gmail.com",
    businessName: "Chloe Barnes Ink",
    displayName: "Chloe Barnes",
    keywords: "realism, portrait, black and grey, colour, pet portrait",
    bio: "Photorealistic portraits — humans, animals, anything. Send me your vision.",
    avatar: "https://i.pravatar.cc/150?img=43",
    banner: "https://picsum.photos/seed/chloeink/600/200",
    slug: "chloebarnesink",
  },
  {
    name: "Ryan O'Sullivan",
    email: "ryan.osullivan.ink@gmail.com",
    businessName: "Celtic Roots Tattoo",
    displayName: "Ryan O'Sullivan",
    keywords: "celtic, traditional, black and grey, knotwork, old school",
    bio: "Celtic knotwork and old school traditional. Proud of my Irish heritage.",
    avatar: "https://i.pravatar.cc/150?img=16",
    banner: "https://picsum.photos/seed/celticroots/600/200",
    slug: "celticrootstattoo",
  },
  {
    name: "Nadia Kowalski",
    email: "nadia.kowalski.ink@gmail.com",
    businessName: "Nadia Ink",
    displayName: "Nadia Kowalski",
    keywords: "illustrative, folk art, colour, neo-traditional, animal",
    bio: "Folk art meets tattooing. Illustrative and colourful, always storytelling.",
    avatar: "https://i.pravatar.cc/150?img=45",
    banner: "https://picsum.photos/seed/nadiaink/600/200",
    slug: "nadiaink",
  },
  {
    name: "Bryce Holloway",
    email: "bryce.holloway.ink@gmail.com",
    businessName: "Holloway Collective",
    displayName: "Bryce Holloway",
    keywords: "surrealism, colour, abstract, experimental, large scale",
    bio: "Surrealist compositions and abstract large-scale work. Come with an open mind.",
    avatar: "https://i.pravatar.cc/150?img=13",
    banner: "https://picsum.photos/seed/hollowaycollective/600/200",
    slug: "hollowaycollective",
  },
  {
    name: "Mei Lin",
    email: "mei.lin.ink@gmail.com",
    businessName: "Mei Lin Studio",
    displayName: "Mei Lin",
    keywords: "fine line, geometric, minimalist, delicate, black and grey",
    bio: "Delicate, precise fine line work. Less is more — every line matters.",
    avatar: "https://i.pravatar.cc/150?img=50",
    banner: "https://picsum.photos/seed/meilin/600/200",
    slug: "meilinstudio",
  },
  {
    name: "Jack Donoghue",
    email: "jack.donoghue.ink@gmail.com",
    businessName: "Anchor & Arrow Tattoo",
    displayName: "Jack Donoghue",
    keywords: "traditional, old school, nautical, sailor, colour, bold",
    bio: "Classic American traditional and nautical tattoos. Bold lines, solid fills.",
    avatar: "https://i.pravatar.cc/150?img=12",
    banner: "https://picsum.photos/seed/anchorarrow/600/200",
    slug: "anchorandarrow",
  },
  {
    name: "Amara Diallo",
    email: "amara.diallo.ink@gmail.com",
    businessName: "Amara Tattoo Art",
    displayName: "Amara Diallo",
    keywords: "blackwork, abstract, geometric, tribal, afrocentic",
    bio: "Afrocentric patterns, bold blackwork and abstract compositions.",
    avatar: "https://i.pravatar.cc/150?img=51",
    banner: "https://picsum.photos/seed/amaraart/600/200",
    slug: "amaratattooart",
  },
  {
    name: "Finn McCarthy",
    email: "finn.mccarthy.ink@gmail.com",
    businessName: "Finn McCarthy Tattoo",
    displayName: "Finn McCarthy",
    keywords: "realism, black and grey, portrait, nature, wildlife",
    bio: "Wildlife realism and nature photography brought to life on skin.",
    avatar: "https://i.pravatar.cc/150?img=18",
    banner: "https://picsum.photos/seed/finnmccarthy/600/200",
    slug: "finnmccarthy",
  },
  {
    name: "Lily Santos",
    email: "lily.santos.ink@gmail.com",
    businessName: "Lily Santos Tattoo",
    displayName: "Lily Santos",
    keywords: "colour, new school, pop art, anime, illustrative, fun",
    bio: "Pop art, anime and new school colour. Let's make something fun and unique.",
    avatar: "https://i.pravatar.cc/150?img=52",
    banner: "https://picsum.photos/seed/lilysantos/600/200",
    slug: "lilysantos",
  },
  {
    name: "Sam Nguyen",
    email: "sam.nguyen.ink@gmail.com",
    businessName: "Saigon Ink Brisbane",
    displayName: "Sam Nguyen",
    keywords: "traditional, asian, black and grey, portrait, colour",
    bio: "Bringing Vietnamese tattoo artistry to Brisbane. Traditional and contemporary.",
    avatar: "https://i.pravatar.cc/150?img=24",
    banner: "https://picsum.photos/seed/saigonink/600/200",
    slug: "saigoninkbne",
  },
  {
    name: "Grace Elliot",
    email: "grace.elliot.ink@gmail.com",
    businessName: "Botanica Tattoo",
    displayName: "Grace Elliot",
    keywords: "botanical, fine line, watercolour, nature, floral",
    bio: "Nature is my muse. Botanical watercolour pieces that feel alive.",
    avatar: "https://i.pravatar.cc/150?img=53",
    banner: "https://picsum.photos/seed/botanica/600/200",
    slug: "botanicatattoo",
  },
  {
    name: "Owen Clark",
    email: "owen.clark.ink@gmail.com",
    businessName: "Clark Street Tattoo",
    displayName: "Owen Clark",
    keywords: "lettering, script, black and grey, traditional, bold",
    bio: "Lettering and script specialist. Custom hand-written and traditional styles.",
    avatar: "https://i.pravatar.cc/150?img=20",
    banner: "https://picsum.photos/seed/clarkstreet/600/200",
    slug: "clarkstreettattoo",
  },
  {
    name: "Imani Williams",
    email: "imani.williams.ink@gmail.com",
    businessName: "Imani Williams Ink",
    displayName: "Imani Williams",
    keywords: "portrait, realism, colour, black and grey, sentimental",
    bio: "Meaningful portrait work. I love helping people commemorate the people they love.",
    avatar: "https://i.pravatar.cc/150?img=54",
    banner: "https://picsum.photos/seed/imaniink/600/200",
    slug: "imaniink",
  },
  {
    name: "Ash Pemberton",
    email: "ash.pemberton.ink@gmail.com",
    businessName: "Void Collective Tattoo",
    displayName: "Ash Pemberton",
    keywords: "blackwork, dark, horror, occult, geometric, illustrative",
    bio: "Occult-inspired blackwork and dark illustration. The darker the better.",
    avatar: "https://i.pravatar.cc/150?img=14",
    banner: "https://picsum.photos/seed/voidcollective/600/200",
    slug: "voidcollective",
  },
];

// ── Opening messages from artists ────────────────────────────
const OPENING_MESSAGES = [
  "Hey! Thanks for reaching out. I'd love to chat about your next tattoo idea 🖤",
  "Welcome! I'm excited to potentially work with you. What are you thinking for your next piece?",
  "Hi there! Stoked you found me. Drop me your ideas and let's make something rad.",
  "Thanks for connecting! I have some great availability coming up — what were you thinking?",
  "Hey! Love hearing from new clients. Tell me about your vision!",
];

async function main() {
  console.log("🎨 Brisbane Artist Seeder Starting...\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed");
    process.exit(1);
  }

  // ── 1. Find bob lazar (or any client) ───────────────────────
  const [clientUser] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "client"))
    .limit(1);

  if (!clientUser) {
    console.error("❌ No client user found. Please ensure a client account exists.");
    process.exit(1);
  }
  console.log(`✅ Client found: ${clientUser.name} (${clientUser.id})`);

  // ── 2. Find the artist to KEEP ───────────────────────────────
  const [keepArtist] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, "bookings@pmasontattoo.com"))
    .limit(1);

  console.log(
    keepArtist
      ? `✅ Keeping artist: ${keepArtist.email} (${keepArtist.id})`
      : "⚠️  bookings@pmasontattoo.com not found — skipping preservation"
  );

  // ── 3. Delete all other artists ─────────────────────────────
  const artistsToDelete = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "artist"));

  const idsToDelete = artistsToDelete
    .filter(a => a.email !== "bookings@pmasontattoo.com")
    .map(a => a.id);

  if (idsToDelete.length > 0) {
    // Cascade delete handles conversations, messages, artistSettings
    await db.delete(users).where(
      inArray(users.id, idsToDelete)
    );
    console.log(`🗑️  Deleted ${idsToDelete.length} existing mock artists`);
  } else {
    console.log("ℹ️  No artists to delete");
  }

  // ── 4. Create 25 mock artists ────────────────────────────────
  console.log("\n🎭 Creating 25 mock Brisbane artists...\n");

  for (let i = 0; i < MOCK_ARTISTS.length; i++) {
    const artist = MOCK_ARTISTS[i];
    const location = BRISBANE_LOCATIONS[i];
    const artistId = nanoid();

    // Create user
    await db.insert(users).values({
      id: artistId,
      name: artist.name,
      email: artist.email,
      role: "artist",
      avatar: artist.avatar,
      bio: artist.bio,
      city: location.suburb,
      hasCompletedOnboarding: 1,
    });

    // Create artistSettings
    await db.insert(artistSettings).values({
      userId: artistId,
      businessName: artist.businessName,
      displayName: artist.displayName,
      businessAddress: location.address,
      businessCountry: "AU",
      funnelBannerUrl: artist.banner,
      keywords: artist.keywords,
      publicSlug: artist.slug,
      funnelEnabled: 1,
      workSchedule: JSON.stringify({}),
      services: JSON.stringify([]),
      lat: location.lat,
      lng: location.lng,
    });

    // Create conversation with the client
    const [conv] = await db
      .insert(conversations)
      .values({
        artistId,
        clientId: clientUser.id,
      })
      .$returningId();

    const convId = conv.id;

    // Create opening message from the artist
    const msgText = OPENING_MESSAGES[i % OPENING_MESSAGES.length];
    await db.insert(messages).values({
      conversationId: convId,
      senderId: artistId,
      content: msgText,
      messageType: "text",
    });

    console.log(`  ✅ ${i + 1}/25 — ${artist.displayName} @ ${location.suburb}`);
  }

  console.log("\n✨ Seeding complete! 25 Brisbane artists created.\n");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
