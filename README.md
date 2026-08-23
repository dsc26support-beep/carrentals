# Tenana Rentals

Single-page site for **Tenana Rentals** — car rental on South Tarawa, Kiribati.
Six cars, one price: $60 a day. The photo showcase runs behind the page header,
each car is listed with its specs and, where we have them, its own photo
gallery, and a hire is priced live as you pick dates and hand-over points.

**Contact:** 73053005 · 73039089 · ruuka4climatechange@gmail.com

## What's here

| Path | Purpose |
| --- | --- |
| `src/page.html` | The page — content, styles and script in one file, with photos written as `{{ASSET:path}}` tokens. **Edit this.** |
| `assets/` | The car photos, resized to 1200px wide. |
| `bookings.json` | When each car is hired. Written by the back office; safe to edit by hand. |
| `admin.html` | The back office — the owner's calendar for marking cars out. |
| `build.sh` | Builds both outputs from `src/page.html`. |
| `index.html` | Generated. Asset tokens become relative paths; this is what GitHub Pages serves. Don't edit by hand. |
| `dist/artifact.html` | Generated and git-ignored. Asset tokens become base64 data URIs so the page is fully self-contained, for publishing as a Claude Artifact. |

```sh
./build.sh          # rebuild both outputs after editing src/page.html
```

No dependencies and no server. The only external request is the Google Fonts
stylesheet; if it's blocked the page falls back to system fonts.

## The back office

**https://dsc26support-beep.github.io/carrentals/admin.html**

Choose a car, tap the first day it goes out and the day it comes back, add a note
if you like, then press **Save to the website**. About a minute later the car's
badge on the public site reads "Out until 3 Sept", its hired days are shaded on
the customer's calendar, and anyone who picks those dates is told the car is
taken.

### Setting up the key, once

The page needs a GitHub token to save. Make it a **fine-grained personal access
token**, scoped as narrowly as it will go:

1. github.com → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. **Repository access:** Only select repositories → `carrentals`.
3. **Permissions:** Repository permissions → **Contents: Read and write**. Nothing else.
4. Set an expiry, then generate and copy the token.
5. Paste it into the back office and press **Save key and load bookings**. The
   phone remembers it from then on.

The back office page is public — GitHub Pages has no login — so the token is the
only thing protecting the site. It is stored in that browser's local storage,
never sent anywhere except api.github.com, and **Forget key** removes it. Don't
open the page on a shared device, and if a phone goes missing, revoke the token
on GitHub and make a new one.

### Editing bookings.json by hand

The file is plain JSON, so it can also be edited straight on github.com:

```json
"fit": [ { "from": "2026-09-01", "to": "2026-09-06", "note": "Teroro" } ]
```

`to` is the day the car comes back, so it is free again on that date — the same
span the quote charges for. A car is "out" when today falls inside one of its
periods; otherwise it reads Available. Anything unrecognised is ignored, and if
the file cannot be fetched at all — as on the Artifact build — every car simply
reads Available.

## Adding or changing a car

Vehicles live in the `FLEET` array near the top of the `<script>` block in
`src/page.html`:

```js
{ id: "march", name: "Nissan March", plate: "KLTA 6113", rate: 60, art: "sedan",
  photos: [ { src: "{{ASSET:assets/march-front.jpg}}", alt: "…" }, … ],
  specs: [ "Automatic transmission", "5 passengers", … ] }
```

- `photos` — any number. Two gives the gallery its arrows; an empty list shows a
  grey silhouette and a "Photos coming" tag instead. Four of the six cars are in
  that state today.
- `plate` — shown as a tag over the photo. An empty string omits the tag, which
  is how the cars whose KLTA numbers we don't have yet are listed.
- `specs` — free text. Each row's icon is chosen from its own wording
  (transmission, passengers, doors, air-conditioning, petrol, `$`, `model`,
  a colour, …), so the scooter-style rows work as well as the car ones. Below
  1025px the list collapses behind a "Vehicle details" summary.

Four things collapse on phones and tablets, all of them `<details>` elements
marked `data-drop`: each car's specs, each General information topic, and the
General information and Contact us sections as a whole. `initDropdowns()` holds
every one of them open from 1025px up and closed below, re-syncing only when the
viewport crosses that width, so a panel a reader opened on a phone stays open
when they rotate. The section-level ones nest — opening General information
reveals four topics that each open in turn.
- `art` — the placeholder silhouette: `sedan`, `micro`, `van`, `wagon`, `ute` or
  `scooter`.
- Cars carry no description text.
- The cars sit in a horizontal carousel, one per view: a native scroll-snap track
  that a phone swipes, with arrows, dots and an "n of 6" counter under it. The
  active dot is read back off `scrollLeft` when scrolling settles, so a swipe, an
  arrow and a dot can never disagree about which car is showing.

