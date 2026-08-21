# Tenana Rentals

Single-page site for **Tenana Rentals** — car, van and scooter hire on South Tarawa,
Kiribati. The centrepiece is a live booking calculator: pick dates, a vehicle, a
hand-over point and any extras, and the quote updates as you go, in AUD.

**Contact:** 7305305 · 73039089 · ruuka4climatechange@gmail.com

## What's here

| File | Purpose |
| --- | --- |
| `src/page.html` | The page itself — content, styles and script in one file, with no `<html>`/`<head>`/`<body>` wrapper. Edit this. |
| `build.sh` | Wraps `src/page.html` into a standalone `index.html`. |
| `index.html` | Generated. Open it in a browser or upload it anywhere static. Don't edit by hand. |

```sh
./build.sh          # rebuild index.html after editing src/page.html
```

No dependencies, no build tools, no server. The only external request is the
Google Fonts stylesheet; if it's blocked the page falls back to system fonts.

## Changing the rates

Everything the calculator prices lives in three arrays near the top of the
`<script>` block in `src/page.html`:

- `FLEET` — vehicles, daily rate, seats, bond, and which silhouette to draw
  (`ute`, `wagon`, `van`, `micro`, `sedan`, `scooter`).
- `LOCATIONS` — hand-over points and their fee (`0` means free delivery).
- `EXTRAS` — add-ons, priced either `per: "day"` or `per: "hire"`.
- `DISCOUNTS` — long-hire discounts, checked longest-first against the number of days.

Change a number there and both the fleet cards and the quote follow. Run
`./build.sh` afterwards.

> **The rates, bonds and fees in this repo are placeholders.** Replace them with
> Tenana's real prices before the site goes live. The same goes for the wording in
> the "The plain rules" section — driver age, bond handling and licence
> requirements should be checked against how the business actually operates and
> what Kiribati requires of visiting drivers.

## How the quote is worked out

1. Days = return date − pick-up date (minimum one; the form flags a return date
   that isn't after the pick-up).
2. Vehicle charge = daily rate × days.
3. The best matching long-hire discount comes off the vehicle charge.
4. Hand-over fees are added for pick-up and drop-off (airport $15, hotel/house $20).
5. Extras are added, per-day ones multiplied by the number of days.
6. The bond is shown separately — it's refundable, so it isn't in the total.

"Email this quote to us" builds a `mailto:` with the full breakdown in the body,
so an enquiry arrives already itemised. There's no server, so nothing is stored
or sent automatically.

## Design notes

Palette and marks come from the Kiribati flag and the lagoon — deep ocean teal,
frigatebird gold, flag red — with neutrals biased towards teal rather than plain
grey. Bricolage Grotesque sets the headings, Instrument Sans the body, IBM Plex
Mono the prices and dates. The hand-over points run west to east along the one
road, because on South Tarawa that ordering is real information.

The page follows the reader's theme: light, dark, or whatever the system is set
to. Every colour is a token defined in all three states.
