TERM++ Skin Lab (Static)

Contents:
- index.html                (skin lab wrapper)
- termpp_skin_lab.js        (browser-side XP injection logic)
- termpp-web/*              (legacy Asciicker webbuild bundle)
- termpp-web-flat/*         (flat-map webbuild variant + bootstrap + flatmaps/*.a3d)

Usage:
1. Host this directory on any static web server / GitHub Pages.
2. Open index.html.
3. Click "Open Webbuild".
   - Default path: ./termpp-web/index.html?solo=1&player=player
   - Flat arena path: ./termpp-web-flat/index.html?solo=1&player=player
4. Upload an .xp file and click "Apply Uploaded XP".

Notes:
- This swaps runtime sprite XP files in the browser Emscripten filesystem.
- Terrain/map comes from termpp-web/index.data.
- termpp-web-flat overrides /a3d/game_map_y8.a3d before StartGame using flatmaps/game_map_y8_original_game_map.a3d.
- You can choose another bundled test map via query param, e.g. &flatmap=minimal_1x1.a3d
- No backend is required for previewing an already-generated XP.
