const NAMESPACE = "urn:x-cast:com.poolej.ngaart";
const FALLBACK_ARTWORK = {
  title: "NGA Art Cast",
  artist: "National Gallery of Art",
  date: "Open Access",
  imageUrl:
    "https://api.nga.gov/iiif/95f1ff73-c4e9-45d4-ae3a-79837c4926d8/full/3840,/0/default.jpg",
  credit: "National Gallery of Art Open Data",
};

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
