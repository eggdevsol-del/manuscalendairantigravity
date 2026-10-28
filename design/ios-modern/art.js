/* Tattoi Swipe — calm skies and soft image tiles.
   Every page sits on a slow gradient sky, the way iOS Weather does. Portfolio and
   product images are soft colour fields until real photos are dropped in. */
(function () {
  "use strict";
  const TAU = Math.PI * 2;

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(String(seed));
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Skies: top and horizon colours, the frosted-card tint, and two soft lights that drift.
  // Tattoi Ivory: warm paper skies, each with a faint hint of its page's purpose.
  const SKIES = {
    dawn: { top: "#f3ece4", bottom: "#e9ddd0", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    day: { top: "#f8f6f2", bottom: "#ece6dd", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    golden: { top: "#f5ede2", bottom: "#e8d9c6", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    dusk: { top: "#efebe5", bottom: "#ddd5cb", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    lavender: { top: "#f4f1ee", bottom: "#e6e0dc", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    blue: { top: "#f3f3f1", bottom: "#e3e2df", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    eucalyptus: { top: "#f2f3ee", bottom: "#e1e4da", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    sand: { top: "#f7f1e8", bottom: "#eadfcf", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    rose: { top: "#f6efeb", bottom: "#eadcd6", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    slate: { top: "#f1f0ed", bottom: "#e0ddd7", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    twilight: { top: "#efece8", bottom: "#dcd6ce", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    peach: { top: "#f8f0ea", bottom: "#ecdcd0", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
    teal: { top: "#f1f3f0", bottom: "#dfe4df", tint: "rgba(255,253,250,0.55)", glowA: "rgba(255,253,250,0.85)", glowB: "rgba(238,232,223,0.9)" },
  };
  // Today's sky follows the real time of day.
  function todaySky(d) {
    const h = (d || new Date()).getHours();
    if (h >= 5 && h < 8) return "dawn";
    if (h >= 8 && h < 16) return "day";
    if (h >= 16 && h < 19) return "golden";
    return "dusk";
  }
  function skyVars(name) {
    const s = SKIES[name] || SKIES.blue;
    return `--top:${s.top};--bottom:${s.bottom};--tint:${s.tint};--glowA:${s.glowA};--glowB:${s.glowB}`;
  }

  // Soft colour fields for portfolio pieces, keyed by tattoo style.
  const TILE = {
    botanical: ["#7f9c86", "#d8d2bb", "#a9bfa0"],
    blackwork: ["#3d4250", "#8c8f99", "#5d6270"],
    sacred: ["#7d74a8", "#e0cfa6", "#a99bc9"],
    mandala: ["#b98389", "#f0cbb5", "#d6a7a4"],
    moons: ["#4a5590", "#c3b9e2", "#7b7fb8"],
    geo: ["#4f8b8e", "#e3d3b5", "#7fb0ad"],
    waves: ["#4a7fb8", "#bfe0ea", "#7fb2d6"],
    ink: ["#7d64b8", "#eab0b5", "#a98ad0"],
    flash: ["#cf7a64", "#f3cf8f", "#e2a074"],
    sphere: ["#8b8582", "#e8d6cf", "#b6a8a2"],
    whorl: ["#5d8a83", "#cfe0d4", "#8fb3a8"],
    guilloche: ["#9b7b55", "#ecd7b0", "#c4a77d"],
    ridges: ["#5f7287", "#d3dce4", "#8fa2b4"],
    map: ["#6f9aa6", "#dfe8e4", "#a9c6c6"],
    product: ["#7f8ea0", "#e6e9ee", "#aab6c4"],
  };
  const STYLE_MOTIF = {
    Blackwork: "blackwork",
    Dotwork: "mandala",
    "Fine line": "botanical",
    Geometric: "geo",
    Japanese: "waves",
    Watercolour: "ink",
    Traditional: "flash",
    "Neo-traditional": "moons",
    Realism: "sphere",
    Ornamental: "sacred",
  };

  // Simple white product symbols, drawn the way system icons are.
  function glyph(c, w, h, variant) {
    const s = Math.min(w, h) / 100;
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(s, s);
    c.strokeStyle = "rgba(255,255,255,0.92)";
    c.lineWidth = 3.2;
    c.lineJoin = c.lineCap = "round";
    c.beginPath();
    if (variant === "bottle") {
      c.roundRect(-14, -12, 28, 40, 6);
      c.moveTo(-6, -12);
      c.lineTo(-6, -22);
      c.lineTo(6, -22);
      c.lineTo(6, -12);
      c.moveTo(-14, 4);
      c.lineTo(14, 4);
    } else if (variant === "box") {
      c.moveTo(0, -24);
      c.lineTo(24, -12);
      c.lineTo(24, 14);
      c.lineTo(0, 26);
      c.lineTo(-24, 14);
      c.lineTo(-24, -12);
      c.closePath();
      c.moveTo(-24, -12);
      c.lineTo(0, 0);
      c.lineTo(24, -12);
      c.moveTo(0, 0);
      c.lineTo(0, 26);
    } else if (variant === "pen") {
      c.rotate(-0.75);
      c.roundRect(-30, -7, 44, 14, 7);
      c.moveTo(14, -5);
      c.lineTo(28, 0);
      c.lineTo(14, 5);
    } else if (variant === "tub") {
      c.ellipse(0, -12, 22, 6, 0, 0, TAU);
      c.moveTo(-22, -12);
      c.lineTo(-19, 16);
      c.ellipse(0, 16, 19, 5, 0, Math.PI, 0, true);
      c.lineTo(22, -12);
    } else if (variant === "gloves") {
      c.moveTo(-16, 24);
      c.lineTo(-16, -2);
      for (let f = 0; f < 4; f++) {
        const x = -16 + f * 8;
        c.lineTo(x, -22 - (f === 1 || f === 2 ? 4 : 0));
        c.lineTo(x + 6, -22 - (f === 1 || f === 2 ? 4 : 0));
        c.lineTo(x + 6, -4);
      }
      c.lineTo(16, -4);
      c.lineTo(24, -12);
      c.lineTo(18, 24);
      c.closePath();
    } else {
      c.ellipse(-16, 0, 8, 20, 0, 0, TAU);
      c.moveTo(-16, -20);
      c.lineTo(22, -20);
      c.lineTo(22, 20);
      c.lineTo(-16, 20);
    }
    c.stroke();
    c.restore();
  }

  function tile(c, w, h, motif, seed, variant) {
    const R = rng(motif + ":" + seed);
    const [a, b, m] = TILE[motif] || TILE.botanical;
    const ang = R() * TAU;
    const g = c.createLinearGradient(w / 2 - Math.cos(ang) * w, h / 2 - Math.sin(ang) * h, w / 2 + Math.cos(ang) * w, h / 2 + Math.sin(ang) * h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = R() * w, y = R() * h, r = (0.35 + R() * 0.5) * Math.max(w, h);
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      const col = [m, b, a, "#ffffff"][i];
      rg.addColorStop(0, col + (i === 3 ? "59" : "cc"));
      rg.addColorStop(1, col + "00");
      c.fillStyle = rg;
      c.fillRect(0, 0, w, h);
    }
    if (motif === "product") glyph(c, w, h, variant);
  }

  // Real tattoo photography from Unsplash (free under the Unsplash License), grouped by the
  // sample artist whose style each photo fits. Seeds that name a piece map onto these files.
  const CREDITS = {
    "rory-1": ["Eduardo Vaccari", "https://unsplash.com/photos/grayscale-photo-of-floral-arm-tattoo-pIltvcnqsfU"],
    "rory-2": ["Steven Erixon", "https://unsplash.com/photos/black-floral-tattoo-SBrxqx8Vvhg"],
    "rory-3": ["Raspopova Marina", "https://unsplash.com/photos/woman-in-orange-button-up-shirt-with-black-floral-tattoo-on-her-back-Rfp27flla_I"],
    "rory-4": ["Paul Johnston", "https://unsplash.com/photos/selective-focus-photo-of-black-floral-arm-tattoo-iAKXY_fPt8E"],
    "rory-5": ["sammy swae", "https://unsplash.com/photos/minimalist-tattoo-of-two-figures-holding-hands-on-skin-3afL0VQrjvg"],
    "rory-6": ["Sincerely Media", "https://unsplash.com/photos/person-showing-arm-and-wrist-tattoo-CjHJbp3zInA"],
    "rory-7": ["Agathè Lov", "https://unsplash.com/photos/grayswash-arm-tattoo-JPl0GPNoeoM"],
    "kenji-1": ["Chu CHU", "https://unsplash.com/photos/man-with-elaborate-full-back-and-arm-tattoos-FhK6nTHdzJ4"],
    "kenji-2": ["Eva Greenberg", "https://unsplash.com/photos/close-up-of-a-colorful-dragon-tattoo-on-an-arm-LvivLeKw4zs"],
    "kenji-3": ["Matheus Ferrero", "https://unsplash.com/photos/mens-arm-tattoo-RBsrv4yV5KY"],
    "kenji-4": ["Chu CHU", "https://unsplash.com/photos/man-with-fully-tattooed-arms-against-black-background-kppyUThcnmE"],
    "sofia-1": ["Jake Heidecker", "https://unsplash.com/photos/black-and-white-floral-tattoo-KPPrUOr0RJo"],
    "sofia-2": ["George", "https://unsplash.com/photos/hand-holding-a-pink-and-white-rose-with-tattoo-OBd3llBGhiY"],
    "sofia-3": ["Julia Kadel", "https://unsplash.com/photos/black-and-white-floral-tattoo-on-persons-hand-F7ifiL1til0"],
    "sofia-4": ["Chris Hardy", "https://unsplash.com/photos/green-and-red-dragon-tattoo-on-persons-wrist-jmKHv-c1AFs"],
    "sofia-5": ["sammy swae", "https://unsplash.com/photos/arm-with-a-minimalist-tattoo-and-vibrant-red-nail-polish-3bk6bfnTNvE"],
    "hana-1": ["Matheus Frade", "https://unsplash.com/photos/black-and-red-flower-tattoo-on-right-human-hand-eyzdb1C3JDM"],
    "hana-2": ["Thamara Maura", "https://unsplash.com/photos/person-with-black-tattoo-on-wrist-jLHHWhwpB2s"],
    "hana-3": ["Matheus Frade", "https://unsplash.com/photos/black-tattoo-on-persons-left-hand-bWoig_hZxIU"],
    "hana-4": ["Haberdoedas", "https://unsplash.com/photos/tattoo-artist-working-on-intricate-design-3bvjRqZZBG4"],
    "theo-1": ["Stories & Ink Tattoo Care", "https://unsplash.com/photos/person-with-black-and-red-tattoo-on-right-leg-kZuIc5Jtmfc"],
    "theo-2": ["Nathalie Stimpfl", "https://unsplash.com/photos/woman-in-black-dress-with-red-rose-tattoo-on-her-left-hand-m0EDPy_qA34"],
    "theo-3": ["Khachik Simonian", "https://unsplash.com/photos/black-and-red-floral-tattoo-on-persons-hand-8ih9K9-R7qE"],
    "theo-4": ["Galih Jelih", "https://unsplash.com/photos/collection-of-intricate-drawings-displayed-on-a-wall-rCiO-B8mCQk"],
    "ines-1": ["Eugene Chystiakov", "https://unsplash.com/photos/person-wearing-full-body-tattoo-art-pMr5oZJmLpE"],
    "ines-2": ["Eugene Chystiakov", "https://unsplash.com/photos/black-backpiece-tattoo-w8fulqCkj8w"],
    "ines-3": ["Seyi Ariyo", "https://unsplash.com/photos/black-and-brown-tribal-tattoo-LEjVES-wIIc"],
    "callum-1": ["Aron Visuals", "https://unsplash.com/photos/grayscale-photo-of-skull-tattoo-MP61Mn7ejBk"],
    "callum-2": ["viklundvisuals", "https://unsplash.com/photos/mans-portrait-arm-tattoo-V9-FQmAsE8I"],
    "callum-3": ["Jacob Mejicanos", "https://unsplash.com/photos/man-in-orange-button-up-shirt-with-black-and-gray-arm-tattoo-FoSi0Qeb3Ac"],
  };
  const ARTIST_PHOTOS = { a1: "rory", a2: "kenji", a3: "sofia", a4: "hana", a5: "theo", a6: "ines", a7: "callum" };
  const photosOf = (artistId) => Object.keys(CREDITS).filter((k) => k.startsWith((ARTIST_PHOTOS[artistId] || "-") + "-"));
  // Sample projects, references and requests use the photo that fits their brief.
  const SEED_PHOTOS = {
    "mia-sleeve": "rory-1", "mia-ref-1": "rory-3", "mia-ref-2": "rory-2", "mia-ref-3": "rory-4",
    "oliver-geo": "hana-3", "oliver-ref-1": "ines-1", "priya-peony": "rory-6", "priya-ref-1": "sofia-3",
    "lena-moth": "ines-2", "lena-ref-1": "ines-2", "marcus-moons": "rory-5", "ava-snake": "theo-1", "ava-ref-1": "theo-1",
    "mia-koi": "kenji-2", "noah-hand": "theo-3", "elena-1": "kenji-1", "elena-2": "kenji-4", "jae-1": "rory-7", "tom-1": "ines-3",
  };
  function photoFor(seed) {
    const s = String(seed);
    if (CREDITS[s]) return s;
    if (SEED_PHOTOS[s]) return SEED_PHOTOS[s];
    let m = /^rory-(\d+)$/.exec(s);
    if (m) return photosOf("a1")[Number(m[1]) % photosOf("a1").length];
    m = /^(a\d)-(\d+|hero|card)$/.exec(s);
    // Sofia's first photo is mostly wall, so her Discover card leads with the rose.
    if (m && m[1] === "a3" && m[2] === "card") return "sofia-2";
    if (m && ARTIST_PHOTOS[m[1]]) {
      const list = photosOf(m[1]);
      return list[(Number(m[2]) || 0) % list.length];
    }
    return null;
  }

  const cache = new Map();
  const Art = {
    SKIES,
    STYLE_MOTIF,
    CREDITS,
    todaySky,
    skyVars,
    photoFor,
    photoCount: (artistId) => photosOf(artistId).length,
    credit(seed) {
      const k = photoFor(seed);
      return k ? { file: "img/" + k + ".jpg", by: CREDITS[k][0], page: CREDITS[k][1] } : null;
    },
    // Image URL for <img> use: a real photo where one fits, otherwise a soft colour field.
    url(motif, seed, w, h, variant) {
      if (motif !== "product") {
        const k = photoFor(seed);
        if (k) return "img/" + k + ".jpg";
      }
      const key = [motif, seed, w, h, variant].join("|");
      if (cache.has(key)) return cache.get(key);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cv = document.createElement("canvas");
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      tile(cv.getContext("2d"), cv.width, cv.height, motif, seed, variant);
      const u = cv.toDataURL("image/jpeg", 0.85);
      cache.set(key, u);
      return u;
    },
  };
  window.Art = Art;
})();
