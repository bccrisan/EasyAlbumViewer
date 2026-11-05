const viewer = document.querySelector(".viewer-shell");

if (viewer) {
  const photos = JSON.parse(viewer.dataset.photos);
  const image = viewer.querySelector(".slide-image");
  const number = viewer.querySelector(".photo-number");
  const currentIndex = viewer.querySelector(".current-index");
  const status = viewer.querySelector(".status-text");
  const toggleButton = viewer.querySelector('[data-action="toggle"]');
  const intervalSelect = viewer.querySelector("#slide-interval");
  const fullscreenButton = viewer.querySelector('[data-action="fullscreen"]');
  const preferenceKey = "eastAlbumViewer.viewer.preferences";
  const legacyPreferenceKey = "stillroom.viewer.preferences";
  let preferences = {};
  try {
    preferences = JSON.parse(localStorage.getItem(preferenceKey) || localStorage.getItem(legacyPreferenceKey) || "{}");
  } catch {
    preferences = {};
  }
  let index = 0;
  let playing = true;
  let timer;
  let intervalSeconds = Number(preferences.interval) || 5;
  let fitMode = preferences.fitMode === "cover" ? "cover" : "contain";

  if ([...intervalSelect.options].some(option => Number(option.value) === intervalSeconds)) {
    intervalSelect.value = String(intervalSeconds);
  } else {
    intervalSeconds = 5;
  }

  function savePreferences() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify({ interval: intervalSeconds, fitMode }));
    } catch {
      // Preferences remain usable for this viewing session when storage is unavailable.
    }
  }

  function setFitMode(mode) {
    fitMode = mode === "cover" ? "cover" : "contain";
    viewer.classList.toggle("fit-cover", fitMode === "cover");
    viewer.classList.toggle("fit-contain", fitMode === "contain");
    image.style.objectFit = fitMode;
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.display = "block";
    viewer.querySelectorAll("[data-fit]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.fit === fitMode));
    });
    savePreferences();
  }

  function showPhoto(nextIndex) {
    index = (nextIndex + photos.length) % photos.length;
    image.src = photos[index];
    image.alt = `Photo ${index + 1} of ${photos.length}`;
    number.textContent = String(index + 1).padStart(2, "0");
    currentIndex.textContent = String(index + 1);
  }

  function startTimer() {
    clearInterval(timer);
    if (playing && photos.length > 1) timer = setInterval(() => showPhoto(index + 1), intervalSeconds * 1000);
  }

  viewer.querySelector('[data-action="previous"]').addEventListener("click", () => {
    showPhoto(index - 1);
    startTimer();
  });
  viewer.querySelector('[data-action="next"]').addEventListener("click", () => {
    showPhoto(index + 1);
    startTimer();
  });
  toggleButton.addEventListener("click", () => {
    playing = !playing;
    status.textContent = playing ? "Playing" : "Paused";
    toggleButton.textContent = playing ? "Ⅱ" : "▶";
    toggleButton.setAttribute("aria-label", playing ? "Pause slideshow" : "Resume slideshow");
    toggleButton.title = playing ? "Pause slideshow" : "Resume slideshow";
    startTimer();
  });

  viewer.querySelectorAll("[data-fit]").forEach(button => {
    button.addEventListener("click", () => setFitMode(button.dataset.fit));
  });
  intervalSelect.addEventListener("change", () => {
    intervalSeconds = Number(intervalSelect.value);
    savePreferences();
    startTimer();
  });
  function setExpandedMode(enabled) {
    viewer.classList.toggle("expanded", enabled);
    document.body.classList.toggle("viewer-expanded", enabled);
    fullscreenButton.setAttribute("aria-label", enabled ? "Exit fullscreen" : "Enter fullscreen");
    fullscreenButton.title = enabled ? "Exit fullscreen" : "Enter fullscreen";
  }

  fullscreenButton.addEventListener("click", async () => {
    const expanded = viewer.classList.contains("expanded");
    if (expanded) {
      setExpandedMode(false);
      if (document.fullscreenElement === viewer) {
        try {
          await document.exitFullscreen();
        } catch {
          status.textContent = "Could not exit browser fullscreen";
        }
      }
    } else {
      setExpandedMode(true);
      try {
        await viewer.requestFullscreen();
      } catch {
        // The fixed-position expanded view remains available when native fullscreen is blocked.
      }
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && viewer.classList.contains("expanded")) {
      setExpandedMode(false);
    }
  });

  setFitMode(fitMode);
  startTimer();
}