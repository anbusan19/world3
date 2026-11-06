# Demo models

| File | What | Author | Licence |
|---|---|---|---|
| `ethmumbai.glb` | Ethereum logo, used for the test spots | alex.yefremov, [Ethereum logo on Sketchfab](https://sketchfab.com/3d-models/ethereum-logo-53fa5c82850a4b33a366c14994320dcc) | [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/) |

Upload a model to a spot in the dashboard (`backend`, `npm start`), then set its scale and height offset there.

## Landmark models (generated)

Cartoon models of famous Indian landmarks, made for wrld3 by `models/generate/` (original work, no third-party assets; use them freely).
They are built from simple solids in the real buildings' proportions (storeys, minarets, domes, arches) in a flat pastel palette,
each scaled to 4 m tall, standing on y = 0 and centred. Rebuild with `cd models/generate && node build.mjs [slug...]`; look at them
with `python3 -m http.server 8099` in `models/` and open `preview.html?set=0`.

| File | Landmark |
|---|---|
| `taj-mahal.glb` | Taj Mahal, Agra |
| `india-gate.glb` | India Gate, Delhi |
| `qutub-minar.glb` | Qutub Minar, Delhi |
| `red-fort.glb` | Red Fort (Lahori Gate), Delhi |
| `charminar.glb` | Charminar, Hyderabad |
| `hawa-mahal.glb` | Hawa Mahal, Jaipur |
| `lotus-temple.glb` | Lotus Temple, Delhi (the roughest one) |
| `victoria-memorial.glb` | Victoria Memorial, Kolkata |
| `howrah-bridge.glb` | Howrah Bridge, Kolkata |
| `golden-temple.glb` | Golden Temple, Amritsar |
| `meenakshi-gopuram.glb` | Meenakshi Temple gopuram, Madurai |
| `brihadisvara-temple.glb` | Brihadisvara Temple, Thanjavur |
| `gol-gumbaz.glb` | Gol Gumbaz, Vijayapura |
| `sanchi-stupa.glb` | Great Stupa, Sanchi |
| `mahabodhi-temple.glb` | Mahabodhi Temple, Bodh Gaya |
| `mysore-palace.glb` | Mysore Palace |
| `konark-sun-temple.glb` | Konark Sun Temple |
| `khajuraho-temple.glb` | Kandariya Mahadeva Temple, Khajuraho |
| `gateway-of-india.glb` | Gateway of India, Mumbai |
| `csmt.glb` | Chhatrapati Shivaji Terminus, Mumbai |

## Sponsor anchor models (generated)

The same generator builds a 3D version of each workstation logo, 4 m tall, same flat palette (approximations of the marks, original work).

| File | Mark |
|---|---|
| `ens-logo.glb` | ENS diamond |
| `arkiv-logo.glb` | Arkiv |
| `world-logo.glb` | The World mark, traced from the real logo image (`ref/world.png`): `node generate/trace-logo.mjs ../ref/world.png world-logo.glb` |

## Sponsor coins (traced from the real logos)

Every sponsor logo is a coin standing on its edge, 4 m across, with the real mark raised on both faces (mirrored on the back so it reads
correctly). They are made from the logo pictures in `ref/`, not redrawn: `generate/split-colours.py` splits a logo into flat colour
layers, and `generate/trace-logo.mjs` traces each layer's outline, triangulates it and extrudes it.

| File | Logo |
|---|---|
| `world-logo.glb`, `ens-logo.glb`, `arkiv-logo.glb` | World, ENS, Arkiv (Arkiv is the bracketed A) |
| `0g-logo.glb` | 0G |
| `1inch-logo.glb` | 1inch |
| `ethereum-foundation-logo.glb` | Ethereum Foundation |
| `arc-logo.glb` | Arc |
| `chainlink-logo.glb` | Chainlink |
| `definitive-logo.glb` | Definitive |
| `hedera-logo.glb` | Hedera |
| `uniswap-logo.glb` | Uniswap |
| `whitechain-logo.glb` | WhiteChain |

Make another one:

```
python3 generate/split-colours.py ../ref/<logo>.png /tmp/<name> 3      # 3 = how many flat colours to keep
node generate/trace-logo.mjs --spec /tmp/<name>/spec.json <name>-logo.glb
```

For a single dark mark on a transparent background: `node generate/trace-logo.mjs <logo.png> <out.glb> [face] [mark] [rim]`.
Gradients become a few flat bands, and the Arkiv mascot picture (`ref/arkiv.png`) is a character, not a logo, so it has no coin.
