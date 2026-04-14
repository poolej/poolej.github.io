const dataset = window.EMOJI_DATASET;

if (!dataset || !Array.isArray(dataset.emoji)) {
  throw new Error("Emoji dataset did not load.");
}

const STORAGE_KEYS = {
  favorites: "emoji-browser-favorites",
  recent: "emoji-browser-recent",
  size: "emoji-browser-size"
};

const DEFAULT_EMOJI_SIZE = 120;
const EMOJI_FALLBACK_BASE_URL = "https://fonts.gstatic.com/s/e/notoemoji/latest";
const glyphSupportCache = new Map();
const glyphSignatureCache = new Map();
let glyphCanvas;
let glyphContext;
const FORCED_FALLBACK_IDS = new Set([
  "fight-cloud"
]);

const state = {
  search: "",
  group: "All",
  favoritesOnly: false,
  favorites: loadList(STORAGE_KEYS.favorites),
  recent: loadList(STORAGE_KEYS.recent),
  size: Number(localStorage.getItem(STORAGE_KEYS.size) || DEFAULT_EMOJI_SIZE)
};

const elements = {
  searchInput: document.getElementById("search-input"),
  groupSelect: document.getElementById("group-select"),
  sizeSlider: document.getElementById("size-slider"),
  favoritesOnly: document.getElementById("favorites-only"),
  emojiGrid: document.getElementById("emoji-grid"),
  favoritesGrid: document.getElementById("favorites-grid"),
  recentGrid: document.getElementById("recent-grid"),
  resultsMeta: document.getElementById("results-meta"),
  activeSubgroup: document.getElementById("active-subgroup"),
  emojiCount: document.getElementById("emoji-count"),
  favoriteCount: document.getElementById("favorite-count"),
  unicodeVersion: document.getElementById("unicode-version"),
  exportJson: document.getElementById("export-json"),
  importJson: document.getElementById("import-json"),
  copySyncCode: document.getElementById("copy-sync-code"),
  pasteSyncCode: document.getElementById("paste-sync-code"),
  clearFavorites: document.getElementById("clear-favorites"),
  clearRecent: document.getElementById("clear-recent"),
  toast: document.getElementById("toast")
};

initialize();

function initialize() {
  elements.sizeSlider.value = state.size;
  elements.emojiCount.textContent = String(dataset.count);
  elements.unicodeVersion.textContent = dataset.version;

  document.documentElement.style.setProperty("--emoji-size", `${state.size}px`);

  populateGroups();

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  elements.groupSelect.addEventListener("change", (event) => {
    state.group = event.target.value;
    render();
  });

  elements.sizeSlider.addEventListener("input", (event) => {
    state.size = Number(event.target.value);
    localStorage.setItem(STORAGE_KEYS.size, String(state.size));
    document.documentElement.style.setProperty("--emoji-size", `${state.size}px`);
  });

  elements.favoritesOnly.addEventListener("change", (event) => {
    state.favoritesOnly = event.target.checked;
    render();
  });

  elements.exportJson.addEventListener("click", exportFavoritesJson);
  elements.importJson.addEventListener("change", importFavoritesJson);
  elements.copySyncCode.addEventListener("click", copySyncCode);
  elements.pasteSyncCode.addEventListener("click", pasteSyncCode);

  elements.clearFavorites.addEventListener("click", () => {
    state.favorites = [];
    saveList(STORAGE_KEYS.favorites, state.favorites);
    render();
  });

  elements.clearRecent.addEventListener("click", () => {
    state.recent = [];
    saveList(STORAGE_KEYS.recent, state.recent);
    renderMiniGrid(elements.recentGrid, state.recent, "Copy an emoji and it will appear here.");
  });

  render();
}

function populateGroups() {
  const groups = ["All", ...dataset.groups];
  const fragment = document.createDocumentFragment();
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    fragment.appendChild(option);
  });
  elements.groupSelect.innerHTML = "";
  elements.groupSelect.appendChild(fragment);
}

