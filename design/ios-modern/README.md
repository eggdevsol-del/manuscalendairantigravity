# Tattoi: iOS Modern design prototype

A clickable, standalone prototype of the "iOS Modern" design direction for Tattoi. It covers all three roles (artist, client, supplier) and every flow in the app, using sample data. It doesn't touch or depend on the app code in this repo.

## Run it

Open `index.html` through any static server, for example:

```bash
cd design/ios-modern && python3 -m http.server 5187
```

Then visit http://localhost:5187 and pick a role. Changes are stored in the browser's local storage. Use "Reset sample data" under Settings, Accounts & roles to start over.

## Design

- **Lock screen theme.** The app sits on a lock-screen wallpaper, and every surface is a frosted iOS notification card. There are seven wallpapers (Midnight, Ocean, Sunset, Forest, Graphite, Rosé, Dawn), chosen under Settings, Wallpaper.
- **Landing page = the app at a glance.** A clock, ring widgets, the live sitting, then notification groups for Calendar, Needs you, Requests, Money, People, Offers and Supplies. Each group expands in place to about twice its height and scrolls on its own. At its edges the swipe hands off to the page, and only one group is open at a time. Settings live behind the avatar, top right.
- **Live displays.** Every section, setting and detail screen opens with a live preview of what it controls (lock-screen notifications, booking page phone, deposit split, plan bars, voucher, stock jars, order tracker and so on). Numbers are set with touch fill sliders.
- **Calendar.** An endless list of days in both directions. Each sitting is a photo card sized to its length. Any day with 2 or more free hours offers "Fill this day" or "Fill the gap": waitlist clients, unbooked next sittings, open requests (the day is saved and offered later in the booking wizard), a last-minute offer, or your booking page.
- **Kept favourites.** Request postcards, time-sized photo cards, the money river with 8 weeks ahead, and progress rings around clients.

## Files

| File | Purpose |
|---|---|
| `data.js` | Sample data and business rules, mirrored from this branch (fees, deposits, plans, waitlist, aftercare) |
| `views.js`, `sheets.js` | Base page and sheet renderers |
| `app.js` | Engine: navigation, sheets, actions, bindings |
| `stage.js` | The iOS Modern layer: landings, sections, live displays, sliders, calendar, wallpapers |
| `art.js`, `img/` | Free Unsplash tattoo photos used as sample work (credits in `art.js`) |
