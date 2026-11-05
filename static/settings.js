const browseButton = document.querySelector("[data-browse-url]");

if (browseButton) {
  const rootInput = document.querySelector("#root");
  const status = document.querySelector("#browse-status");
  const buttonLabel = browseButton.textContent;

  browseButton.addEventListener("click", async () => {
    browseButton.disabled = true;
    status.textContent = "Opening folder picker...";

    try {
      const response = await fetch(browseButton.dataset.browseUrl, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The folder picker could not be opened.");
      if (result.path) {
        rootInput.value = result.path;
        status.textContent = "Folder selected. Save folder to apply it.";
      } else {
        status.textContent = "No folder selected.";
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      browseButton.disabled = false;
      browseButton.textContent = buttonLabel;
    }
  });
}