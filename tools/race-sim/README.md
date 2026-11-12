# Race simulator

A headless copy of the online sprint race (course generation, jumps, obstacles, holes, luck boxes, marbles, slipstream) from `js/game.js`, with bot players of four skill levels (`pro`, `good`, `casual`, `kid`, plus `perfect` for checking that courses are clearable). Two bots race on the same seeded course and swap positions over a simulated network, like the real game. It is a test tool only and is not deployed.

```bash
node tools/race-sim/exp.mjs 1000 x '{"now":{}}' 'casual-casual,pro-casual,casual-kid' > /tmp/sim.json && node tools/race-sim/show.js /tmp/sim.json
```

Columns: `betW` how often the first-named (better) player wins a round, `match` the same for best of 3, `margin` the average finish gap in seconds, `<1s%` races decided by under a second, `chg` lead changes per race, `cb15` / `cb30` how often the player 15 / 30 m behind at 400 m still wins, `mbHit%` marbles that land.

If you change race rules in `js/game.js`, change `DEFAULT_CFG` (or the copied code) here too, or the numbers stop meaning anything.
