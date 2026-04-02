const NAMESPACE = "urn:x-cast:com.poolej.ngaart";
const DEFAULT_ARTWORK = window.NGA_ARTWORKS[0];

let castReady = false;

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

function getAppId() {
  return document.getElementById("app-id").value.trim();
}

function getCurrentSession() {
  return cast.framework.CastContext.getInstance().getCurrentSession();
}

function configureCastContext() {
  const appId = getAppId();
  if (!appId || appId === "YOUR_APP_ID") {
    setStatus("Enter your real receiver App ID from the Google Cast Developer Console.");
    return false;
  }

  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: appId,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  return true;
}

function launchReceiver() {
  if (!castReady) {
    setStatus("Cast SDK is still loading.");
    return;
  }

  if (!configureCastContext()) {
    return;
  }

  cast.framework.CastContext.getInstance()
    .requestSession()
    .then(() => {
      setStatus("Receiver launched. You can now send artwork to the TV.");
    })
    .catch((error) => {
      setStatus(`Could not start the Cast session: ${error?.code || error}`);
    });
}

function sendArtwork() {
  const session = getCurrentSession();
  if (!session) {
    setStatus("Start a Cast session first.");
    return;
  }

  session
    .sendMessage(
      NAMESPACE,
      JSON.stringify({
        type: "SET_ARTWORK",
        artwork: DEFAULT_ARTWORK,
      })
    )
    .then(() => {
      setStatus(`Sent "${DEFAULT_ARTWORK.title}" to the receiver.`);
    })
    .catch((error) => {
      setStatus(`Could not send artwork: ${error?.code || error}`);
    });
}

window.__onGCastApiAvailable = function (isAvailable) {
  castReady = Boolean(isAvailable);
  setStatus(
    castReady
      ? "Cast SDK loaded. Enter your App ID and launch the receiver."
      : "Cast SDK failed to load."
  );
};

window.addEventListener("load", () => {
  document.getElementById("launch").addEventListener("click", launchReceiver);
  document.getElementById("send").addEventListener("click", sendArtwork);
});
