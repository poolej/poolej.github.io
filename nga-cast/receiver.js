window.addEventListener("load", () => {
  const statusNode = document.getElementById("receiver-status");

  function setStatus(message) {
    if (statusNode) {
      statusNode.textContent = message;
    }
  }

  try {
    setStatus("Window loaded. Starting Cast receiver context.");
    const context = cast.framework.CastReceiverContext.getInstance();
    context.start();
    setStatus("Cast receiver context started.");
  } catch (error) {
    setStatus(`Receiver error: ${error?.message || error}`);
  }
});
