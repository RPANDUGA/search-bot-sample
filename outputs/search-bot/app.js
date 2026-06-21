const DEFAULT_SOURCES = [
  {
    id: "launch-plan",
    title: "Search Bot Launch Plan",
    category: "Planning",
    body:
      "A simple search bot should start with a narrow document set, clear prompts, visible citations, and fast feedback. The first release should answer from known sources only. It should show when no confident match is available and invite the user to add more source material.",
  },
  {
    id: "relevance",
    title: "Search Relevance Tuning",
    category: "Search",
    body:
      "Relevant results usually combine exact phrase matches, title matches, keyword overlap, and recency or authority boosts. For a small app, start with keyword scoring, then add synonyms, stop words, and explicit source filters when users need more control.",
  },
  {
    id: "citations",
    title: "Answering With Citations",
    category: "Trust",
    body:
      "A search assistant earns trust by citing the source behind each claim. Short answers should link every major point back to a document title. If the indexed sources do not contain the answer, the bot should say that instead of guessing.",
  },
  {
    id: "metrics",
    title: "Post Launch Metrics",
    category: "Analytics",
    body:
      "Track query volume, zero result searches, click through rate, answer helpfulness, response latency, and the most common source filters. Review zero result searches weekly because they reveal missing documents and vocabulary gaps.",
  },
  {
    id: "privacy",
    title: "Private Knowledge Search",
    category: "Security",
    body:
      "For private or internal documents, keep indexing local when possible, avoid sending sensitive text to unknown services, and make source visibility clear. Add access control before connecting the search bot to company systems or customer data.",
  },
  {
    id: "ui-patterns",
    title: "Search Bot Interface Patterns",
    category: "Design",
    body:
      "A practical search bot interface needs a prominent query box, example prompts, a direct answer, source cards, filters, loading and empty states, and a way to add or refresh content. Users should see both the answer and the evidence.",
  },
];

const STORAGE_KEY = "search-bot-sources-v1";
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "should",
  "the",
  "to",
  "what",
  "when",
  "with",
]);

const state = {
  sources: loadSources(),
  activeCategories: new Set(),
  lastQuery: "",
};

const elements = {
  answerBody: document.querySelector("#answer-body"),
  answerCard: document.querySelector("#answer-card"),
  answerTitle: document.querySelector("#answer-title"),
  docCount: document.querySelector("#doc-count"),
  form: document.querySelector("#search-form"),
  promptChips: document.querySelectorAll(".prompt-chip"),
  queryInput: document.querySelector("#query-input"),
  resetSources: document.querySelector("#reset-sources"),
  resultMeta: document.querySelector("#result-meta"),
  resultsList: document.querySelector("#results-list"),
  resultTemplate: document.querySelector("#result-template"),
  sourceContent: document.querySelector("#source-content"),
  sourceFilters: document.querySelector("#source-filters"),
  sourceForm: document.querySelector("#source-form"),
  sourceTitle: document.querySelector("#source-title"),
  sourceCategory: document.querySelector("#source-category"),
};

function loadSources() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return getDefaultSources();
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.every(isValidSource)) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return getDefaultSources();
}

function getDefaultSources() {
  return DEFAULT_SOURCES.map((source) => ({ ...source }));
}

function isValidSource(source) {
  return source && source.id && source.title && source.category && source.body;
}

function saveSources() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sources));
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function tokenize(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function getCategories() {
  const counts = new Map();
  for (const source of state.sources) {
    counts.set(source.category, (counts.get(source.category) || 0) + 1);
  }
  return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function getVisibleSources() {
  if (state.activeCategories.size === 0) {
    return state.sources;
  }
  return state.sources.filter((source) => state.activeCategories.has(source.category));
}

function scoreSource(source, query, tokens) {
  const normalizedQuery = normalize(query).trim();
  const title = normalize(source.title);
  const category = normalize(source.category);
  const body = normalize(source.body);
  const combined = `${title} ${category} ${body}`;
  let score = 0;
  const matched = new Set();

  if (normalizedQuery && body.includes(normalizedQuery)) {
    score += 12;
  }
  if (normalizedQuery && title.includes(normalizedQuery)) {
    score += 16;
  }

  for (const token of tokens) {
    const bodyMatches = countOccurrences(body, token);
    const titleMatches = countOccurrences(title, token);
    const categoryMatches = countOccurrences(category, token);

    if (combined.includes(token)) {
      matched.add(token);
    }

    score += bodyMatches * 2;
    score += titleMatches * 7;
    score += categoryMatches * 5;
  }

  if (tokens.length > 0) {
    score += (matched.size / tokens.length) * 10;
  }

  return {
    ...source,
    score,
    matchedTerms: Array.from(matched),
    snippet: makeSnippet(source.body, tokens),
  };
}

function countOccurrences(text, token) {
  const matches = text.match(new RegExp(`\\b${escapeRegExp(token)}\\b`, "g"));
  return matches ? matches.length : 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeSnippet(body, tokens) {
  const sentences = body.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [body];
  if (tokens.length === 0) {
    return sentences[0].trim();
  }

  const ranked = sentences
    .map((sentence) => {
      const text = normalize(sentence);
      const score = tokens.reduce((sum, token) => sum + countOccurrences(text, token), 0);
      return { sentence: sentence.trim(), score };
    })
    .sort((a, b) => b.score - a.score);

  return (ranked[0]?.sentence || sentences[0]).trim();
}

function search(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }

  return getVisibleSources()
    .map((source) => scoreSource(source, query, tokens))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function renderFilters() {
  const categories = getCategories();
  elements.sourceFilters.innerHTML = "";

  for (const [category, count] of categories) {
    const row = document.createElement("div");
    row.className = "filter-row";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.activeCategories.has(category);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.activeCategories.add(category);
      } else {
        state.activeCategories.delete(category);
      }
      runSearch(state.lastQuery);
      renderFilters();
    });

    const labelText = document.createElement("strong");
    labelText.textContent = category;
    label.append(checkbox, labelText);

    const countLabel = document.createElement("span");
    countLabel.textContent = `${count} source${count === 1 ? "" : "s"}`;

    row.append(label, countLabel);
    elements.sourceFilters.append(row);
  }
}

