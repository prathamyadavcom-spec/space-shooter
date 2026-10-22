# 🚀 GALAXY SURVIVOR

A colorful, 3D-inspired space arcade game made with HTML, CSS, JavaScript, and Three.js.

## Features

- Three.js space arena with a cartoon-style spaceship
- Keyboard movement and mouse aiming
- Shooting, enemy projectiles, and collision detection
- Three enemy types with different movement and durability
- Health, score, wave progression, and eliminations
- Four collectible power-ups: Rapid Fire, Spread Shot, Shield, and Energy
- Five-wave campaign and endless mode
- Pause, resume, restart, and game-over / victory screens
- Procedural sound effects using the Web Audio API
- Saved best score with localStorage
- Touch movement joystick and fire button on touch devices

## Run locally

You need a modern browser and internet access for the Three.js CDN.

1. Put `index.html`, `style.css`, `game.js`, and `README.md` in the same folder.
2. Open a terminal in that folder.
3. Start a local server:

   ```bash
   python -m http.server 8000
   ```

4. Visit http://localhost:8000.

You can also use the Live Server extension in VS Code.

## Controls

| Action | Control |
|---|---|
| Move | WASD or arrow keys |
| Aim | Mouse |
| Fire | Left mouse button or Space |
| Pause / resume | P or Escape |
| Restart after game over | R |
| Toggle sound | M |
| Touch movement | On-screen joystick |
| Touch fire | On-screen FIRE button |

## Files

- `index.html` — menus, HUD, overlays, and canvas container
- `style.css` — responsive visual design
- `game.js` — 3D scene, input, combat, scoring, power-ups, and game states

## Deploy with GitHub Pages

1. Create a GitHub repository and upload the four files to its root.
2. Open **Settings → Pages**.
3. Under build and deployment, choose **Deploy from a branch**.
4. Select your `main` branch and `/ (root)`, then save.
5. Wait for deployment and open the published site.

## Notes

This is a client-side game; it does not need a backend or account registration. The Three.js library is loaded from a CDN, so the initial page needs an internet connection. Test the published game in your target browsers before sharing it.

## Possible future additions

- Boss battles and new enemy patterns
- More ships, skins, and weapons
- A music toggle with background music
- Achievements and more detailed statistics
- Further performance testing on low-end mobile devices
