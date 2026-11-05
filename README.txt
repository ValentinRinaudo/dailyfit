DAILY FIT — streetwear wardrobe app (installable web app)

Live at https://valentinrinaudo.github.io/dailyfit/ (GitHub Pages).

Your closet, photos, history and ratings are saved online in your Daily Fit account (Supabase,
free tier), so they are there on any phone or computer you log in on. Every account can only read
and write its own data; the database rules are in supabase.sql. The phone also keeps a local copy
so the app opens offline.

Network use: your account, the free Open-Meteo forecast and city search, and an optional
one-time download of the on-device fashion AI (about 200 MB).

INSTALL ON ANDROID
Open the link above in Chrome > menu (three dots) > "Install app" (or "Add to Home screen").
Updates appear the next time you open the app while online.

HOW FITS ARE CHOSEN
The forecast's "feels like" temperature over your outing hours sets how many layers a fit needs
(25°+ one light layer; 13–18° a layer or light jacket; 6–12° a real jacket; ≤0° a heavy coat over a
layer). If the day swings by 7° or more, the fit includes a layer you can take off. You can shift
this with "You run warm/cold" in the You tab. Among the fits that suit the weather, the app learns
from what you wear, skip and rate.

TREND DATA
Trends and stores live in data.js; a weekly job (trends-job.mjs) publishes fresh trends to
data/trends.json, which the app reads when online.
