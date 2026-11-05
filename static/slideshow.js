const viewer = document.querySelector(".viewer-shell");

if (viewer) {
  const photos = JSON.parse(viewer.dataset.photos);
  const image = viewer.querySelector(".slide-image");
  const photoStage = viewer.querySelector(".photo-stage");
  const photoScrollContent = viewer.querySelector(".photo-scroll-content");
  const zoomLevelLabel = viewer.querySelector(".zoom-level");
  const zoomOutButton = viewer.querySelector('[data-zoom="out"]');
  const zoomInButton = viewer.querySelector('[data-zoom="in"]');
  const number = viewer.querySelector(".photo-number");
  const currentIndex = viewer.querySelector(".current-index");
  const status = viewer.querySelector(".status-text");
  const toggleButton = viewer.querySelector('[data-action="toggle"]');
  const previousButton = viewer.querySelector('[data-action="previous"]');
  const nextButton = viewer.querySelector('[data-action="next"]');
  const intervalSelect = viewer.querySelector("#slide-interval");
  const intervalControl = viewer.querySelector(".interval-control");
  const fullscreenButton = viewer.querySelector('[data-action="fullscreen"]');
  const photoFilmstrip = viewer.querySelector(".photo-filmstrip");
  const filmstripPhotos = [...viewer.querySelectorAll(".filmstrip-photo")];
  const albumDrawer = viewer.querySelector(".album-drawer");
  const albumDrawerToggle = viewer.querySelector(".album-drawer-toggle");
  const albumDrawerPanel = viewer.querySelector(".album-drawer-panel");
  const albumDrawerLock = viewer.querySelector(".album-drawer-lock");
  const preferenceKey = "eastAlbumViewer.viewer.preferences";
  const legacyPreferenceKey = "stillroom.viewer.preferences";
  const albumDrawerLockKey = "eastAlbumViewer.albumDrawerLocked";
  let preferences = {};
  let albumDrawerLocked = false;
  try {
    preferences = JSON.parse(localStorage.getItem(preferenceKey) || localStorage.getItem(legacyPreferenceKey) || "{}");
    albumDrawerLocked = localStorage.getItem(albumDrawerLockKey) === "true";
  } catch {
    preferences = {};
  }
  let index = 0;
  let playing = true;
  let timer;
  let intervalSeconds = Number(preferences.interval) || 5;
  let fitMode = preferences.fitMode === "cover" ? "cover" : "contain";
  let portraitPhoto = false;
  const maxZoomLevel = 3;
  const savedZoomLevel = Number(preferences.zoomLevel);
  let zoomLevel = Number.isFinite(savedZoomLevel) ? savedZoomLevel : maxZoomLevel;

  function updatePhotoLayout() {
    portraitPhoto = image.naturalHeight > image.naturalWidth;
    const zoomed = zoomLevel > 1 && image.naturalWidth && image.naturalHeight;
    photoStage.classList.toggle("zoomed", Boolean(zoomed));
    photoStage.classList.toggle("portrait-scroll", portraitPhoto && fitMode === "contain" && !zoomed);
    if (zoomed) {
      const containScale = Math.min(
        photoStage.clientWidth / image.naturalWidth,
        photoStage.clientHeight / image.naturalHeight,
      );
      const coverScale = Math.max(
        photoStage.clientWidth / image.naturalWidth,
        photoStage.clientHeight / image.naturalHeight,
      );
      const scale = (fitMode === "cover" ? coverScale : containScale) * zoomLevel;
      image.style.width = `${Math.round(image.naturalWidth * scale)}px`;
      image.style.height = `${Math.round(image.naturalHeight * scale)}px`;
    } else {
      image.style.removeProperty("width");
      image.style.removeProperty("height");
    }
  }

  image.addEventListener("load", updatePhotoLayout);
  image.addEventListener("error", () => {
    portraitPhoto = false;
    image.style.removeProperty("width");
    image.style.removeProperty("height");
    photoStage.classList.remove("zoomed");
    photoStage.classList.remove("portrait-scroll");
  });
  if (image.complete && image.naturalWidth) updatePhotoLayout();

  function setZoomLevel(level) {
    zoomLevel = Math.round(Math.max(1, Math.min(maxZoomLevel, level)) * 100) / 100;
    zoomLevelLabel.textContent = `${Math.round(zoomLevel * 100)}%`;
    zoomOutButton.disabled = zoomLevel === 1;
    zoomInButton.disabled = zoomLevel === maxZoomLevel;
    updatePhotoLayout();
    savePreferences();
  }

  zoomOutButton.addEventListener("click", () => setZoomLevel(zoomLevel - 0.25));
  zoomInButton.addEventListener("click", () => setZoomLevel(zoomLevel + 0.25));
  setZoomLevel(zoomLevel);
  window.addEventListener("resize", () => {
    if (zoomLevel > 1) updatePhotoLayout();
  });

  function setAlbumDrawerState(open, locked = albumDrawerLocked) {
    albumDrawerLocked = locked;
    albumDrawer.classList.toggle("open", open);
    albumDrawer.classList.toggle("locked", locked);
    albumDrawerPanel.inert = !open;
    albumDrawerPanel.setAttribute("aria-hidden", String(!open));
    albumDrawerToggle.setAttribute("aria-expanded", String(open));
    albumDrawerToggle.setAttribute("aria-label", open ? "Close album menu" : "Open album menu");
    albumDrawerLock.setAttribute("aria-pressed", String(locked));
    albumDrawerLock.setAttribute("aria-label", locked ? "Unlock album menu" : "Lock album menu open");
    albumDrawerLock.textContent = locked ? "Unlock" : "Lock";
  }

  setAlbumDrawerState(albumDrawerLocked, albumDrawerLocked);
  albumDrawerToggle.addEventListener("click", () => {
    const closing = albumDrawer.classList.contains("open");
    if (closing && albumDrawerLocked) {
      try {
        localStorage.setItem(albumDrawerLockKey, "false");
      } catch {
        // The menu still unlocks for this viewing session when storage is unavailable.
      }
      setAlbumDrawerState(false, false);
      return;
    }
    setAlbumDrawerState(!closing);
  });
  albumDrawerLock.addEventListener("click", () => {
    const locked = !albumDrawerLocked;
    try {
      localStorage.setItem(albumDrawerLockKey, String(locked));
    } catch {
      // The lock remains active for this viewing session when storage is unavailable.
    }
    setAlbumDrawerState(true, locked);
  });
  albumDrawer.addEventListener("pointerleave", () => {
    if (!albumDrawerLocked && !albumDrawer.contains(document.activeElement)) setAlbumDrawerState(false);
  });
  document.addEventListener("pointermove", event => {
    if (event.clientX <= 36 && !albumDrawerLocked) setAlbumDrawerState(true);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !albumDrawerLocked) setAlbumDrawerState(false);
  });

  if ([...intervalSelect.options].some(option => Number(option.value) === intervalSeconds)) {
    intervalSelect.value = String(intervalSeconds);
  } else {
    intervalSeconds = 5;
  }

  function savePreferences() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify({ interval: intervalSeconds, fitMode, zoomLevel }));
    } catch {
      // Preferences remain usable for this viewing session when storage is unavailable.
    }
  }

  function setFitMode(mode) {
    fitMode = mode === "cover" ? "cover" : "contain";
    viewer.classList.toggle("fit-cover", fitMode === "cover");
    viewer.classList.toggle("fit-contain", fitMode === "contain");
    updatePhotoLayout();
    viewer.querySelectorAll("[data-fit]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.fit === fitMode));
    });
    savePreferences();
  }

  function showPhoto(nextIndex) {
    index = (nextIndex + photos.length) % photos.length;
    photoScrollContent.scrollTop = 0;
    photoScrollContent.scrollLeft = 0;
    image.src = photos[index];
    image.alt = `Photo ${index + 1} of ${photos.length}`;
    number.textContent = String(index + 1).padStart(2, "0");
    currentIndex.textContent = String(index + 1);
    filmstripPhotos.forEach((photo, photoIndex) => {
      const active = photoIndex === index;
      photo.classList.toggle("active", active);
      photo.setAttribute("aria-pressed", String(active));
    });
    const activePhoto = filmstripPhotos[index];
    if (activePhoto) {
      const stripBounds = photoFilmstrip.getBoundingClientRect();
      const photoBounds = activePhoto.getBoundingClientRect();
      photoFilmstrip.scrollTo({
        left: photoFilmstrip.scrollLeft + photoBounds.left - stripBounds.left
          + photoBounds.width / 2 - photoFilmstrip.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }

  function startTimer() {
    clearInterval(timer);
    if (playing && photos.length > 1) timer = setInterval(() => showPhoto(index + 1), intervalSeconds * 1000);
  }

  function setPlaying(enabled) {
    playing = enabled;
    status.textContent = playing ? "Playing" : "Paused";
    toggleButton.textContent = playing ? "Ⅱ" : "▶";
    toggleButton.setAttribute("aria-label", playing ? "Pause slideshow" : "Resume slideshow");
    toggleButton.title = playing ? "Pause slideshow" : "Resume slideshow";
    startTimer();
  }

  previousButton.addEventListener("click", () => {
    showPhoto(index - 1);
    startTimer();
  });
  nextButton.addEventListener("click", () => {
    showPhoto(index + 1);
    startTimer();
  });
  toggleButton.addEventListener("click", () => setPlaying(!playing));
  photoFilmstrip.addEventListener("click", event => {
    const photoButton = event.target.closest("[data-photo-index]");
    if (!photoButton) return;
    showPhoto(Number(photoButton.dataset.photoIndex));
    setPlaying(false);
  });

  viewer.querySelectorAll("[data-fit]").forEach(button => {
    button.addEventListener("click", () => setFitMode(button.dataset.fit));
  });
  intervalSelect.addEventListener("change", () => {
    intervalSeconds = Number(intervalSelect.value);
    savePreferences();
    startTimer();
  });
  let intervalWheelRemainder = 0;
  intervalControl.addEventListener("wheel", event => {
    event.preventDefault();
    const deltaUnit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 40
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? intervalControl.clientHeight
        : 1;
    intervalWheelRemainder += event.deltaY * deltaUnit;
    const steps = Math.trunc(intervalWheelRemainder / 100);
    if (!steps) return;

    intervalWheelRemainder -= steps * 100;
    const nextIndex = Math.max(
      0,
      Math.min(intervalSelect.options.length - 1, intervalSelect.selectedIndex + steps),
    );
    if (nextIndex === intervalSelect.selectedIndex) {
      intervalWheelRemainder = 0;
      return;
    }

    intervalSelect.selectedIndex = nextIndex;
    intervalSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }, { passive: false });
  function setExpandedMode(enabled) {
    viewer.classList.toggle("expanded", enabled);
    document.body.classList.toggle("viewer-expanded", enabled);
    fullscreenButton.setAttribute("aria-label", enabled ? "Exit fullscreen" : "Enter fullscreen");
    fullscreenButton.title = enabled ? "Exit fullscreen" : "Enter fullscreen";
  }

  async function toggleFullscreen() {
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
  }

  fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("keydown", event => {
    const target = event.target;
    const editing = target instanceof HTMLElement && (
      target.isContentEditable || target.matches("input, textarea, select")
    );
    if (event.altKey || event.ctrlKey || event.metaKey || editing) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previousButton.click();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nextButton.click();
    } else if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      zoomInButton.click();
    } else if (event.key.toLowerCase() === "o") {
      event.preventDefault();
      zoomOutButton.click();
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFullscreen();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && viewer.classList.contains("expanded")) {
      setExpandedMode(false);
    }
  });

  setFitMode(fitMode);
  showPhoto(0);
  startTimer();
}