# Race simulator

A headless copy of the online sprint race (course generation, jumps, obstacles, holes, forks, luck boxes, the item button, marbles, sandstorm, slipstream) from `js/game.js`, with bot players of four skill levels (`pro`, `good`, `casual`, `kid`, plus `perfect` for checking that courses are clearable). Two bots race on the same seeded course and swap positions over a simulated network, like the real game. It is a test tool only and is not deployed.

```bash
node tools/race-sim/exp.mjs 1000 x '{"now":{}}' 'casual-casual,pro-casual,casual-kid' > /tmp/sim.json && node tools/race-sim/show.js /tmp/sim.json
```

Forks (bridge over an underpass) are simulated too: bots decide at each fork, taking the bridge more often when behind. `cfg.bridge` forces it (`1` always, `0` never), which is how to check with `perfect` bots that both roads can be cleared without a hit.

Items wait on the item button as in the game: `cfg.HOLD` is `'now'` (bots fire at once) or `'smart'` (bots keep marbles and sandstorms until the friend is coming up to a hazard). The sandstorm shortens how far ahead a bot can see for `STORM_T` seconds.

Side roads (the souq alley and the mall) are simulated on the zones that have them (1, 2, 5, 6, 10): bots decide at each gate, turning in more often when behind. `cfg.side` forces it (`1` always, `0` never); `SIDES: false` turns them off.

Columns: `betW` how often the first-named (better) player wins a round, `match` the same for best of 3, `margin` the average finish gap in seconds, `<1s%` races decided by under a second, `chg` lead changes per race, `cb15` / `cb30` how often the player 15 / 30 m behind at 400 m still wins, `mbHit%` marbles that land, `forks` forks per player per race, `bridge%` how often the bridge was chosen, `done%` how many of those bridges were completed, `st/r` sandstorms per race, `hurt/st` extra hits or falls per sandstorm received, `sides` side-road gates per player per race, `side%` how often bots turned in, `hits/side` hits taken per side road.

If you change race rules in `js/game.js`, change `DEFAULT_CFG` (or the copied code) here too, or the numbers stop meaning anything.
