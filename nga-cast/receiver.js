window.addEventListener("load", () => {
  const statusNode = document.getElementById("receiver-status");

  function setStatus(message) {
    if (statusNode) {
      statusNode.textContent = message;
    }
  }

  try {
    setStatus("Henri Rousseau, 1910");
    const context = cast.framework.CastReceiverContext.getInstance();
    context.start();
  } catch (error) {
    setStatus(`Receiver error: ${error?.message || error}`);
  }
});