function render() {
  const filtered = filterEmoji();
  const subgroupSet = new Set(filtered.map((emoji) => emoji.subgroup));

  elements.favoriteCount.textContent = String(state.favorites.length);
  elements.resultsMeta.textContent = `${filtered.length.toLocaleString()} result${filtered.length === 1 ? "" : "s"}`;
  elements.activeSubgroup.textContent =
    subgroupSet.size === 1 ? Array.from(subgroupSet)[0] : `${subgroupSet.size} subgroups`;

  elements.emojiGrid.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = "No matches yet. Try a broader search or another group.";
    elements.emojiGrid.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    filtered.forEach((emoji) => fragment.appendChild(createEmojiCard(emoji)));
    elements.emojiGrid.appendChild(fragment);
  }

  renderMiniGrid(elements.favoritesGrid, state.favorites, "Click the star on any emoji to pin it here.");
  renderMiniGrid(elements.recentGrid, state.recent, "Copy an emoji and it will appear here.");
}

function filterEmoji() {
  return dataset.emoji.filter((emoji) => {
    const matchesGroup = state.group === "All" || emoji.group === state.group;
    const matchesFavorite = !state.favoritesOnly || state.favorites.includes(emoji.id);
    const haystack = `${emoji.name} ${emoji.group} ${emoji.subgroup} ${emoji.keywords.join(" ")}`.toLowerCase();
    const matchesSearch = !state.search || haystack.includes(state.search);
    return matchesGroup && matchesFavorite && matchesSearch;
  });
}

function createEmojiCard(emoji) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "emoji-card";
  card.title = `Copy ${emoji.name}`;
  card.addEventListener("click", () => copyEmoji(emoji));

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = `favorite-button${state.favorites.includes(emoji.id) ? " is-favorite" : ""}`;
  favoriteButton.textContent = state.favorites.includes(emoji.id) ? "★" : "☆";
  favoriteButton.title = "Toggle favorite";
  favoriteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(emoji.id);
  });

  const char = document.createElement("div");
  char.className = "emoji-char";
  char.appendChild(createEmojiPresentation(emoji, false));

  const name = document.createElement("div");
  name.className = "emoji-name";
  name.textContent = emoji.name;

  const meta = document.createElement("div");
  meta.className = "emoji-meta";
  meta.textContent = `${emoji.group} • ${emoji.subgroup}`;

  const code = document.createElement("div");
  code.className = "emoji-code";
  code.textContent = emoji.codepoints;

  card.append(favoriteButton, char, name, meta, code);
  return card;
}

async function copyEmoji(emoji) {
  try {
    await navigator.clipboard.writeText(emoji.char);
    pushRecent(emoji.id);
    renderMiniGrid(elements.recentGrid, state.recent, "Copy an emoji and it will appear here.");
    showToast(`${emoji.char} copied`);
  } catch (error) {
    showToast(`Couldn't copy ${emoji.char} automatically`);
  }
}

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
  } else {
    state.favorites = [id, ...state.favorites].slice(0, 300);
  }
  saveList(STORAGE_KEYS.favorites, state.favorites);
  render();
}

function pushRecent(id) {
  state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 24);
  saveList(STORAGE_KEYS.recent, state.recent);
}

function renderMiniGrid(container, ids, emptyText) {
  container.innerHTML = "";
  if (!ids.length) {
    container.className = "mini-grid empty-state";
    container.textContent = emptyText;
    return;
  }

  container.className = "mini-grid";
  const fragment = document.createDocumentFragment();
  ids.forEach((id) => {
    const emoji = dataset.emoji.find((item) => item.id === id);
    if (!emoji) {
      return;
    }

    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "mini-tile";
    tile.title = emoji.name;
    tile.addEventListener("click", () => copyEmoji(emoji));
    tile.appendChild(createEmojiPresentation(emoji, true));
    fragment.appendChild(tile);
  });
  container.appendChild(fragment);
}

function exportFavoritesJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: dataset.version,
    favorites: state.favorites
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "emoji-browser-favorites.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Favorites exported");
}

async function copySyncCode() {
  const payload = JSON.stringify({ favorites: state.favorites });
  try {
    await navigator.clipboard.writeText(payload);
    showToast("Sync code copied");
  } catch (error) {
    showToast("Unable to copy sync code");
  }
}

async function pasteSyncCode() {
  try {
    const text = await navigator.clipboard.readText();
    importFavoritesPayload(text);
  } catch (error) {
    const manual = window.prompt("Paste a favorites sync code");
    if (manual) {
      importFavoritesPayload(manual);
    }
  }
}

function importFavoritesJson(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  file.text().then((text) => importFavoritesPayload(text)).catch(() => {
    showToast("Couldn't read that favorites file");
  });
  event.target.value = "";
}

