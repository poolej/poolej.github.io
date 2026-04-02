# NGA Cast on GitHub Pages

This folder is intended to be published at:

- `https://johnwpoole.com/nga-cast/`

Important URLs:

- Gallery page:
  `https://johnwpoole.com/nga-cast/`
- Cast launcher page:
  `https://johnwpoole.com/nga-cast/cast-launcher.html`
- Receiver page:
  `https://johnwpoole.com/nga-cast/receiver.html`

Google Cast setup:

1. Push this repo to GitHub Pages.
2. Confirm `receiver.html` loads publicly over HTTPS.
3. In the Google Cast Developer Console, create a Custom Receiver app using:
   `https://johnwpoole.com/nga-cast/receiver.html`
4. Copy the generated Cast App ID.
5. Open `cast-launcher.html`, paste the App ID, and launch the receiver from Chrome.

The sender and receiver communicate over:

- `urn:x-cast:com.poolej.ngaart`

Catalog generation:

- `build_nga_catalog.py` builds `catalog.json` from NGA's `objects.csv` and
  `published_images.csv`
- the gallery page fetches `catalog.json` and rotates through random paintings
  every 30 seconds
