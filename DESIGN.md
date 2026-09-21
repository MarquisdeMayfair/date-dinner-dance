# Date · Dinner · Dance — design PRD

Updated 21 Sep 2026. This is the product source of truth for the night planner. Paperclip stays the Trademark Dashboard board and does not track this app.

## Aim

A person opens the link from Instagram, spins a day, and sends one line to someone: **Hey let's go.**

Commercial offers wait until the Instagram account is past **10,000 followers**. Until then the product is a gift. No email gate. No guestlist. No booking upsell on the first session.

The website stays. It is the product. An App Store app and an Instagram login are out of the short-term plan. A bio link opens inside Instagram’s browser, and an installed app does not run there.

## Scores

| Area | Was | Target | This release |
|---|---:|---:|---|
| Concept | 8.2 | 9.0 | One dare. The friend gets the city and spins their own day. |
| Mobile craft | 7.0 | 8.5 | After a spin, one coral button. Spin stays as a small second button. |
| Instagram | 4.4 | 8.5 | Safari gets the story file plus the line. Instagram’s browser gets the picture and a copied line. |
| Signup | 1.5 | 8.5 | Removed from the night on purpose. Returns after 10,000 followers. |
| Offers | 2.0 | 8.5 | None until 10,000 followers. The globe icon stays the venue’s own site. |
| Live data | 5.5 | 8.5 | Not this release. Photo and copy work below is what gets it there. |

## Short-term experience

1. City, three cards, **Spin**.
2. The reels land. The dock becomes a small **Spin** and a large **Hey let's go**.
3. One tap copies:

```
Hey let's go
Cala Comte · Yemanjá · Es Paradis
Your day → https://datedinnerdance.com/?c=ibiza
```

The link is the city, so the next person spins. The three names are the sender’s night.

4. On iPhone Safari, the same tap opens the share sheet with the 9:16 story. The story button says **Hey let's go**.
5. Inside Instagram, the same tap shows the story and the line “Copied. Hold the picture, add it to your story, then paste.”
6. No second menu. No email field. No “notify me”.

Facebook app `2325553588248802` stays on the page for link previews. It is not a login.

## Audiences, no email

The thing advertisers can buy is a Meta custom audience, not a mailing list.

Events for pixel `4558463687764760`:

- PageView on the planner.
- ViewContent with the city name, so Ibiza, London, Manchester, and New York are separate audiences.
- Spin.
- HeyLetsGo.

In Ads Manager, build a website audience from each event, then layer the country Meta already infers. The city on the event is the day they planned. The country is where they were.

Our own hit log stores the same city plus the country Vercel sees. It does not store an IP address or a name. That log is ours. The pixel is what makes the audience usable in Meta.

The base PageView snippet is in `index.html`. City, spin, and Hey let's go are sent from the planner on top of that.

## What we are not building now

- An iOS or Android app.
- Instagram or Facebook login, and posting through the Graph API.
- Reviews, comments, or city SEO pages.
- A mailing list. `/api/subscribe` can stay, unused, until 10,000 followers.

## After 10,000 followers

- One optional Instagram handle, after a share, skip allowed.
- Email only when a specific table or guestlist exists for the venue just spun.
- The offer sits on that venue’s globe icon as a tracked link. The first session stays a gift.

## Long-term site

Keep datedinnerdance.com as the public home.

- One indexable page per city, with the real venue names and the same planner.
- Reviews and comments only on venues that have been checked against the official site.
- No OpenStreetMap dump, no invented hooks.

## Data, to reach 8.5

Live main has 222 venues. 155 photos are remote landscape files. 23 Ibiza dinners are cut off with an ellipsis. New York has 10 venues a reel and some shared stock frames. 121 venues have no verification stamp.

Do not push the uncommitted Manchester file. It expands that city from 60 venues to 255 and adds OpenStreetMap-style hooks.

Each new or replaced photo:

- WebP, 720×900 (4:5), 40–120 KB, hard cap 150 KB.
- One place, subject in the centre. No collage, logo, or 16:9 banner.
- Path: `public/assets/opt/{date|dinner|dance}/{slug}/01.webp`
- Point `public/data/{city}.json` at that local file.
- Hook is two or three sentences from the official site, not cut with an ellipsis.
- About 20–24 venues per reel.

## Done when

- A cold open shows Spin and no share button.
- After the reels stop, **Hey let's go** is the coral button.
- That tap copies the three names and the city link.
- Instagram’s browser shows the story image instead of a dead share button.
- The email form is gone from the planner.
- `npm run build` passes.
