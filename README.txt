DAILY FIT — standalone streetwear wardrobe app (installable web app)

Everything runs on your phone. No account, no AI, no cost.
Network is used only for the free Open-Meteo weather forecast and city search.
Your closet, photos and history are stored on the phone (back up from Settings > Your data).

INSTALL ON ANDROID (one-time, about 5 minutes)
The app must be served over https once so Chrome can install it. Free option: GitHub Pages.
 1. Create a free account at github.com (skip if you have one).
 2. New repository > name it "dailyfit" > Public > Create.
 3. "uploading an existing file" > drag in ALL files from this zip > Commit.
 4. Settings > Pages > Source: "Deploy from a branch" > Branch: main, folder / (root) > Save.
 5. After about a minute your app is live at https://<your-username>.github.io/dailyfit/
 6. Open that link in Chrome on your phone > menu (three dots) > "Install app" (or "Add to Home screen").
It now opens from your home screen like any app and works offline (weather needs a connection).

UPDATING TREND DATA
Trends and stores live in data.js (compiled October 2026). Replace that file in your repository to update them.
