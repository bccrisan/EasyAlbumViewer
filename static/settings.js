const settingsForm = document.querySelector(".settings-form");

if (settingsForm) {
  const rows = settingsForm.querySelector("#library-rows");
  const status = settingsForm.querySelector("#browse-status");

  function addLibraryRow(path = "") {
    const row = document.createElement("div");
    row.className = "library-row";

    const input = document.createElement("input");
    input.name = "libraries";
    input.type = "text";
    input.placeholder = "C:\\Users\\you\\Pictures";
    input.setAttribute("aria-label", "Library folder");
    input.value = path;

    const editButton = document.createElement("button");
    editButton.className = "button button-outline";
    editButton.type = "button";
    editButton.dataset.editLibrary = "";
    editButton.textContent = "Edit";

    const deleteButton = document.createElement("button");
    deleteButton.className = "button button-outline delete-library";
    deleteButton.type = "button";
    deleteButton.dataset.deleteLibrary = "";
    deleteButton.setAttribute("aria-label", "Delete library");
    deleteButton.textContent = "Delete";

    row.append(input, editButton, deleteButton);
    rows.append(row);
    input.focus();
  }

  settingsForm.addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.matches("[data-add-library]")) {
      addLibraryRow();
      status.textContent = "Choose a folder for the new library, then save your changes.";
      return;
    }

    if (button.matches("[data-delete-library]")) {
      button.closest(".library-row").remove();
      status.textContent = "Library removed. Save your changes to apply the removal.";
      return;
    }

    if (!button.matches("[data-edit-library]")) return;

    button.disabled = true;
    status.textContent = "Opening folder picker...";
    try {
      const response = await fetch(settingsForm.dataset.browseUrl, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The folder picker could not be opened.");
      if (result.path) {
        button.closest(".library-row").querySelector('input[name="libraries"]').value = result.path;
        status.textContent = "Folder selected. Save your changes to apply it.";
      } else {
        status.textContent = "No folder selected.";
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
