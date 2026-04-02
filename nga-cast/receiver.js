const NAMESPACE = "urn:x-cast:com.poolej.ngaart";
const FALLBACK_ARTWORK = window.NGA_ARTWORKS[0];

function renderArtwork(artwork) {
  const image = document.getElementById("artwork");
  const title = document.getElementById("title");
  const meta = document.getElementById("meta");
  const credit = document.getElementById("credit");

  image.src = artwork.imageUrl;
  image.alt = `${artwork.title} by ${artwork.artist}`;
  title.textContent = artwork.title;
  meta.textContent = `${artwork.artist}, ${artwork.date}`;
  credit.textContent = artwork.credit || "National Gallery of Art Open Data";
}

function parseMessage(event) {
  if (!event || !event.data) {
    return null;
  }

  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

window.addEventListener("load", () => {
  renderArtwork(FALLBACK_ARTWORK);

  const context = cast.framework.CastReceiverContext.getInstance();
  const options = new cast.framework.CastReceiverOptions();
  options.disableIdleTimeout = true;

  context.addCustomMessageListener(NAMESPACE, (event) => {
    const payload = parseMessage(event);
    if (!payload) {
      return;
    }

    if (payload.type === "SET_ARTWORK" && payload.artwork?.imageUrl) {
      renderArtwork(payload.artwork);
    }
  });

  context.start(options);
});
