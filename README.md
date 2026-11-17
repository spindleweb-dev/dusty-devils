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
2. Laps, checkpoints, finish order
3. Computer drivers
4. Hills, jumps, mud and water
5. Nitro and pickups
6. Shop and upgrades, more tracks, reverse tracks
7. Polish: CRT mode, particles, sound, 2 players

## Sounds
- Engine: a 1-second idle loop cut from "Big Block V8 Rev" (Freesound community, via Pixabay), pitched with speed.
- Nitro: trimmed "Nitro Activation" (Freesound community, via Pixabay).

If the recordings can't be decoded, the game falls back to synthesised engine and whoosh sounds.
