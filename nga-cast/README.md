# NGA Cast on GitHub Pages

This folder is intended to be published at:

- `https://johnwpoole.com/nga-cast/`

Important URLs:

- Sender page:
  `https://johnwpoole.com/nga-cast/sender.html`
- Receiver page:
  `https://johnwpoole.com/nga-cast/receiver.html`

Google Cast setup:

1. Push this repo to GitHub Pages.
2. Confirm `receiver.html` loads publicly over HTTPS.
3. In the Google Cast Developer Console, create a Custom Receiver app using:
   `https://johnwpoole.com/nga-cast/receiver.html`
4. Copy the generated Cast App ID.
5. Open `sender.html`, paste the App ID, and launch the receiver from Chrome.

The sender and receiver communicate over:

- `urn:x-cast:com.poolej.ngaart`
