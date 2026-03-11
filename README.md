# Commute · London

Live North London commute dashboard for Bounds Green / Bowes Park → Oxford Circus and back.

## Files

```
commute-dashboard.html   ← main app
config.js                ← API keys and settings
manifest.json            ← PWA manifest
sw.js                    ← service worker (offline support)
icons/
  icon-192.png
  icon-512.png
  apple-touch-icon.png
```

## Setup on GitHub Pages

1. Go to your repo: **github.com/neildoughty/sio-commute-app**
2. Upload all files above (maintaining the `icons/` folder structure)
3. Go to **Settings → Pages**
4. Under *Source*, select **Deploy from a branch**
5. Choose **main** branch, **/ (root)** folder → click **Save**
6. After ~60 seconds your app will be live at:
   **https://neildoughty.github.io/sio-commute-app/commute-dashboard.html**

## Installing on iPhone (Safari)

1. Open the URL above in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add** — done

The app will appear on her home screen with the tube icon, full screen with no browser chrome.

## API Keys (already configured in config.js)

- **TfL** — tube arrivals and line status
- **raildata.org.uk** — live Great Northern departures
- **football-data.org** — Arsenal and Spurs home fixture alerts

## Updating the app

Edit files locally and push to GitHub — Pages redeploys automatically within ~60 seconds.
