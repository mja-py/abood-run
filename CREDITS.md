# Credits

## Game art

All characters, scenery, items and the app icon are drawn in code in `js/game.js`. There are no third-party images.

## Font

**Baloo Bhaijaan 2**, by the Baloo 2 Project Authors (Ek Type), licensed under the SIL Open Font License 1.1.
The files come from the `@fontsource/baloo-bhaijaan-2` package, version 5.3.0. The licence is in `assets/fonts/OFL.txt`.

## Sound

**ZzFX – Zuper Zmall Zound Zynth**, by Frank Force, MIT License. Source: https://github.com/KilledByAPixel/ZzFX
The file is from the `zzfx` package, version 1.4.0. The licence is in `js/vendor/zzfx.LICENSE.txt`.
The sound effects are generated at load time from ZzFX parameters. The music is a small Hijaz-scale melody with a maqsum darbuka beat, synthesised in `js/game.js`.

## Online races

**PeerJS**, by Michelle Bu, Eric Zhang and contributors, MIT License. Source: https://github.com/peers/peerjs
The file is `dist/peerjs.min.js` from the `peerjs` package, version 1.5.4. The licence is in `js/vendor/peerjs.LICENSE.txt`.
It is loaded only when a player opens "Race a friend", and connects through the free public PeerJS server (0.peerjs.com) and its TURN relay, with Cloudflare's public STUN server (stun.cloudflare.com).

**QR Code Generator for JavaScript**, by Kazuhiko Arase, MIT License. Source: https://github.com/kazuhikoarase/qrcode-generator
The file is `qrcode.js` from the `qrcode-generator` package, version 1.4.4. The licence is in `js/vendor/qrcode.LICENSE.txt`.
It draws the pairing codes for offline play and loads only when a player makes one. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