Drop new photos in `assets/`, add them to `photos`, and run `./build.sh`.
Keep them around 1200px wide — they're embedded in the artifact build, so
oversized files bloat it.

`LOCATIONS` sits alongside `FLEET` and drives the hand-over fees. There are no
discounts: the rate is the same for every day of every hire, however long.

> **Some details still need confirming:** the transmission, fuel and capacity
> rows are reasonable assumptions from the photos, not verified specifications.
> The "General information" wording — driver age and what a visiting driver
> needs to drive here — should be checked against how the business actually
> operates.

## How the price is worked out

1. Days = return date − collection date (minimum one; the form flags a return
   date that isn't after the collection date).
2. Vehicle charge = daily rate × days.
3. Hand-over fees are added for collection and return. There are two choices:
   the Bikenibeu yard, free, and "We meet you" — the airport, a hotel or a
   house, anywhere on South Tarawa — at $20. Each leg is charged separately, so
   meeting you both ways is $40. A free choice is labelled "(free)" in the
   dropdown rather than left bare, so it reads as free rather than as unpriced.
   The quote and the emailed booking join the date and the point with a dash
   ("Collection: 24 Aug 2026 — We meet you") because the label is a verb phrase,
   not a place name.

No discount is ever applied, and no bond is taken. Damage and loss are settled
through the hire contract the customer and the company sign at hand-over, which
is stated both in the quote panel and under General information.

"Email this booking" builds a `mailto:` with the full breakdown in the body, so
an enquiry arrives already itemised. There's no server, so nothing is stored or
sent automatically.

## The "not confirmed yet" popup

Once a visitor settles on a pair of dates, a dialog says **E tuai matoa am
Booking** — Reitaki NGKAI ibukin kamatoana… — over shortcuts to Call, WhatsApp
and Messenger. It is raised only from an action the visitor took, never from
page state (both date fields hold a default range on load), and only once per
visit so adjusting dates afterwards does not nag. It is a native `<dialog>`, so
Escape and focus handling come from the browser; a tap on the dark surround
closes it too.

### Three finishes

The popup ships in three looks and a device rotates through them across visits
— **1 → 2 → 3 → 1**, remembering the last one it showed in `localStorage`
(`tenana.pop`). Where storage is walled off (private browsing, cookies blocked)
it picks one at random instead.

| # | Finish | What makes it |
|---|--------|---------------|
| 1 | Frosted glass | `backdrop-filter` blur behind a card held at ~90% white — glassy, but the heading stays readable in direct sun — with a magenta glow under the bottom corners and circular glass discs behind the logos. |
| 2 | Raised card | Solid white, a magenta crown across the top, three stacked shadows at increasing blur for real elevation, and badges that float above tiles that float above the card. Tiles press down 2px. |
| 3 | Tilted card | Opens on a `perspective` rotation and keeps a shallow tilt at rest; the heading and shortcuts sit on a nearer Z plane (`translateZ`) so they are genuinely in front of the surface. A sheen sweeps across once as it lands. |

**To look at one on demand**, add `?pop=1`, `?pop=2` or `?pop=3` to the address:

    https://dsc26support-beep.github.io/carrentals/?pop=2

That pins the finish and opens the popup straight away, without touching the
rotation. Customers never arrive with it on the URL.

Each finish is one CSS block (`.pop-1` / `.pop-2` / `.pop-3`); everything they
share sits in the `.pop` block above them. To retire one, drop its block and set
`POP_STYLES` in the script to the number left. Note that `.pop-3` must not get
`overflow: hidden` — that would flatten `preserve-3d` and kill the depth — and
the open animations fill `backwards`, never `forwards`, or the finished
animation would outrank the `:active` press styles.

## The four-second showcase

The block above the listing is a CSS animation, not a video file: four slides of
one second each, crossfading, with a slow zoom on every photo and a progress bar
across the bottom. It loops, needs no plugin or codec, and plays on any phone.
Under `prefers-reduced-motion` it holds still on the first photo.

To change it, edit the `.sc-slide` figures in the markup and the `sc-fade` /
`sc-zoom` / `sc-bar` keyframes. All three run on the same 4s cycle, with each
slide offset by `--i` seconds — keep them in step if you change the length.

## Design notes

White catalogue layout with a magenta accent, following the reference the owner
supplied: utility strip, brand bar, sticky uppercase tab nav, and each car as an
image-left / spec-panel-right row. Barlow sets the text, Barlow Semi Condensed
the headings. Single-theme by intent, with every colour painted explicitly so
the page holds on any background.
