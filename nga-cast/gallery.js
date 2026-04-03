const ROTATION_MS = 30000;
const CATALOG_URL = "./catalog.json";
const WIKIPEDIA_SEARCH_URL = "https://en.wikipedia.org/w/rest.php/v1/search/page";
const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const ARTIST_CACHE_KEY = "nga-cast-artist-summaries-v1";
const FAVORITES_KEY = "nga-cast-favorites-v1";
const TASTE_VECTORS_URL = "./taste_vectors.json";
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
let favoriteIds = loadFavoriteIds();
let tasteVectorsById = null;
let tasteRecommendations = [];
let surpriseRecommendations = [];

function loadFavoriteIds() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveFavoriteIds() {
  try {
    window.localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify([...favoriteIds])
    );
  } catch {
    // Ignore storage failures and keep in-memory favorites.
  }
}

function loadArtistSummaryCache() {
  try {
    const raw = window.localStorage.getItem(ARTIST_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function loadTasteVectors() {
  if (tasteVectorsById) {
    return tasteVectorsById;
  }

  const response = await fetch(TASTE_VECTORS_URL, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Could not load recommendation data: ${response.status}`);
  }

  const rows = await response.json();
  tasteVectorsById = new Map(rows.map((row) => [String(row.objectId), row]));
  return tasteVectorsById;
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

function hasSpecificArtistName(name) {
  const cleanedArtist = cleanArtistName(name);
  if (!cleanedArtist) {
    return false;
  }

  if (
    /(^| )(unknown|anonymous|unidentified)( |$)/i.test(cleanedArtist) ||
    /\bcentury\b/i.test(cleanedArtist) ||
    /\bschool\b/i.test(cleanedArtist) ||
    /\bworkshop\b/i.test(cleanedArtist) ||
    /\bcircle\b/i.test(cleanedArtist)
  ) {
    return false;
  }

  if (
    /^(american|french|italian|spanish|dutch|german|english|british|florentine|venetian|netherlandish)\b/i.test(
      cleanedArtist
    )
  ) {
    return false;
  }

  return true;
}

function clearDescriptionText() {
  const descriptionNode = document.getElementById("description");
  descriptionNode.textContent = "";
}

async function fetchArtistSummary(artist) {
  const cleanedArtist = cleanArtistName(artist);
  if (!cleanedArtist || !hasSpecificArtistName(cleanedArtist)) {
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
  const descriptionNode = document.getElementById("description");
  const resolvedText = text || summarizeDescription(artwork.description, artwork);
  descriptionNode.textContent = resolvedText;
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

  if (!hasSpecificArtistName(artwork.artist)) {
    clearDescriptionText();
    return;
  }

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
  updateFavoriteButton();
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

function cosineSimilarity(left, right) {
  if (!left || !right || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    const l = Number(left[i]) || 0;
    const r = Number(right[i]) || 0;
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function metadataBoost(candidate, favorites) {
  let boost = 0;
  for (const favorite of favorites) {
    if (candidate.medium && favorite.medium && candidate.medium === favorite.medium) {
      boost += 0.03;
    }
    if (
      candidate.orientation &&
      favorite.orientation &&
      candidate.orientation === favorite.orientation
    ) {
      boost += 0.02;
    }
    if (candidate.topEmotions && favorite.topEmotions) {
      const overlap = candidate.topEmotions.filter((emotion) =>
        favorite.topEmotions.includes(emotion)
      ).length;
      boost += Math.min(overlap, 2) * 0.01;
    }
  }
  return boost;
}

function averageSimilarity(candidate, favorites, key) {
  if (favorites.length === 0) {
    return 0;
  }

  let total = 0;
  for (const favorite of favorites) {
    total += cosineSimilarity(candidate[key], favorite[key]);
  }
  return total / favorites.length;
}

function buildForYouRecommendations() {
  if (!tasteVectorsById) {
    return [];
  }

  const favoriteVectors = [...favoriteIds]
    .map((id) => tasteVectorsById.get(String(id)))
    .filter(Boolean);

  if (favoriteVectors.length === 0) {
    return [];
  }

  const scored = [];
  for (const artwork of allArtworks) {
    if (artwork.classification !== "Painting") {
      continue;
    }

    const candidate = tasteVectorsById.get(String(artwork.objectId));
    if (!candidate) {
      continue;
    }

    let totalScore = 0;
    for (const favorite of favoriteVectors) {
      const clip = cosineSimilarity(candidate.clipImageVector, favorite.clipImageVector);
      const visual = cosineSimilarity(candidate.visualVector, favorite.visualVector);
      const emotion = cosineSimilarity(candidate.emotionVector, favorite.emotionVector);
      totalScore += (clip * 0.5) + (visual * 0.3) + (emotion * 0.15);
    }

    const averageScore = totalScore / favoriteVectors.length;
    const boost = metadataBoost(candidate, favoriteVectors);
    scored.push({ objectId: artwork.objectId, score: averageScore + boost });
  }

  scored.sort((left, right) => right.score - left.score);
  return scored.map((item) => item.objectId);
}

function rerankForDiversity(scoredItems, limit = 400) {
  const pool = [...scoredItems];
  const chosen = [];
  const seenArtists = new Map();
  const seenMediums = new Map();

  while (pool.length > 0 && chosen.length < limit) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < pool.length; index += 1) {
      const item = pool[index];
      const artistPenalty = (seenArtists.get(item.artist) || 0) * 0.16;
      const mediumPenalty = (seenMediums.get(item.medium) || 0) * 0.05;
      const adjustedScore = item.score - artistPenalty - mediumPenalty;
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIndex = index;
      }
    }

    const [picked] = pool.splice(bestIndex, 1);
    chosen.push(picked);
    seenArtists.set(picked.artist, (seenArtists.get(picked.artist) || 0) + 1);
    seenMediums.set(picked.medium, (seenMediums.get(picked.medium) || 0) + 1);
  }

  return chosen.map((item) => item.objectId);
}

function randomBetween(min, max) {
  return min + (Math.random() * (max - min));
}

function buildSurpriseRecommendations() {
  if (!tasteVectorsById) {
    return [];
  }

  const favoriteVectors = [...favoriteIds]
    .map((id) => tasteVectorsById.get(String(id)))
    .filter(Boolean);

  if (favoriteVectors.length === 0) {
    return [];
  }

  const favoriteArtists = new Set(
    allArtworks
      .filter((artwork) => favoriteIds.has(artwork.objectId))
      .map((artwork) => artwork.artist)
      .filter(Boolean)
  );

  const scored = [];
  for (const artwork of allArtworks) {
    if (artwork.classification !== "Painting") {
      continue;
    }

    const candidate = tasteVectorsById.get(String(artwork.objectId));
    if (!candidate) {
      continue;
    }

    const clip = averageSimilarity(candidate, favoriteVectors, "clipImageVector");
    const visual = averageSimilarity(candidate, favoriteVectors, "visualVector");
    const emotion = averageSimilarity(candidate, favoriteVectors, "emotionVector");
    const metadata = metadataBoost(candidate, favoriteVectors);

    const tasteMatch = (clip * 0.24) + (visual * 0.18) + (emotion * 0.14) + metadata;
    const adjacency =
      Math.max(0, 1 - Math.abs(clip - 0.8) / 0.17) * 0.22 +
      Math.max(0, 1 - Math.abs(visual - 0.78) / 0.18) * 0.12;
    const exactnessPenalty = clip > 0.92 ? (clip - 0.92) * 0.8 : 0;
    const notSameArtist = favoriteArtists.has(artwork.artist) ? -0.22 : 0.08;
    const novelty =
      (candidate.orientation === "portrait" ? 0.015 : 0) +
      (candidate.medium && favoriteVectors.some((fav) => fav.medium !== candidate.medium) ? 0.025 : 0) +
      notSameArtist +
      randomBetween(0, 0.035);

    scored.push({
      objectId: artwork.objectId,
      artist: artwork.artist || "",
      medium: artwork.medium || "",
      score: tasteMatch + adjacency + novelty - exactnessPenalty,
    });
  }

  scored.sort((left, right) => right.score - left.score);
  return rerankForDiversity(scored.slice(0, 900));
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
  document
    .getElementById("favorites-button")
    .classList.toggle("is-active", currentFilter === "favorites");
  document
    .getElementById("for-you-button")
    .classList.toggle("is-active", currentFilter === "for-you");
  document
    .getElementById("surprise-button")
    .classList.toggle("is-active", currentFilter === "surprise");
}

function updateFavoriteButton() {
  const button = document.getElementById("favorite-toggle");
  if (!button || !currentArtwork) {
    return;
  }

  const isFavorite = favoriteIds.has(currentArtwork.objectId);
  button.textContent = isFavorite ? "★" : "☆";
  button.classList.toggle("is-active", isFavorite);
  button.setAttribute(
    "aria-label",
    isFavorite ? "Remove from favorites" : "Add to favorites"
  );
}

function toggleFavorite() {
  if (!currentArtwork) {
    return;
  }

  if (favoriteIds.has(currentArtwork.objectId)) {
    favoriteIds.delete(currentArtwork.objectId);
  } else {
    favoriteIds.add(currentArtwork.objectId);
  }

  saveFavoriteIds();
  updateFavoriteButton();
  tasteRecommendations = [];
  surpriseRecommendations = [];

  if (currentFilter === "favorites") {
    applyFilter("favorites");
  } else if (currentFilter === "for-you") {
    applyFilter("for-you");
  } else if (currentFilter === "surprise") {
    applyFilter("surprise");
  } else {
    updateSearchCount();
  }
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
  const recommendedIds = new Set(tasteRecommendations);
  const surpriseIds = new Set(surpriseRecommendations);

  artworks = allArtworks.filter((artwork) => {
    if (currentFilter === "paintings" && artwork.classification !== "Painting") {
      return false;
    }

    if (currentFilter === "favorites" && !favoriteIds.has(artwork.objectId)) {
      return false;
    }

    if (currentFilter === "for-you" && !recommendedIds.has(artwork.objectId)) {
      return false;
    }

    if (currentFilter === "surprise" && !surpriseIds.has(artwork.objectId)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchableText = [
      artwork.artist,
      artwork.title,
      artwork.medium,
      artwork.classification,
      artwork.description,
      artwork.date,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });

  if (currentFilter === "for-you" || currentFilter === "surprise") {
    const ids = currentFilter === "for-you" ? tasteRecommendations : surpriseRecommendations;
    const order = new Map(ids.map((id, index) => [id, index]));
    artworks.sort((left, right) => order.get(left.objectId) - order.get(right.objectId));
  } else {
    artworks = shuffle(artworks);
  }
  currentIndex = 0;
  updateSearchCount();
}

async function applyFilter(filterName) {
  currentFilter = filterName;
  if (filterName === "for-you" || filterName === "surprise") {
    await loadTasteVectors();
    if (filterName === "for-you") {
      tasteRecommendations = buildForYouRecommendations();
    } else {
      surpriseRecommendations = buildSurpriseRecommendations();
    }
  }
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
    document.getElementById("favorites-button").addEventListener("click", () => {
      applyFilter("favorites");
    });
    document.getElementById("for-you-button").addEventListener("click", () => {
      applyFilter("for-you");
    });
    document.getElementById("surprise-button").addEventListener("click", () => {
      applyFilter("surprise");
    });
    document.getElementById("favorite-toggle").addEventListener("click", () => {
      toggleFavorite();
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
