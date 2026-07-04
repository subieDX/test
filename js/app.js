const STORAGE_KEY = "vocab-study-site.words";
const PROGRESS_KEY = "vocab-study-site.progress";

const DEFAULT_WORDS = [
  { jp: "りんご", en: "apple" },
  { jp: "学校", en: "school" },
  { jp: "勉強", en: "study" },
  { jp: "友だち", en: "friend" },
  { jp: "水", en: "water" },
  { jp: "家族", en: "family" },
  { jp: "楽しい", en: "fun" },
  { jp: "仕事", en: "work" },
  { jp: "速い", en: "fast" },
  { jp: "ありがとう", en: "thank you" },
];

const elements = {
  singleForm: document.getElementById("single-form"),
  jpInput: document.getElementById("jp-input"),
  enInput: document.getElementById("en-input"),
  bulkInput: document.getElementById("bulk-input"),
  bulkAdd: document.getElementById("bulk-add"),
  shuffleBtn: document.getElementById("shuffle-btn"),
  resetBtn: document.getElementById("reset-btn"),
  studyList: document.getElementById("study-list"),
  emptyState: document.getElementById("empty-state"),
  wordCount: document.getElementById("word-count"),
  progressText: document.getElementById("progress-text"),
  statusText: document.getElementById("status-text"),
};

let words = loadWords();
let activeIndex = loadProgress();
let cover = null;
let rowNodes = [];
let rafId = 0;

function normalizeWord(word) {
  if (!word) return null;

  const jp = String(word.jp ?? word.ja ?? word.tango ?? "").trim();
  const en = String(word.en ?? word.imi ?? word.english ?? "").trim();

  if (!jp || !en) return null;
  return { jp, en };
}

function loadWords() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEY));
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map(normalizeWord).filter(Boolean);
  }

  const legacy = safeParse(localStorage.getItem("words"));
  if (Array.isArray(legacy) && legacy.length > 0) {
    const converted = legacy.map(normalizeWord).filter(Boolean);
    if (converted.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(converted));
      return converted;
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WORDS));
  return [...DEFAULT_WORDS];
}

function loadProgress() {
  const saved = Number(localStorage.getItem(PROGRESS_KEY));
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
}

function safeParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function saveWords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, String(activeIndex));
}

function clampProgress() {
  if (words.length === 0) {
    activeIndex = 0;
    return;
  }

  if (activeIndex < 0) activeIndex = 0;
  if (activeIndex > words.length) activeIndex = words.length;
}

function clearStudyList() {
  while (elements.studyList.firstChild) {
    elements.studyList.removeChild(elements.studyList.firstChild);
  }
}

function createWordRow(word, index) {
  const row = document.createElement("article");
  row.className = "word-row";
  row.dataset.index = String(index);

  const jp = document.createElement("div");
  jp.className = "word-ja";
  jp.textContent = word.jp;

  const en = document.createElement("div");
  en.className = "word-en";
  en.textContent = word.en;

  row.appendChild(jp);
  row.appendChild(en);
  return row;
}

function render() {
  clampProgress();
  clearStudyList();

  if (words.length === 0) {
    elements.emptyState.hidden = false;
    elements.studyList.appendChild(elements.emptyState);
    hideCover();
    syncStatus("待機中");
    syncStats();
    return;
  }

  elements.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  words.forEach((word, index) => {
    const row = createWordRow(word, index);
    if (index < activeIndex) row.classList.add("is-revealed");
    if (index === activeIndex) row.classList.add("is-active");
    fragment.appendChild(row);
  });

  elements.studyList.appendChild(fragment);
  rowNodes = Array.from(elements.studyList.querySelectorAll(".word-row"));

  createOrUpdateCover();
  syncStats();
  syncStatus(activeIndex >= words.length ? "完了" : "学習中");
}

function syncStats() {
  elements.wordCount.textContent = String(words.length);
  elements.progressText.textContent = `${Math.min(activeIndex, words.length)} / ${words.length}`;
}

function syncStatus(text) {
  elements.statusText.textContent = text;
}

function hideCover() {
  if (!cover) return;
  cover.classList.add("hidden");
}

function showCover() {
  if (!cover) return;
  cover.classList.remove("hidden");
}

function createOrUpdateCover() {
  if (!cover) {
    cover = document.createElement("button");
    cover.type = "button";
    cover.className = "cover";
    cover.innerHTML = "<strong>クリックで表示</strong><span>英語を見たら次の行へ</span>";
    cover.addEventListener("click", advanceStudy);
  }

  if (!elements.studyList.contains(cover)) {
    elements.studyList.appendChild(cover);
  }

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(positionCover);
}

function positionCover() {
  if (!cover || words.length === 0 || activeIndex >= words.length) {
    hideCover();
    return;
  }

  const row = rowNodes[activeIndex];
  if (!row) {
    hideCover();
    return;
  }

  const englishCell = row.querySelector(".word-en");
  if (!englishCell) {
    hideCover();
    return;
  }

  const top = row.offsetTop;
  const left = englishCell.offsetLeft;
  const width = englishCell.offsetWidth;
  const height = row.offsetHeight;

  cover.style.top = `${top}px`;
  cover.style.left = `${left}px`;
  cover.style.width = `${width}px`;
  cover.style.height = `${height}px`;
  showCover();
}

function advanceStudy() {
  if (words.length === 0) return;
  if (activeIndex >= words.length) return;

  const currentRow = rowNodes[activeIndex];
  if (currentRow) {
    currentRow.classList.remove("is-active");
    currentRow.classList.add("is-revealed");
  }

  activeIndex += 1;
  saveProgress();
  syncStats();

  const nextRow = rowNodes[activeIndex];
  if (nextRow) {
    nextRow.classList.add("is-active");
    syncStatus("学習中");
    requestAnimationFrame(() => {
      positionCover();
      nextRow.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return;
  }

  syncStatus("完了");
  hideCover();
}

function addSingleWord(jp, en) {
  const nextWord = normalizeWord({ jp, en });
  if (!nextWord) return false;

  words.push(nextWord);
  saveWords();
  render();
  return true;
}

function addBulkWords(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const newWords = lines
    .map((line) => {
      const parts = line.includes("\t")
        ? line.split("\t")
        : line.split(/\s*[,/／]\s*/);
      const [jp, en] = parts;
      return normalizeWord({ jp, en });
    })
    .filter(Boolean);

  if (newWords.length === 0) return false;

  words.push(...newWords);
  saveWords();
  render();
  return true;
}

function shuffleWords() {
  if (words.length < 2) return;

  for (let index = words.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [words[index], words[swapIndex]] = [words[swapIndex], words[index]];
  }

  activeIndex = 0;
  saveWords();
  saveProgress();
  render();
}

function resetProgress() {
  activeIndex = 0;
  saveProgress();
  render();
}

elements.singleForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const jp = elements.jpInput.value.trim();
  const en = elements.enInput.value.trim();
  if (!addSingleWord(jp, en)) return;

  elements.jpInput.value = "";
  elements.enInput.value = "";
  elements.jpInput.focus();
});

elements.bulkAdd.addEventListener("click", () => {
  if (!addBulkWords(elements.bulkInput.value)) return;
  elements.bulkInput.value = "";
  elements.bulkInput.focus();
});

elements.shuffleBtn.addEventListener("click", shuffleWords);
elements.resetBtn.addEventListener("click", resetProgress);

window.addEventListener("resize", () => {
  if (words.length === 0) return;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(positionCover);
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;

  if (typing) return;

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    advanceStudy();
  }
});

render();
