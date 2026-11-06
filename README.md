# اركض يا عبود! · Run, Abood!

لعبة جري في المتصفح: عبود بالكندورة والشماغ الأحمر يهرب من أبوه، وأبوه وراه بغترة معوجّة والنعال في يده. الطريق لفة حول دبي: من الممزر على البحر، بسوق ديرة على الخور، ووسط المدينة عند برج خليفة، وجميرا، ونفق الأسماك الزجاجي في نخلة جميرا، لين JBR وعين دبي (٣٠ كم). وبعدها داخل المدينة: إكسبو سيتي، وغولف الحبتور، وحديقة ند الشبا، وحديقة الخوانيج، وخور دبي هاربر (٣٠ كم ثانية)، وترجع للممزر من جديد.

An endless runner for the browser. Abood, in his kandura and red shemagh, runs from Baba right across Dubai, in the real order: from Al Mamzar, through the old Deira souq on the Creek, past Burj Khalifa in Downtown, along Jumeirah, through the glass aquarium tunnel on the Palm and on to JBR and Ain Dubai. Then the route turns inland, past Expo City, Al Habtoor golf, Nad Al Sheba and Al Khawaneej to Dubai Creek Harbour, and loops back to Al Mamzar. Arabic is the default language. The flag buttons switch to English.

Progress is saved on the device: in-game dirhams (no real payments), a shop with power-up upgrades and boosters, a wardrobe for Abood and his sister Mozah (unlocked by missions), 15 badges, the mission ladder plus three daily missions, postcards from 46 landmarks, and a 7-day login gift.

## How to play

- **Jump:** tap the screen, or press Space / ↑ / W. Hold for a higher jump.
- **Flip (double jump):** tap again in the air.
- **Pause:** the II button, or P / Esc.
- **Items:** Vimto (faster), marbles (Baba slips), Mama's phone call (Baba stops), scooter (smash obstacles), magnet (pulls in sweets), sweets jar (+15, times the combo).
- **Power-ups and boosters:** picking up a power-up while the same booster is running never shortens it.
- **Watch out:** when “!” appears over Baba, he throws his sandal along the ground. Jump it.

## The route

The route is a **60 km loop** in two legs of about 30 km each. The real distances are longer; the game squeezes them and keeps the parts roughly in proportion (positions are in `AREAS` and `STOPS` in `js/meta.js`). There is no finish line: after Dubai Creek Harbour, which is next to Deira, the loop starts again at Al Mamzar, and so on.

| Area | Starts at | Landmarks on the way |
|---|---|---|
| Al Mamzar | 0 km | Al Mamzar Beach Park, Etisalat Tower, Deira Clock Tower |
| Deira Creek Souq | 3 km | Spice Souk, Gold Souk, abra station, heritage antiques (chests, coffee pots, an old radio, lanterns), Mohammed bin Rashid Library, Dubai Frame |
| Downtown Dubai | 8 km | Museum of the Future (the steel torus with its Arabic calligraphy windows), Emirates Towers, The Dubai Mall, the Dubai Fountain, Burj Khalifa (three wings stepping up to the spire), Dubai Opera |
| Jumeirah | 14 km | Jumeirah Mosque, La Mer, Kite Beach, Burj Al Arab, Madinat Jumeirah |
| Palm Jumeirah | 20 km | Palm Monorail, Atlantis The Palm, the glass aquarium tunnel (600 m underwater, with fish, rays, sharks and turtles), Atlantis The Royal, water park slides |
| JBR | 25.5 km | The Walk, Ain Dubai, Dubai Marina |
| Expo City Dubai | 30 km | Al Wasl Plaza dome, Terra pavilion, Garden in the Sky, Surreal waterfall |
| Al Habtoor Golf | 36 km | The clubhouse, the island green, the polo field |
| Nad Al Sheba Park | 42 km | Nad Al Sheba Park, Meydan grandstand, the horse race |
| Al Khawaneej Garden | 48 km | Quranic Park, the Glass House, Cave of Miracles, Al Khawaneej farms with camels |
| Dubai Creek Harbour | 54 km | Ras Al Khor flamingos, Creek Harbour towers, Creek Beach, the view of Burj Khalifa; then back to Al Mamzar at 60 km |