function importFavoritesPayload(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.favorites)) {
      throw new Error("Missing favorites");
    }

    const valid = parsed.favorites.filter((id) => dataset.emoji.some((emoji) => emoji.id === id));
    state.favorites = Array.from(new Set(valid)).slice(0, 300);
    saveList(STORAGE_KEYS.favorites, state.favorites);
    render();
    showToast("Favorites imported");
  } catch (error) {
    showToast("That sync data wasn't valid");
  }
}

function loadList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function createEmojiPresentation(emoji, compact) {
  if (!shouldForceFallback(emoji) && supportsNativeEmoji(emoji.char)) {
    const span = document.createElement("span");
    span.className = compact ? "mini-emoji-glyph" : "emoji-glyph";
    span.textContent = emoji.char;
    return span;
  }

  const image = document.createElement("img");
  image.className = compact ? "mini-emoji-image" : "emoji-fallback-image";
  image.src = getEmojiFallbackUrl(emoji.codepoints);
  image.alt = emoji.name;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.addEventListener(
    "error",
    () => {
      image.replaceWith(createGlyphSpan(emoji.char, compact));
    },
    { once: true }
  );
  return image;
}

function createGlyphSpan(char, compact) {
  const span = document.createElement("span");
  span.className = compact ? "mini-emoji-glyph" : "emoji-glyph";
  span.textContent = char;
  return span;
}

function getEmojiFallbackUrl(codepoints) {
  const normalizedCodepoints = codepoints
    .split(/\s+/)
    .filter((codepoint) => codepoint && codepoint !== "fe0f")
    .join("_");
  return `${EMOJI_FALLBACK_BASE_URL}/${normalizedCodepoints}/emoji.svg`;
}

function shouldForceFallback(emoji) {
  if (FORCED_FALLBACK_IDS.has(emoji.id)) {
    return true;
  }

  return emoji.codepoints
    .split(/\s+/)
    .some((codepoint) => /^1fae/i.test(codepoint) || /^1faf/i.test(codepoint));
}

function supportsNativeEmoji(char) {
  if (glyphSupportCache.has(char)) {
    return glyphSupportCache.get(char);
  }

  const emojiSignature = getGlyphSignature(char);
  const placeholderSignatures = [
    getGlyphSignature("\uFFFD"),
    getGlyphSignature("\u25A1"),
    getGlyphSignature("\u25CC")
  ];
  const supported = Boolean(emojiSignature) && !placeholderSignatures.includes(emojiSignature);
  glyphSupportCache.set(char, supported);
  return supported;
}

function getGlyphSignature(char) {
  if (glyphSignatureCache.has(char)) {
    return glyphSignatureCache.get(char);
  }

  if (!glyphCanvas) {
    glyphCanvas = document.createElement("canvas");
    glyphCanvas.width = 80;
    glyphCanvas.height = 80;
    glyphContext = glyphCanvas.getContext("2d", { willReadFrequently: true });
  }

  if (!glyphContext) {
    glyphSignatureCache.set(char, "");
    return "";
  }

  glyphContext.clearRect(0, 0, glyphCanvas.width, glyphCanvas.height);
  glyphContext.textBaseline = "top";
  glyphContext.font = "64px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  glyphContext.fillText(char, 8, 8);

  const { data } = glyphContext.getImageData(0, 0, glyphCanvas.width, glyphCanvas.height);
  let pixelCount = 0;
  let minX = glyphCanvas.width;
  let minY = glyphCanvas.height;
  let maxX = 0;
  let maxY = 0;
  let hash = 2166136261;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (!alpha) {
      continue;
    }

    const pixelIndex = index / 4;
    const x = pixelIndex % glyphCanvas.width;
    const y = Math.floor(pixelIndex / glyphCanvas.width);
    pixelCount += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    hash ^= data[index];
    hash = Math.imul(hash, 16777619);
    hash ^= data[index + 1];
    hash = Math.imul(hash, 16777619);
    hash ^= data[index + 2];
    hash = Math.imul(hash, 16777619);
    hash ^= alpha;
    hash = Math.imul(hash, 16777619);
  }

  const signature = pixelCount
    ? `${pixelCount}:${minX}:${minY}:${maxX}:${maxY}:${hash >>> 0}`
    : "";
  glyphSignatureCache.set(char, signature);
  return signature;
}

let toastTimeout;

function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 1500);
}
