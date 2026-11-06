# Demo models

| File | What | Author | Licence |
|---|---|---|---|
| `ethmumbai.glb` | Ethereum logo, used for the test spots | alex.yefremov, [Ethereum logo on Sketchfab](https://sketchfab.com/3d-models/ethereum-logo-53fa5c82850a4b33a366c14994320dcc) | [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/) |

Upload a model to a spot in the dashboard (`backend`, `npm start`), then set its scale and height offset there.

## Landmark models (generated)

Cartoon models of famous Indian landmarks, made for World3 by `models/generate/` (original work, no third-party assets; use them freely).
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
