# اركض يا عبود! · Run, Abood!

لعبة جري في المتصفح: عبود بالكندورة والشماغ الأحمر يهرب من أبوه، وأبوه وراه بغترة معوجّة والنعال في يده. اركض على شاطئ جميرا، وفي وسط مدينة دبي، وجنب بحر الممزر، لين توصل سوق الشارقة القديم.

An endless runner for the browser. Abood, in his kandura and red shemagh, runs from Baba along the beach at Jumeirah, through Downtown Dubai, past the boats at Al Mamzar and into Sharjah Old Souq. Arabic is the default language. The flag buttons switch to English.

Progress is saved on the device: in-game dirhams (no real payments), a shop with boosters and a second-chance revive, a wardrobe with three characters and outfits, 16 badges with rewards, three daily missions, and a 7-day login gift.

## How to play

- **Jump:** tap the screen, or press Space / ↑ / W. Hold for a higher jump.
- **Flip (double jump):** tap again in the air.
- **Pause:** the II button, or P / Esc.
- **Items:** Vimto (faster), marbles (Baba slips), Mama's phone call (Baba stops), scooter (smash obstacles), magnet (pulls in sweets), sweets jar (+15).
- **Watch out:** when “!” appears over Baba, he throws his sandal along the ground. Jump it.

## Economy

- Buying every look, kandura and headwear costs **1,000,000 د.إ** in total. The five football kits cost 150,000 each on top (1,750,000 for everything).
- Football kits come in club-inspired colours (purple & white, yellow & black, red & black, blue & white, white & red) with no club names or badges. Each one makes Baba catch up 20% slower while worn.
- Daily missions are the main income: about 2,300–4,600 each, plus **3,000** for finishing all three in a day. With the 7-day login gift (300 → 2,500) that is roughly 14,000 a day, so the full wardrobe takes about 70 days of daily play.
- Runs pay only small change (about 1 per 40 m and 1 per 8 sweets). Badges pay 66,000 in total, once.
- The gold kandura is only unlocked by the 10,000 m badge. While Abood wears it, Baba catches up 40% slower.
- Difficulty keeps rising with distance: Baba closes in at 0.08/s at 1 km, 0.16/s at 3 km and 0.19/s from 3.75 km, top speed is reached at 2.75 km, and obstacles, holes and sandal throws get denser. Long runs are meant to need second chances.
- Boosters: Vimto 1,500 · magnet 1,200 · head start 2,500 · shield 2,000 · second chance 12,000. The first second chance in every run is free.
- All numbers live in `js/meta.js`.

## Ads hook

The game does not include any ad code. To show an ad after each run, define this before or after the game loads:

```js
window.aboodAfterRun = async ({ distance, sweets }) => {
  // show your ad here; the results card appears when this promise settles
};
```

If the hook is missing or throws, the results card shows straight away.

## Run it locally

Any static file server works. The service worker needs `http://localhost` or HTTPS, so opening the file directly is not enough.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish on GitHub Pages

1. Push this folder to the `main` branch of a GitHub repository.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` deploys every push to `main`. The game is then at `https://<user>.github.io/<repo>/`.

On each deploy, the workflow stamps the commit id into `sw.js`, `index.html` and `js/game.js`. That gives every release a new cache name and new asset URLs, so players get the update without clearing anything. Players who already have the game open see a "new version is ready" message on the menu.

## Phones and offline play

- **Offline:** after the first visit, the service worker (`sw.js`) caches everything: HTML, CSS, JS, fonts and icons. The game then loads instantly and works offline.
- **Install:** the game can be installed (Android: *Install app*; iPhone: *Share → Add to Home Screen*). It opens full screen in landscape.
- **Fast first load:** there are no external requests. The font is stored in the repository, and the whole game is about 400 KB.
- **Loading screen:** while it shows, the game loads the fonts, builds the sound effects and pre-renders the most-used character frames.
- **Phone settings:** touch input works anywhere on the screen. Zooming and long-press menus are turned off, the layout respects the notch and safe areas, the screen stays awake during a run, and the game pauses when you switch apps.

## Performance

- Characters and scenery are drawn in code, then baked into cached sprite frames and background tiles. After that, each frame mostly copies images.
- Phones start at a lower render resolution. If frames run slow for a few seconds, the game lowers its resolution further and switches off a few effects on its own.
- The page only writes to the HUD when a value changes. Particle counts are capped, and lights and dust use pre-rendered sprites.

## Project layout

```
index.html              page, loading screen, menus
css/style.css           layout, RTL, phone breakpoints, self-hosted font faces
js/game.js              the game: world, physics, drawing, caching, loader
js/i18n.js              Arabic and English text, language switch
js/meta.js              save data, dirhams, shop, wardrobe, badges, missions, login gift
js/vendor/zzfx.js       ZzFX sound synth (MIT)
assets/fonts/           Baloo Bhaijaan 2 (SIL OFL 1.1)
assets/icons/           app icons, generated from the game's own drawing of Abood
sw.js                   offline cache
manifest.webmanifest    install settings
.github/workflows/      GitHub Pages deploy
```

See [CREDITS.md](CREDITS.md) for third-party licences.
