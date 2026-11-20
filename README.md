# Dusty Devils

A from-scratch JavaScript + HTML Canvas homage to late-80s single-screen off-road arcade racers. It's a learning experiment: original code, art and sounds, no ROMs or original assets.

**Play:** https://spindleweb-dev.github.io/dusty-devils/

## Controls
| Key | Action |
|---|---|
| ↑ / W | Accelerate |
| ↓ / S | Brake / reverse |
| ← → / A D | Steer |
| Space | Nitro burst |
| R | Reset truck |
| G | Classic (1×, 16-direction sprites) / Enhanced (4×) graphics |
| T | Handling tuning panel |
| Shift+D | Debug overlay |
| M | Sound on/off |

## Roadmap
1. ✅ One track and one truck with drift handling and a live tuning panel
   - ✅ 3D perspective view (three.js) from a fixed tilted camera, with camera sliders in the tuning panel
   - ✅ Nitro (Space) plus nitro-bottle and cash pickups
   - ✅ Tyre walls stacked 4 high, with sponsor banners on legs behind them (made-up sponsors). A catch fence was tried and switched off (`SHOW_FENCE`)
   - ✅ Team pit areas beside the grandstand (invented teams Voltroo Racing and Irongum Racing): motorhomes with awnings, gazebos, spare tyres, tool chests, fuel drums, parked team trucks and mechanics
   - ✅ Modern dashboard HUD in Enhanced mode (lap, lap timer with last/best/delta, speedo, rev bar, shift light, gear, cash, nitro cells); Classic mode keeps the retro HUD
   - ✅ Crowds: campers in chairs with hats, beers, eskies and umbrellas; flag-waving fans; corner marshals with yellow flags. They watch and cheer the truck.
2. Laps, checkpoints, finish order
3. Computer drivers
4. Hills, jumps, mud and water
5. Nitro and pickups
6. Shop and upgrades, more tracks, reverse tracks
7. Polish: CRT mode, particles, sound, 2 players

## Sounds
All sounds are synthesised in code, with no recordings.
- **Engine:** `tools/engine_synth.js` models a cross-plane V8 (firing order 1-8-4-3-6-5-7-2, uneven pulses per bank, deep exhaust-pipe resonances, dark muffler and saturation, plus a live low-shelf "Engine bass boost" slider). A subtle metallic "tin" layer (narrow 2.7–5.3 kHz resonances, slider "Exhaust tinniness") rings on each pulse. It is tuned as a big monster-truck engine: a 450 rpm big-cam idle with a "da-d … da-d" rhythm (a strong and a weaker firing per engine cycle, the rest pulled back), a deep ≈55 Hz exhaust, a ≈5,000 rpm red line, and an optional supercharger whine ("Supercharger whine" slider). It renders seamless loops at 450–5400 rpm, which the game blends and re-pitches to the current rpm. A pretend 4-speed gearbox (sound only) shifts up near 5,800 rpm with a short power cut and crackles, and shifts down with a throttle blip; the HUD shows the gear. Lifting off at high revs gives a few exhaust crackles.
- Hear it without the game: `node tools/render_engine_demo.mjs demo.wav` (or play `tools/engine_demo.mp3`).
- **Nitro:** a low thump plus a rising whoosh. Skids, wall thuds and pickup chimes are also synthesised.
