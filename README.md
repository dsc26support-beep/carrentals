# Tenana Rentals

Single-page site for **Tenana Rentals** — car rental on South Tarawa, Kiribati.
Three cars, one price: $60 a day. The page opens with a four-second photo
showcase, lists each car with its own photo gallery and specs, and prices a
hire live as you pick dates, hand-over points and extras.

**Contact:** 73053005 · 73039089 · ruuka4climatechange@gmail.com

## What's here

| Path | Purpose |
| --- | --- |
| `src/page.html` | The page — content, styles and script in one file, with photos written as `{{ASSET:path}}` tokens. **Edit this.** |
| `assets/` | The car photos, resized to 1200px wide. |
| `build.sh` | Builds both outputs from `src/page.html`. |
| `index.html` | Generated. Asset tokens become relative paths; this is what GitHub Pages serves. Don't edit by hand. |
| `dist/artifact.html` | Generated and git-ignored. Asset tokens become base64 data URIs so the page is fully self-contained, for publishing as a Claude Artifact. |

```sh
./build.sh          # rebuild both outputs after editing src/page.html
```

No dependencies and no server. The only external request is the Google Fonts
stylesheet; if it's blocked the page falls back to system fonts.

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
  grey silhouette and a "Photos coming" tag instead.
- `specs` — free text. Each row's icon is chosen from its own wording
  (transmission, passengers, doors, air-conditioning, petrol, `$`, …), so the
  scooter-style rows work as well as the car ones. Below 1025px the list
  collapses behind a "Vehicle details" summary; from 1025px up the summary is
  hidden and `initSpecDrops()` holds every panel open.
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
