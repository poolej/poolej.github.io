const NAMESPACE = "urn:x-cast:com.poolej.ngaart";

window.addEventListener("load", () => {
  const artworkNode = document.querySelector(".receiver-artwork");
  const titleNode = document.querySelector(".receiver-title");
  const statusNode = document.getElementById("receiver-status");
  const creditNode = document.querySelector(".receiver-credit");

  function setStatus(message) {
    if (statusNode) {
      statusNode.textContent = message;
    }
  }

  function renderArtwork(artwork) {
    if (artworkNode && artwork.imageUrl) {
      artworkNode.src = artwork.imageUrl;
      artworkNode.alt = `${artwork.title || "Artwork"} by ${artwork.artist || "Unknown artist"}`;
    }
    if (titleNode) {
      titleNode.textContent = artwork.title || "Untitled";
    }
    if (statusNode) {
      statusNode.textContent = [artwork.artist, artwork.date].filter(Boolean).join(", ");
    }
    if (creditNode) {
      creditNode.textContent = artwork.credit || "National Gallery of Art";
    }
  }

  function parseMessageData(data) {
    if (!data) {
      return null;
    }

    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }

    return data;
  }

  try {
    setStatus("Henri Rousseau, 1910");
    const context = cast.framework.CastReceiverContext.getInstance();
    context.addCustomMessageListener(NAMESPACE, (event) => {
      const payload = parseMessageData(event.data);
      if (!payload || payload.type !== "SET_ARTWORK" || !payload.artwork) {
        setStatus("Received message, but could not use payload.");
        return;
      }

      renderArtwork(payload.artwork);
    });
    context.start();
  } catch (error) {
    setStatus(`Receiver error: ${error?.message || error}`);
  }
});
