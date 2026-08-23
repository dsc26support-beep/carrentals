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
| `status.json` | Which cars are free. **This is the file to edit day to day** — see below. |
| `build.sh` | Builds both outputs from `src/page.html`. |
| `index.html` | Generated. Asset tokens become relative paths; this is what GitHub Pages serves. Don't edit by hand. |
| `dist/artifact.html` | Generated and git-ignored. Asset tokens become base64 data URIs so the page is fully self-contained, for publishing as a Claude Artifact. |

```sh
./build.sh          # rebuild both outputs after editing src/page.html
```

No dependencies and no server. The only external request is the Google Fonts
stylesheet; if it's blocked the page falls back to system fonts.

## Marking a car as out (no developer needed)

Every car shows **Available** in green or its own out-of-service wording in red,
read from `status.json` when the page loads. To change one:

1. Open `status.json` on github.com — or in the GitHub mobile app — and tap the
   pencil to edit.
2. Change that car's word from `available` to `out`, or to your own wording:
   `"fit": "out until 3 September"` shows exactly that on the card.
3. Commit the change. The site updates for everyone within about a minute.

Only the word `available` (in any casing) shows the green badge. `out` shows
"Not available", and anything else is shown back word for word. The keys are the
`id` of each car in `FLEET`, so a new car needs a line here as well.

A car marked out can still be chosen and priced — the badge tells the customer,
and you sort the dates out when you reply.

The file is fetched with `cache: "no-store"` and a cache-busting timestamp, so a
returning visitor sees the change rather than a stale copy. On the Artifact build
there is no `status.json` to fetch, the request simply fails, and every car falls
back to Available.

## Adding or changing a car

Vehicles live in the `FLEET` array near the top of the `<script>` block in
`src/page.html`:

```js
{ id: "march", name: "Nissan March", plate: "KLTA 6113", rate: 60, art: "sedan",
  photos: [ { src: "{{ASSET:assets/march-front.jpg}}", alt: "…" }, … ],
  specs: [ "Automatic transmission", "5 passengers", … ],
  blurb: "…" }
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

Both the car specs and the General information topics are `<details>` elements
marked `data-drop`. `initDropdowns()` holds every one of them open from 1025px
up and closed below, re-syncing only when the viewport crosses that width, so a
panel a reader opened on a phone stays open when they rotate.
- `art` — the placeholder silhouette: `sedan`, `micro`, `van`, `wagon`, `ute` or
  `scooter`.

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
3. Hand-over fees are added for collection and return — Bonriki Airport $15,
   your hotel or house $20, everything Betio to Bikenibeu free.

No discount is ever applied, and no bond is taken. Damage and loss are settled
through the hire contract the customer and the company sign at hand-over, which
is stated both in the quote panel and under General information.

"Email this booking" builds a `mailto:` with the full breakdown in the body, so
an enquiry arrives already itemised. There's no server, so nothing is stored or
sent automatically.

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
