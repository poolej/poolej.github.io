const NAMESPACE = "urn:x-cast:com.poolej.ngaart";
const DEFAULT_ARTWORK = {
  title: "Tropical Forest with Monkeys",
  artist: "Henri Rousseau",
  date: "1910",
  imageUrl:
    "https://api.nga.gov/iiif/95f1ff73-c4e9-45d4-ae3a-79837c4926d8/full/3840,/0/default.jpg",
  credit: "National Gallery of Art Open Data",
};

let castReady = false;

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

function setDebug(message) {
  document.getElementById("debug").textContent = message;
}

function getAppId() {
  return document.getElementById("app-id").value.trim();
}

function getCurrentSession() {
  return cast.framework.CastContext.getInstance().getCurrentSession();
}

function formatError(error) {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  const parts = [];
  if (error.code !== undefined) {
    parts.push(`code=${error.code}`);
  }
  if (error.description) {
    parts.push(error.description);
  }
  if (error.message) {
    parts.push(error.message);
  }

  return parts.join(" | ") || JSON.stringify(error);
}

function configureCastContext() {
  const appId = getAppId();
  if (!appId || appId === "YOUR_APP_ID") {
    setStatus("Enter your real receiver App ID from the Google Cast Developer Console.");
    setDebug("No receiver application ID configured.");
    return false;
  }

  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: appId,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  setDebug(`Configured receiverApplicationId=${appId}`);
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
      const session = getCurrentSession();
      setStatus("Receiver launched. You can now send artwork to the TV.");
      setDebug(
        session
          ? `Session started: ${session.getSessionObj()?.sessionId || "session active"}`
          : "Session requested, but no current session object was found."
      );
    })
    .catch((error) => {
      setStatus(`Could not start the Cast session.`);
      setDebug(`Launch failed: ${formatError(error)}`);
    });
}

function sendArtwork() {
  const session = getCurrentSession();
  if (!session) {
    setStatus("Start a Cast session first.");
    setDebug("No current Cast session is active.");
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
      setDebug("Custom message sent on urn:x-cast:com.poolej.ngaart");
    })
    .catch((error) => {
      setStatus("Could not send artwork.");
      setDebug(`Message failed: ${formatError(error)}`);
    });
}

window.__onGCastApiAvailable = function (isAvailable) {
  castReady = Boolean(isAvailable);
  setStatus(
    castReady
      ? "Cast SDK loaded. Enter your App ID and launch the receiver."
      : "Cast SDK failed to load."
  );
  setDebug(castReady ? "Cast SDK available." : "Cast SDK unavailable.");
};

window.addEventListener("load", () => {
  document.getElementById("launch").addEventListener("click", launchReceiver);
  document.getElementById("send").addEventListener("click", sendArtwork);
  cast.framework.CastContext.getInstance().addEventListener(
    cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
    (event) => {
      setDebug(
        `Session state: ${event.sessionState}${
          event.errorCode ? ` | error=${event.errorCode}` : ""
        }`
      );
    }
  );
});