- There is a landmark about every kilometre, so the view keeps changing. Tall landmarks stay on the skyline for a long time: Burj Khalifa is visible from the Creek to Jumeirah.
- The first time you pass a landmark you collect its **postcard** and dirhams (7 near Al Mamzar, rising to 123 at the end of the loop). On later laps the landmarks are just passed, without paying again.
- Every area you reach in a run becomes a **start point** in the menu, so you can carry on the journey next time. The menu shows all 11 areas as a strip of picture cards (drawn with the game's own scenery and each area's landmark) that you swipe, or drag with a mouse; each card shows where the area starts and how many of its postcards you have, and areas not reached yet are greyed with a lock. Scenery follows the route; difficulty, distance, sweets and missions count from the start of each run.
- All landmarks are drawn in code as simple illustrations.

## Wardrobe

The wardrobe opens with **who you play as**: Abood, or his sister **Mozah**. Mozah unlocks after finishing **10 missions** (daily or mission ladder; the wardrobe shows the progress) and a message says so at the end of that run. The sections below show only the chosen character's outfits, and each character keeps their own outfit when you switch. While Mozah plays, Baba's lines, titles and buttons switch to the feminine in Arabic, and to her name in English.

- **Free, Abood:** 4 kandura colours (white, cream, grey, winter brown), 2 swimsuits (rash guard and board shorts), red shemagh, white ghutra, swim cap.
- **Free, Mozah:** 3 jalabiya colours with gold embroidery (pink, purple, teal), 2 full-length swimsuits (pink, teal), bukhnag (black with gold), white shayla, swim cap.
- **Paid, Abood:** five football kits (Al Ain, Al Wasl, Shabab Al Ahli, Al Nasr, Sharjah), 1,500 each, each making Baba catch up 20% slower. They are drawn in club colours only, with no badges.
- **Paid, Mozah:** one modest sports set instead of the club kits (long top, long trousers, sports hijab and trainers), 1,500, with the same 20% perk.
- **Paid, both:** the lifeguard set, 2,500, starts every run with a shield (Mozah's is full length).
- **Badge only:** the gold kandura or gold jalabiya (10,000 m in one run) makes Baba catch up 40% slower.
- All of Mozah's outfits cover the arms and legs, and her swimwear is full length.
- Older saves: looks that were removed (glasses, extras, some colours and headwear) were all free, so nothing is refunded; anyone wearing one goes back to the default look.

## Economy

All numbers live in `js/meta.js`. The aim is roughly two months of daily play to buy everything.

- **Sweets exchange:** at the end of every run, sweets turn into dirhams with a counting animation: **10 sweets = 1 dirham**, plus **1 dirham per 250 m**, all times the mission multiplier. A 1.3 km run with 190 sweets pays 19 + 5 = 24 at ×1.
- **Mission ladder:** endless sets of three missions that get harder each level. When a set is done, the level goes up at the end of the run: the exchange multiplier rises by ×0.1 (up to ×3) and you get 40 + 20 × level dirhams. A stuck mission can be skipped for 25 + 10 × level dirhams.
- **Daily missions:** three a day from 11 kinds, 27–50 each, plus 50 for finishing all three. Missions finished but not claimed by midnight are paid automatically.
- **Postcards:** 7–123 for each landmark, once.
- **Power-up upgrades:** Vimto, magnet, scooter, Mama's call and marbles each have 5 levels (100, 250, 500, 1,000, 2,000). Each level makes that power-up last 15% longer, up to 75%.
- **Boosters:** Vimto 15 · magnet 12 · head start 25 · shield 20 · second chance 120. The first second chance in every run is free.
- **Login gift:** 3 → 25 over 7 days.
- **Difficulty** rises steadily (linearly) with the distance of the run, so the start is relaxed: Baba closes in at 0.046/s at 1 km, 0.078/s at 3 km, 0.11/s at 5 km and 0.14/s from about 7 km. Speed, obstacle pairs, hole widths and sandal throws grow gently up to 5–8 km. A hit costs 13% of the lead bar.
- **Focus streak:** every 20 s without a hit raises Focus by one level (max 3); each level makes Baba 10% slower. Close calls add 3 s; a hit resets it.

## Badges

Ten badges have three tiers each. Every tier needs 10x the previous goal and pays 10x the dirhams (bronze 10, silver 100, gold 1,000 د.إ):

| Badge | Bronze | Silver | Gold |
|---|---|---|---|
| Distance runner (total) | 10 km | 100 km | 1,000 km |
| Sweet tooth | 1,000 | 10,000 | 100,000 sweets |
| Close shave | 50 | 500 | 5,000 |
| Sandal dodger | 20 | 200 | 2,000 |
| Scooter smash | 20 | 200 | 2,000 |
| Regular | 10 | 100 | 1,000 runs |
| Explorer | 10 | 100 | 1,000 areas entered |
| Power collector | 50 | 500 | 5,000 |
| Comeback | 1 | 10 | 100 second chances |
| Loyal | 7 | 70 | 700 days in a row |

One-off badges: First run (5), Emirates runner, 10 km in one run (250 and the gold kandura), First buy (7), Postcard collector, every landmark (300), Round Dubai, run the whole 60 km loop back to Al Mamzar (500).

## Difficulty director

The game paces itself to each player (dynamic difficulty, in `director()` in `js/game.js`):

- It remembers the last 8 run distances and sets a target at 115% of their median (500 m for new players).
- **Enjoy zone** (below 85% of the target): Baba is 25% slower, power-ups are more frequent and sandals rarer.
- **Fair zone** (85–110%): normal.
- **Squeeze** (past 110%): Baba gets up to 80% faster by 160% of the target, with fewer power-ups and more sandals.
- **Focus** cancels most of the squeeze (Focus 3 removes 90% of it), so a sharp player can keep beating their best.
- **Mercy:** three hits within 30 seconds gives 10 seconds of relief.
- **Grace:** at the start of every run, and after a second chance, Baba does not close in for 2 seconds and then eases up to full speed over the next 3.

## Ads hook

The game does not include any ad code. To show an ad after each run, define this before or after the game loads:

```js
window.aboodAfterRun = async ({ distance, sweets }) => {
  // show your ad here; the results card appears when this promise settles
};
```

If the hook is missing or throws, the results card shows straight away. If it has not settled after 15 seconds, the card shows anyway.

## Run it locally

Any static file server works. The service worker needs `http://localhost` or HTTPS, so opening the file directly is not enough.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish on GitHub Pages

Every push to `main` runs `.github/workflows/pages.yml`, which stamps the build version and publishes the game to the `gh-pages` branch. The game is then at `https://<user>.github.io/<repo>/`.

If the site does not appear after the first deploy, open **Settings → Pages** and set **Source** to **Deploy from a branch**, branch **gh-pages**, folder **/ (root)**.

On each deploy the commit id is stamped into `sw.js`, `index.html` and `js/game.js`, so every release gets a new cache name and new asset URLs and players get the update without clearing anything. Players who have the game open see a "new version is ready" message on the menu.

## Phones and offline play

- **Offline:** after the first visit, the service worker (`sw.js`) caches everything: HTML, CSS, JS, fonts and icons. The game then loads instantly and works offline.
- **Install:** the game can be installed (Android: *Install app*; iPhone: *Share → Add to Home Screen*). It opens full screen in landscape.
- **Fast first load:** there are no external requests. The font is stored in the repository, and the whole game is about 500 KB to download (775 KB unpacked).
- **Loading screen:** while it shows, the game loads the fonts, builds the sound effects and pre-renders the most-used character frames.
- **Phone settings:** touch input works anywhere on the screen. Zooming and long-press menus are turned off, the layout respects the notch and safe areas, the screen stays awake during a run, and the game pauses when you switch apps.

## Performance

- Characters and scenery are drawn in code, then baked into cached sprite frames and background tiles. After that, each frame mostly copies images.
- Phones start at a lower render resolution. If frames run slow for a few seconds, the game lowers its resolution further and switches off a few effects on its own.
- The page only writes to the HUD when a value changes. Particle counts are capped, and lights and dust use pre-rendered sprites.
- The canvas checks its size every frame, so when the phone's toolbar slides in or out the picture is never shown stretched.
- Obstacles get a contact shadow and a bright top edge, and the street scenery behind them is slightly hazed, so they stand out from background props in every area.
- Street-level scenery and paving change area at the boundary line, each layer at its own parallax speed, instead of fading two areas into each other in place.

## Project layout

```
index.html              page, loading screen, menus
css/style.css           layout, RTL, phone breakpoints, self-hosted font faces
js/game.js              the game: world, physics, landmarks, drawing, caching, loader
js/i18n.js              Arabic and English text, language switch
js/meta.js              save data, the route, dirhams, shop, upgrades, wardrobe, badges, missions, login gift
js/vendor/zzfx.js       ZzFX sound synth (MIT)
assets/fonts/           Baloo Bhaijaan 2 (SIL OFL 1.1)
assets/icons/           app icons, generated from the game's own drawing of Abood
sw.js                   offline cache
manifest.webmanifest    install settings
.github/workflows/      GitHub Pages deploy
```

See [CREDITS.md](CREDITS.md) for third-party licences.