function renderDocCount() {
  elements.docCount.textContent = `${state.sources.length} source${state.sources.length === 1 ? "" : "s"} indexed`;
}

function renderResults(results, query) {
  elements.resultsList.innerHTML = "";

  if (!query) {
    elements.resultMeta.textContent = "No search yet";
    return;
  }

  if (results.length === 0) {
    elements.resultMeta.textContent = "0 matches";
    const empty = document.createElement("article");
    empty.className = "result-card";
    empty.innerHTML =
      "<h3>No confident matches</h3><p>Add another source or try a different phrase. The bot only answers from indexed content.</p>";
    elements.resultsList.append(empty);
    return;
  }

  elements.resultMeta.textContent = `${results.length} match${results.length === 1 ? "" : "es"}`;

  for (const result of results) {
    const card = elements.resultTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".category").textContent = result.category;
    card.querySelector(".score").textContent = `Score ${Math.round(result.score)}`;
    card.querySelector("h3").textContent = result.title;
    card.querySelector("p").innerHTML = highlight(result.snippet, result.matchedTerms);
    elements.resultsList.append(card);
  }
}

function highlight(text, terms) {
  if (terms.length === 0) {
    return escapeHtml(text);
  }

  const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).join("|")})\\b`, "gi");
  return escapeHtml(text).replace(pattern, "<mark>$1</mark>");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function renderAnswer(results, query) {
  elements.answerCard.classList.toggle("empty", !query || results.length === 0);

  if (!query) {
    elements.answerTitle.textContent = "Ask a question to search the indexed sources.";
    elements.answerBody.innerHTML =
      "<p>Try one of the prompts above or add your own source on the right. The bot ranks matching documents, pulls the strongest snippets, and cites where each point came from.</p>";
    return;
  }

  if (results.length === 0) {
    elements.answerTitle.textContent = "I could not find that in the indexed sources.";
    elements.answerBody.innerHTML =
      "<p>The bot avoids guessing when the source set does not support an answer. Add a source with the missing detail or broaden the query.</p>";
    return;
  }

  const topResults = results.slice(0, 3);
  elements.answerTitle.textContent = `Best answer for "${query}"`;
  elements.answerBody.innerHTML = topResults
    .map((result, index) => {
      const citation = `<span class="citation">[${index + 1}] ${escapeHtml(result.title)}</span>`;
      return `<p>${escapeHtml(result.snippet)} ${citation}</p>`;
    })
    .join("");
}

function runSearch(query) {
  const trimmed = query.trim();
  state.lastQuery = trimmed;
  elements.queryInput.value = trimmed;
  const results = search(trimmed);
  renderAnswer(results, trimmed);
  renderResults(results, trimmed);
}

function addSource(event) {
  event.preventDefault();

  const title = elements.sourceTitle.value.trim();
  const category = elements.sourceCategory.value.trim();
  const body = elements.sourceContent.value.trim();
  if (!title || !category || !body) {
    return;
  }

  state.sources = [
    {
      id: `custom-${Date.now()}`,
      title,
      category,
      body,
    },
    ...state.sources,
  ];
  saveSources();
  elements.sourceForm.reset();
  renderDocCount();
  renderFilters();
  runSearch(state.lastQuery || title);
}

function resetSources() {
  state.sources = getDefaultSources();
  state.activeCategories.clear();
  saveSources();
  renderDocCount();
  renderFilters();
  runSearch("");
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch(elements.queryInput.value);
});

elements.promptChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    runSearch(chip.dataset.query || "");
    elements.queryInput.focus();
  });
});

elements.sourceForm.addEventListener("submit", addSource);
elements.resetSources.addEventListener("click", resetSources);

renderDocCount();
renderFilters();
runSearch("");
