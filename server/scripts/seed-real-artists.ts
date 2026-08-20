/**
 * seed-real-artists.ts
 * ─────────────────────────────────────────────────────────
 * 1. Deletes all artists except bookings@pmasontattoo.com
 * 2. Creates real Brisbane tattoo artist accounts
 * 3. Triggers Instagram import (first 20 posts) for each
 *
 * Run: pnpm tsx server/scripts/seed-real-artists.ts
 */

import "dotenv/config";
import { eq, ne, and, inArray } from "drizzle-orm";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";
import { nanoid } from "nanoid";
import { processInstagramImport } from "../services/instagramImportWorker";

// ── Real Brisbane tattoo artists ─────────────────────────
const REAL_ARTISTS = [
  {
    name: "Jake Jones",
    businessName: "Jake Jones Tattoo",
    instagram: "jakejonestattoo",
    keywords: "realism, portrait, black and grey, hyperrealism",
    bio: "Black & grey realism specialist at CB Ink, Lutwyche. Portraits and hyperrealism.",
    suburb: "Lutwyche",
    address: "550 Lutwyche Rd, Lutwyche QLD 4030",
    lat: "-27.4234", lng: "153.0306",
  },
  {
    name: "Cherie Buttons",
    businessName: "Cherie Buttons Tattoo",
    instagram: "cheriebuttons",
    keywords: "illustrative, neo-traditional, colour, bold",
    bio: "Illustrative and neo-traditional tattoos. Bold lines, vibrant colour.",
    suburb: "Fortitude Valley",
    address: "52 Brunswick St, Fortitude Valley QLD 4006",
    lat: "-27.4578", lng: "153.0389",
  },
  {
    name: "Jenny Ink",
    businessName: "Jenny Ink Studio",
    instagram: "jennyink_tattoo",
    keywords: "fine line, botanical, feminine, delicate, script",
    bio: "Delicate fine line work — botanical, celestial, and script tattoos from my private studio.",
    suburb: "Taringa",
    address: "19 Swann Rd, Taringa QLD 4068",
    lat: "-27.4977", lng: "152.9787",
  },
  {
    name: "Jeje",
    businessName: "Jeje Ink",
    instagram: "jeje_ink",
    keywords: "japanese, irezumi, dragon, koi, hannya, colour",
    bio: "Japanese traditional and irezumi specialist. Large-scale sleeves and back pieces.",
    suburb: "Morningside",
    address: "612 Wynnum Rd, Morningside QLD 4170",
    lat: "-27.4621", lng: "153.0742",
  },
  {
    name: "Graceful Tattoos",
    businessName: "Graceful Tattoos",
    instagram: "graceful_tatt",
    keywords: "fine line, illustrative, floral, minimalist",
    bio: "Fine line and illustrative tattooing. Delicate and intentional work.",
    suburb: "New Farm",
    address: "14 Merthyr Rd, New Farm QLD 4005",
    lat: "-27.4683", lng: "153.0442",
  },
  {
    name: "Hailey Blossom",
    businessName: "Hailey Blossom Tattoo",
    instagram: "hailey_blossom",
    keywords: "fine line, detailed, pet portraits, floral, dainty",
    bio: "Fine line and detailed tattoos. Pet portraits and dainty floral work.",
    suburb: "Spring Hill",
    address: "20 Leichhardt St, Spring Hill QLD 4000",
    lat: "-27.4600", lng: "153.0206",
  },
  {
    name: "Cappy Ink",
    businessName: "Cappy Ink",
    instagram: "cappy_ink",
    keywords: "illustrative, unique, colour, custom, artistic",
    bio: "Passionate about unique, custom designs. Every tattoo is one-of-a-kind.",
    suburb: "Mt Gravatt",
    address: "1714 Logan Rd, Mt Gravatt QLD 4122",
    lat: "-27.5399", lng: "153.0796",
  },
  {
    name: "Steve",
    businessName: "Fable Tattoo",
    instagram: "tattoos.by.steve",
    keywords: "colour, pop culture, anime, gaming, new school",
    bio: "Colour specialist at Fable Tattoo, West End. Pop culture, anime, and gaming pieces.",
    suburb: "West End",
    address: "88 Vulture St, West End QLD 4101",
    lat: "-27.4795", lng: "153.0118",
  },
  {
    name: "Westside Tattoo",
    businessName: "Westside Tattoo Brisbane",
    instagram: "westside_tattoo_brisbane",
    keywords: "japanese, traditional, portraiture, custom, mixed styles",
    bio: "Long-standing Brisbane studio with diverse expertise across all tattoo styles.",
    suburb: "West End",
    address: "195 Boundary St, West End QLD 4101",
    lat: "-27.4782", lng: "153.0098",
  },
  {
    name: "Valley Ink",
    businessName: "Valley Ink",
    instagram: "valleyink",
    keywords: "custom, thin line, dot work, diverse styles",
    bio: "Custom tattoo studio in the Valley. Diverse artists specialising in multiple styles.",
    suburb: "Fortitude Valley",
    address: "315 Brunswick St, Fortitude Valley QLD 4006",
    lat: "-27.4542", lng: "153.0380",
  },
  {
    name: "Tailor Made Tattoo",
    businessName: "Tailor Made Tattoo",
    instagram: "tailormadetattoo",
    keywords: "custom, realism, colour, black and grey, walk-in",
    bio: "Custom tattoo studio in Woolloongabba. Welcoming to walk-ins and appointments alike.",
    suburb: "Woolloongabba",
    address: "71 Logan Rd, Woolloongabba QLD 4102",
    lat: "-27.4895", lng: "153.0329",
  },
  {
    name: "CB Ink",
    businessName: "CB Ink Tattoo",
    instagram: "cbinktattoo",
    keywords: "realism, portrait, black and grey, colour, japanese, diverse",
    bio: "Large Brisbane studio with 25+ artists across every style. Lutwyche.",
    suburb: "Lutwyche",
    address: "543 Lutwyche Rd, Lutwyche QLD 4030",
    lat: "-27.4230", lng: "153.0310",
  },
  {
    name: "Chalice Tattoo",
    businessName: "Chalice Tattoo Company",
    instagram: "chalicetattooco",
    keywords: "blackwork, dark art, occult, gothic, illustrative",
    bio: "Detailed blackwork, occult-inspired and gothic tattooing in Paddington.",
    suburb: "Paddington",
    address: "210 Given Tce, Paddington QLD 4064",
    lat: "-27.4597", lng: "152.9989",
  },
  {
    name: "Save Point Tattoo",
    businessName: "Save Point Tattoo",
    instagram: "savepointtattoo",
    keywords: "anime, gaming, neo-japanese, colour, pop culture",
    bio: "Anime, gaming, and neo-Japanese tattoo specialists in Greenslopes.",
    suburb: "Greenslopes",
    address: "162 Logan Rd, Greenslopes QLD 4120",
    lat: "-27.5035", lng: "153.0466",
  },
  {
    name: "Ink Embassy",
    businessName: "Ink Embassy",
    instagram: "inkembassy",
    keywords: "colour, custom, vibrant, realism, illustrative",
    bio: "Vibrant colour work and custom designs. Bulimba's premium tattoo studio.",
    suburb: "Bulimba",
    address: "43 Oxford St, Bulimba QLD 4171",
    lat: "-27.4617", lng: "153.0622",
  },
  // ── 20 new artists ──
  {
    name: "Paragon Tattoo",
    businessName: "Paragon Tattoo",
    instagram: "paragontattoo",
    keywords: "japanese, neo-traditional, black and grey, custom",
    bio: "Premium custom studio in Chermside. Japanese, neo-trad, and black and grey.",
    suburb: "Chermside",
    address: "730 Gympie Rd, Chermside QLD 4032",
    lat: "-27.3862", lng: "153.0322",
  },
  {
    name: "Shinko Tattoo",
    businessName: "Shinko Tattoo",
    instagram: "shinkotattoo",
    keywords: "black and grey, realism, large scale, custom",
    bio: "High-end realism and large-scale work in Albion.",
    suburb: "Albion",
    address: "62 Sandgate Rd, Albion QLD 4010",
    lat: "-27.4317", lng: "153.0446",
  },
  {
    name: "Balaclava Ink",
    businessName: "Balaclava Ink",
    instagram: "balaclava_ink",
    keywords: "black and grey, realism, portrait, dark",
    bio: "Specialising in black and grey realism. Dark, detailed work.",
    suburb: "Woolloongabba",
    address: "100 Balaclava St, Woolloongabba QLD 4102",
    lat: "-27.4880", lng: "153.0355",
  },
  {
    name: "Black Market Tattoo",
    businessName: "Black Market Tattoo Co",
    instagram: "blackmarkettattooco",
    keywords: "custom, mixed styles, colour, realism, walk-in",
    bio: "Gold Coast's premier multi-style studio. Walk-ins welcome.",
    suburb: "Burleigh Heads",
    address: "1/21 James St, Burleigh Heads QLD 4220",
    lat: "-28.0874", lng: "153.4447",
  },
  {
    name: "Loco Tattoo",
    businessName: "Loco Tattoo",
    instagram: "locotattoo",
    keywords: "realism, black and grey, colour, portrait",
    bio: "Internationally acclaimed studio on the Gold Coast.",
    suburb: "Chevron Island",
    address: "15 Thomas Dr, Chevron Island QLD 4217",
    lat: "-28.0044", lng: "153.4219",
  },
  {
    name: "Jayla Tattoo",
    businessName: "Seventh Circle Studio",
    instagram: "jaylatattoo",
    keywords: "bold, traditional, colour, neo-traditional",
    bio: "Bold traditional and neo-traditional at Seventh Circle.",
    suburb: "Woolloongabba",
    address: "78 Logan Rd, Woolloongabba QLD 4102",
    lat: "-27.4890", lng: "153.0335",
  },
  {
    name: "Tim Rix",
    businessName: "Seventh Circle Studio",
    instagram: "tim_rix",
    keywords: "illustrative, bold, colour, custom, dark",
    bio: "Bold illustrative work. Dark themes with vibrant colour.",
    suburb: "Woolloongabba",
    address: "78 Logan Rd, Woolloongabba QLD 4102",
    lat: "-27.4890", lng: "153.0335",
  },
  {
    name: "Radiance Tattoo",
    businessName: "Oasis Studio",
    instagram: "radiance_tattoo",
    keywords: "fine line, delicate, ornamental, geometric",
    bio: "Ornamental and geometric fine line specialist.",
    suburb: "Mt Gravatt East",
    address: "1880 Logan Rd, Mt Gravatt East QLD 4122",
    lat: "-27.5410", lng: "153.0810",
  },
  {
    name: "Tatts by Jord",
    businessName: "Oasis Studio",
    instagram: "tatts.by.jord",
    keywords: "cute, kawaii, colour, illustrative, fun",
    bio: "Cute and kawaii style tattoos. Fun colourful pieces.",
    suburb: "Mt Gravatt East",
    address: "1880 Logan Rd, Mt Gravatt East QLD 4122",
    lat: "-27.5410", lng: "153.0810",
  },
  {
    name: "Raspberry Room",
    businessName: "The Raspberry Room",
    instagram: "theraspberryroom",
    keywords: "fine line, elegant, floral, minimalist, botanical",
    bio: "Elite fine line artistry on the Gold Coast.",
    suburb: "Mermaid Beach",
    address: "2437 Gold Coast Hwy, Mermaid Beach QLD 4218",
    lat: "-28.0472", lng: "153.4370",
  },
  {
    name: "Anastasia Fine Line",
    businessName: "Anastasia Fine Line Tattoo",
    instagram: "anastasiafinelinetattoo",
    keywords: "fine line, ornamental, botanical, delicate, feminine",
    bio: "Graceful ornaments and botanical designs. Soft, precise work.",
    suburb: "Fortitude Valley",
    address: "30 Duncan St, Fortitude Valley QLD 4006",
    lat: "-27.4565", lng: "153.0395",
  },
  {
    name: "Dylan Phillips",
    businessName: "Storm the Gates",
    instagram: "dyltattoos",
    keywords: "japanese, bold, traditional, irezumi, colour",
    bio: "Bold traditional Japanese tattooing on the Gold Coast.",
    suburb: "Mudgeeraba",
    address: "45 Railway St, Mudgeeraba QLD 4213",
    lat: "-28.0778", lng: "153.3700",
  },
  {
    name: "Minamoto Tattoo",
    businessName: "Minamoto Tattoo",
    instagram: "minamototattoo",
    keywords: "japanese, irezumi, large scale, back piece, sleeve",
    bio: "Traditional Japanese and large-scale irezumi on the Gold Coast.",
    suburb: "Palm Beach",
    address: "1128 Gold Coast Hwy, Palm Beach QLD 4221",
    lat: "-28.1122", lng: "153.4627",
  },
  {
    name: "Penno",
    businessName: "CB Ink Tattoo",
    instagram: "penno_tattoo",
    keywords: "bold, colour, neo-traditional, illustrative",
    bio: "Bold colour and neo-traditional designs at CB Ink.",
    suburb: "Lutwyche",
    address: "543 Lutwyche Rd, Lutwyche QLD 4030",
    lat: "-27.4230", lng: "153.0310",
  },
  {
    name: "Peta Jameson",
    businessName: "Tailor Made Tattoo",
    instagram: "petajamesontattoo",
    keywords: "colour, illustrative, custom, feminine, floral",
    bio: "Illustrative colour work at Tailor Made Tattoo.",
    suburb: "Woolloongabba",
    address: "71 Logan Rd, Woolloongabba QLD 4102",
    lat: "-27.4895", lng: "153.0329",
  },
  {
    name: "Chrystal Leigh",
    businessName: "Ink Embassy",
    instagram: "chrystaltattoo",
    keywords: "colour, realism, vibrant, custom, portrait",
    bio: "Vibrant colour realism. Owner of Ink Embassy, Bulimba.",
    suburb: "Bulimba",
    address: "43 Oxford St, Bulimba QLD 4171",
    lat: "-27.4617", lng: "153.0622",
  },
  {
    name: "Lucky Cat Lane",
    businessName: "Lucky Cat Lane",
    instagram: "luckycatlane",
    keywords: "fine line, illustrative, mixed styles, custom",
    bio: "Multi-artist Gold Coast studio. Fine line and illustrative.",
    suburb: "Mermaid Beach",
    address: "2517 Gold Coast Hwy, Mermaid Beach QLD 4218",
    lat: "-28.0490", lng: "153.4375",
  },
  {
    name: "Rhys Sharp",
    businessName: "CB Ink Tattoo",
    instagram: "rhyssharptattoo",
    keywords: "japanese, irezumi, sleeve, traditional, colour",
    bio: "Classic irezumi sleeves and traditional Japanese at CB Ink.",
    suburb: "Lutwyche",
    address: "543 Lutwyche Rd, Lutwyche QLD 4030",
    lat: "-27.4230", lng: "153.0310",
  },
  {
    name: "Sam Walters",
    businessName: "Tailor Made Tattoo",
    instagram: "samwalterstattoo",
    keywords: "realism, black and grey, portrait, detail",
    bio: "Detailed realism and portraiture at Tailor Made.",
    suburb: "Woolloongabba",
    address: "71 Logan Rd, Woolloongabba QLD 4102",
    lat: "-27.4895", lng: "153.0329",
  },
  {
    name: "Dai Tanabe",
    businessName: "Lucky Cat Lane",
    instagram: "dai_tattoo_artist",
    keywords: "fine line, illustrative, japanese fusion, custom",
    bio: "Fine line and illustrative work with Japanese influences.",
    suburb: "Mermaid Beach",
    address: "2517 Gold Coast Hwy, Mermaid Beach QLD 4218",
    lat: "-28.0490", lng: "153.4375",
  },
];

