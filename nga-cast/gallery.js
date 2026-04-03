const ROTATION_MS = 30000;
const CATALOG_URL = "./catalog.json";
const WIKIPEDIA_SEARCH_URL = "https://en.wikipedia.org/w/rest.php/v1/search/page";
const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const ARTIST_CACHE_KEY = "nga-cast-artist-summaries-v1";
let allArtworks = [];
let artworks = [];
let currentIndex = 0;
let rotationTimer = null;
let isPaused = false;
let currentFilter = "all";
let artistQuery = "";
let artistSummaryCache = loadArtistSummaryCache();
let descriptionRequestId = 0;
let currentArtwork = null;

function loadArtistSummaryCache() {
  try {
    const raw = window.localStorage.getItem(ARTIST_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveArtistSummaryCache() {
  try {
    window.localStorage.setItem(
      ARTIST_CACHE_KEY,
      JSON.stringify(artistSummaryCache)
    );
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

function summarizeDescription(text, artwork) {
  const trimmed = (text || "").trim();
  if (trimmed) {
    const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
      return sentences.slice(0, 2).join(" ").trim();
    }
    return trimmed;
  }

  return "";
}

function summarizeArtistExtract(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return "";
  }

  const sentence = trimmed.match(/[^.!?]+[.!?]+/);
  return sentence ? sentence[0].trim() : trimmed;
}

function cleanArtistName(name) {
  return (name || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(
      /^(Attributed to|Circle of|Workshop of|Follower of|After|Style of|Copy after|School of|Possibly|Probably)\s+/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchArtistSummary(artist) {
  const cleanedArtist = cleanArtistName(artist);
  if (!cleanedArtist) {
    return "";
  }

  if (artistSummaryCache[cleanedArtist] !== undefined) {
    return artistSummaryCache[cleanedArtist];
  }

  try {
    const searchResponse = await fetch(
      `${WIKIPEDIA_SEARCH_URL}?q=${encodeURIComponent(cleanedArtist)}&limit=1`,
      { cache: "force-cache" }
    );
    if (!searchResponse.ok) {
      artistSummaryCache[cleanedArtist] = "";
      saveArtistSummaryCache();
      return "";
    }

    const searchData = await searchResponse.json();
    const page = searchData?.pages?.[0];
    const title = page?.title;
    if (!title) {
      artistSummaryCache[cleanedArtist] = "";
      saveArtistSummaryCache();
      return "";
    }

    const summaryResponse = await fetch(
      `${WIKIPEDIA_SUMMARY_URL}/${encodeURIComponent(title)}`,
      { cache: "force-cache" }
    );
    if (!summaryResponse.ok) {
      artistSummaryCache[cleanedArtist] = "";
      saveArtistSummaryCache();
      return "";
    }

    const summaryData = await summaryResponse.json();
    const summary = summarizeArtistExtract(summaryData?.extract || "");
    artistSummaryCache[cleanedArtist] = summary;
    saveArtistSummaryCache();
    return summary;
  } catch {
    artistSummaryCache[cleanedArtist] = "";
    saveArtistSummaryCache();
    return "";
  }
}

function makeCaptionStyleArtistSummary(summary, artist) {
  const cleanedArtist = cleanArtistName(artist);
  if (!summary || !cleanedArtist) {
    return summary;
  }

  const escapedArtist = cleanedArtist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const leadingNamePattern = new RegExp(
    `^${escapedArtist}\\s+(was|is)\\s+`,
    "i"
  );

  if (leadingNamePattern.test(summary)) {
    summary = summary.replace(leadingNamePattern, "");
  }

  summary = summary.replace(/^(A|An|The)\s+/i, "");
  summary = summary.replace(/^\s*([a-z])/, (match, letter) => letter.toUpperCase());

  return summary;
}

function setDescriptionText(text, artwork) {
  document.getElementById("description").textContent =
    text || summarizeDescription(artwork.description, artwork);
}

function fitTitle() {
  const titleNode = document.getElementById("title");
  if (!titleNode) {
    return;
  }

  titleNode.style.fontSize = "";

  const maxTitleHeight = Math.min(window.innerHeight * 0.34, 280);
  let fontSize = parseFloat(window.getComputedStyle(titleNode).fontSize);
  const minFontSize = 18;

  while (titleNode.scrollHeight > maxTitleHeight && fontSize > minFontSize) {
    fontSize -= 1;
    titleNode.style.fontSize = `${fontSize}px`;
  }
}

async function renderDescription(artwork) {
  const requestId = ++descriptionRequestId;
  setDescriptionText("", artwork);

  const artistSummary = await fetchArtistSummary(artwork.artist);
  if (requestId !== descriptionRequestId) {
    return;
  }

  setDescriptionText(makeCaptionStyleArtistSummary(artistSummary, artwork.artist), artwork);
}

function renderArtwork(artwork) {
  currentArtwork = artwork;
  document.getElementById("artwork").src = artwork.imageUrl;
  document.getElementById("artwork").alt = `${artwork.title} by ${artwork.artist}`;
  document.getElementById("title").textContent = artwork.title;
  const artist = (artwork.artist || "").trim();
  const date = (artwork.date || "").trim();
  document.getElementById("meta").textContent = [artist, date].filter(Boolean).join(", ");
  document.getElementById("medium").textContent = (artwork.medium || "").trim();
  document.getElementById("credit").textContent =
    artwork.credit || "National Gallery of Art";
  fitTitle();
  renderDescription(artwork);
}

function showArtwork(index) {
  currentIndex = index % artworks.length;
  renderArtwork(artworks[currentIndex]);
}

function advanceArtwork() {
  if (artworks.length < 2) {
    return;
  }
  showArtwork((currentIndex + 1) % artworks.length);
}

function previousArtwork() {
  if (artworks.length < 2) {
    return;
  }
  showArtwork((currentIndex - 1 + artworks.length) % artworks.length);
}

function updatePauseButton() {
  const button = document.getElementById("pause-button");
  if (!button) {
    return;
  }

  button.innerHTML = isPaused ? "&#9654;" : "&#10074;&#10074;";
  button.setAttribute(
    "aria-label",
    isPaused ? "Resume slideshow" : "Pause slideshow"
  );
}

function restartTimer() {
  if (rotationTimer) {
    window.clearInterval(rotationTimer);
    rotationTimer = null;
  }

  if (!isPaused && artworks.length > 1) {
    rotationTimer = window.setInterval(advanceArtwork, ROTATION_MS);
  }
}

function togglePause() {
  isPaused = !isPaused;
  updatePauseButton();
  restartTimer();
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadCatalog() {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load catalog: ${response.status}`);
  }

  const catalog = await response.json();
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error("Catalog is empty.");
  }

  return shuffle(catalog);
}

function renderError(message) {
  document.getElementById("title").textContent = "Catalog unavailable";
  document.getElementById("meta").textContent = message;
  document.getElementById("medium").textContent = "";
  document.getElementById("credit").textContent = "National Gallery of Art";
  document.getElementById("description").textContent = "";
}

function updateFilterButtons() {
  document
    .getElementById("paintings-button")
    .classList.toggle("is-active", currentFilter === "paintings");
  document
    .getElementById("all-art-button")
    .classList.toggle("is-active", currentFilter === "all");
}

function updateSearchCount() {
  const countNode = document.getElementById("search-count");
  if (!countNode) {
    return;
  }

  const noun = artworks.length === 1 ? "result" : "results";
  countNode.textContent = `${artworks.length.toLocaleString()} ${noun}`;
}

function rebuildVisibleArtworks() {
  const normalizedQuery = artistQuery.trim().toLowerCase();

  artworks = allArtworks.filter((artwork) => {
    if (currentFilter === "paintings" && artwork.classification !== "Painting") {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (artwork.artist || "").toLowerCase().includes(normalizedQuery);
  });

  artworks = shuffle(artworks);
  currentIndex = 0;
  updateSearchCount();
}

function applyFilter(filterName) {
  currentFilter = filterName;
  updateFilterButtons();
  rebuildVisibleArtworks();

  if (artworks.length > 0) {
    showArtwork(0);
  } else {
    renderError("No artworks match the current filter.");
  }

  restartTimer();
}

function handleKeydown(event) {
  const searchInput = document.getElementById("artist-search");

  if (event.target === searchInput) {
    if (event.code === "Enter") {
      event.preventDefault();
      document.getElementById("pause-button").focus();
    }
    return;
  }

  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  if (
    (event.code === "Enter" || event.code === "Tab") &&
    document.activeElement === document.body
  ) {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  if (event.code === "ArrowRight") {
    event.preventDefault();
    advanceArtwork();
    restartTimer();
    return;
  }

  if (event.code === "ArrowLeft") {
    event.preventDefault();
    previousArtwork();
    restartTimer();
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
}

window.addEventListener("load", async () => {
  try {
    allArtworks = await loadCatalog();
    applyFilter("paintings");
    updatePauseButton();
    document.getElementById("prev-button").addEventListener("click", () => {
      previousArtwork();
      restartTimer();
    });
    document.getElementById("next-button").addEventListener("click", () => {
      advanceArtwork();
      restartTimer();
    });
    document.getElementById("pause-button").addEventListener("click", () => {
      togglePause();
    });
    document.getElementById("paintings-button").addEventListener("click", () => {
      applyFilter("paintings");
    });
    document.getElementById("all-art-button").addEventListener("click", () => {
      applyFilter("all");
    });
    document.getElementById("artist-search").addEventListener("input", (event) => {
      artistQuery = event.target.value;
      applyFilter(currentFilter);
    });
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", () => {
      if (currentArtwork) {
        fitTitle();
      }
    });
  } catch (error) {
    renderError(error.message);
  }
});
