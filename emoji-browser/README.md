# Emoji Browser

This folder contains the GitHub Pages version of the emoji browser.

## Favorites and Preferences

Favorites and recent emoji are stored in the browser's local storage for this site.
That means:

- They stay available in the same browser profile on the same machine.
- They do not automatically sync to a different computer.
- They also do not automatically sync between different browsers on the same computer.

## Moving Favorites to Another Machine

1. Open the emoji browser.
2. Click `Export JSON`.
3. Your browser will usually save `emoji-browser-favorites.json` in your Downloads folder unless you changed your browser's default download location.
4. Move that file to the other machine however you like.
5. Open the emoji browser on the other machine.
6. Click `Import JSON` and choose the exported file.

## Sync Code Option

You can also use:

- `Copy Sync Code` to copy a small JSON string to your clipboard
- `Paste Sync Code` to import that string somewhere else

That can be easier if you want to paste the data into Notes, email, or another private place temporarily.

## Preferences Included

The app stores:

- favorites
- recently copied emoji
- preferred emoji size

Only favorites are included in the JSON export/import flow right now.