const OPENING_MESSAGES = [
  "Hey! Thanks for checking out my work. What are you thinking for your next piece?",
  "Welcome! I'm excited to potentially work with you. What style are you after?",
  "Hi there! Stoked you found me. Drop me your ideas and let's make something rad.",
  "Thanks for connecting! I have some availability coming up — what were you thinking?",
  "Hey! Love hearing from new clients. Tell me about your vision!",
];

// Max items to import per artist
const MAX_ITEMS_PER_ARTIST = 20;
// Delay between artists (ms) to avoid API rate limits
const DELAY_BETWEEN_ARTISTS = 5000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🎨 Real Brisbane Artist Seeder Starting...\n");
  console.log(`   Artists: ${REAL_ARTISTS.length}`);
  console.log(`   Max imports per artist: ${MAX_ITEMS_PER_ARTIST}`);
  console.log(`   Delay between artists: ${DELAY_BETWEEN_ARTISTS}ms\n`);

  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed");
    process.exit(1);
  }

  // ── 1. Find a client for conversations ──────────────────
  const [clientUser] = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.role, "client"))
    .limit(1);

  if (!clientUser) {
    console.error("❌ No client user found.");
    process.exit(1);
  }
  console.log(`✅ Client found: ${clientUser.name} (${clientUser.id})`);

  // ── 2. Find the artist to KEEP ──────────────────────────
  const [keepArtist] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, "bookings@pmasontattoo.com"))
    .limit(1);

  console.log(
    keepArtist
      ? `✅ Keeping artist: ${keepArtist.email} (${keepArtist.id})`
      : "⚠️  bookings@pmasontattoo.com not found — skipping preservation"
  );

  // ── 3. Delete all other artists ─────────────────────────
  const artistsToDelete = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.role, "artist"));

  const idsToDelete = artistsToDelete
    .filter(a => a.email !== "bookings@pmasontattoo.com")
    .map(a => a.id);

  if (idsToDelete.length > 0) {
    // Delete portfolio items for these artists first
    for (const id of idsToDelete) {
      await db.delete(schema.portfolios).where(eq(schema.portfolios.artistId, id));
    }
    // Delete artists (cascade handles conversations, messages, artistSettings)
    await db.delete(schema.users).where(inArray(schema.users.id, idsToDelete));
    console.log(`🗑️  Deleted ${idsToDelete.length} existing mock artists\n`);
  } else {
    console.log("ℹ️  No artists to delete\n");
  }

  // ── 4. Create real artists + import Instagram ───────────
  console.log("🎭 Creating real Brisbane artists...\n");

  const results: { name: string; status: string; imported: number }[] = [];

  for (let i = 0; i < REAL_ARTISTS.length; i++) {
    const artist = REAL_ARTISTS[i];
    const artistId = nanoid();
    const slug = artist.instagram.replace(/[^a-z0-9]/gi, "").toLowerCase();

    console.log(`  ── ${i + 1}/${REAL_ARTISTS.length} — ${artist.name} (@${artist.instagram}) ──`);

    try {
      // Create user
      await db.insert(schema.users).values({
        id: artistId,
        name: artist.name,
        email: `${artist.instagram}@demo.tattoi.app`,
        role: "artist",
        bio: artist.bio,
        city: artist.suburb,
        hasCompletedOnboarding: 1,
      });

      // Create artistSettings
      await db.insert(schema.artistSettings).values({
        userId: artistId,
        businessName: artist.businessName,
        displayName: artist.name,
        businessAddress: artist.address,
        businessCountry: "AU",
        keywords: artist.keywords,
        publicSlug: slug,
        funnelEnabled: 1,
        workSchedule: JSON.stringify({}),
        services: JSON.stringify([]),
        lat: artist.lat,
        lng: artist.lng,
      });

      // Create conversation with the client
      const [conv] = await db
        .insert(schema.conversations)
        .values({
          artistId,
          clientId: clientUser.id,
        })
        .$returningId();

      await db.insert(schema.messages).values({
        conversationId: conv.id,
        senderId: artistId,
        content: OPENING_MESSAGES[i % OPENING_MESSAGES.length],
        messageType: "text",
      });

      console.log(`    ✅ Account created (${slug})`);

      // Create import record
      const [importResult] = await db.insert(schema.instagramImports).values({
        artistId,
        instagramUsername: artist.instagram,
        status: "in_progress",
      });

      const importId = importResult.insertId;

      // Run import (limited to MAX_ITEMS_PER_ARTIST)
      console.log(`    📸 Importing first ${MAX_ITEMS_PER_ARTIST} posts from @${artist.instagram}...`);
      await processInstagramImport(db, importId, artistId, artist.instagram, MAX_ITEMS_PER_ARTIST);

      // Check final status
      const finalImport = await db.query.instagramImports.findFirst({
        where: eq(schema.instagramImports.id, importId),
      });

      const added = finalImport?.totalAdded || 0;
      const status = finalImport?.status || "unknown";
      console.log(`    📊 Result: ${added} imported (${status})\n`);

      results.push({ name: artist.name, status, imported: added });
    } catch (err: any) {
      console.error(`    ❌ Failed: ${err.message}\n`);
      results.push({ name: artist.name, status: "error", imported: 0 });
    }

    // Delay between artists to avoid API rate limits
    if (i < REAL_ARTISTS.length - 1) {
      console.log(`    ⏳ Waiting ${DELAY_BETWEEN_ARTISTS / 1000}s before next artist...`);
      await sleep(DELAY_BETWEEN_ARTISTS);
    }
  }

  // ── Summary ─────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  SEED SUMMARY");
  console.log("═".repeat(60));
  
  let totalImported = 0;
  for (const r of results) {
    const icon = r.status === "completed" ? "✅" : r.status === "error" ? "❌" : "⚠️";
    console.log(`  ${icon} ${r.name.padEnd(25)} ${String(r.imported).padStart(3)} posts  (${r.status})`);
    totalImported += r.imported;
  }
  
  console.log("─".repeat(60));
  console.log(`  Total: ${totalImported} posts imported across ${results.filter(r => r.imported > 0).length} artists`);
  console.log("═".repeat(60) + "\n");

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
