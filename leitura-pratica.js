"use strict";
/* Leitura, parte 2: aproveitar o livro além de ler.
   - Palavras guardadas (★ no painel da palavra): ficam em progress.practice.bookWords = {items: {"livro|palavra": {…}}}
     (entram no backup e na sincronização; apagar deixa {deleted} para a sincronização não trazer de volta), com revisão rápida.
   - Praticar o capítulo: vocabulário antes de ler, tradução de volta (pt → de, escrevendo ou falando), ditado com o
     audiolivro, complete a palavra, repetir junto (shadowing com comparação palavra por palavra) e conversa com a IA
     sobre o capítulo. Tudo a partir do texto, da sincronização e das anotações do livro.
   Carregado depois de leitura.js; usa o estado e as funções de app.js, leitura.js, fluencia.js e conversa.js. */

const BW_KEY_MAX = 140;
const RD_CONTENT = new Set(["substantivo", "verbo", "adjetivo", "advérbio"]);
const bp = {kind: null, items: [], i: 0, score: 0, answered: false, clip: null, token: 0, flipped: false};

// ---------- Palavras guardadas ----------
function bookWordsData() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.bookWords || (progress.practice.bookWords = {items: {}});
}
function sanitizeBookWords(src) {
  const out = {items: {}};
  if (!src || typeof src !== "object" || !src.items || typeof src.items !== "object") return out;
  const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
  for (const [k, v] of Object.entries(src.items)) {
    if (!k || k.length > BW_KEY_MAX || !k.includes("|") || !v || typeof v !== "object") continue;
    const updatedAt = Number(v.updatedAt) || Number(v.at) || 0;
    if (!(updatedAt > 0)) continue;
    if (v.deleted) { out.items[k] = {deleted: true, updatedAt}; continue; }
    // t: "w" palavra (padrão), "x" expressão (ks = índices das palavras na frase), "p" trecho para estudar depois.
    const t = ["w", "x", "p"].includes(v.t) ? v.t : "w";
    const item = {b: str(v.b, 80), w: str(v.w, 120), lema: str(v.lema, 120), pt: str(v.pt, 300), s: str(v.s, 600), sid: str(v.sid, 40),
      at: Number(v.at) || updatedAt, updatedAt, ok: Math.max(0, Math.round(Number(v.ok) || 0))};
    if (t !== "w") item.t = t;
    if (t === "x") { item.uso = str(v.uso, 600); item.ks = str(v.ks, 40); }
    if (item.b && (item.w || (t === "p" && item.s))) out.items[k] = item;
  }
  return out;
}
/* Vale a versão mais recente de cada palavra (inclusive a marca de apagada). */
function mergeBookWords(local, incoming) {
  const out = sanitizeBookWords(local);
  for (const [k, v] of Object.entries(sanitizeBookWords(incoming).items)) if (!out.items[k] || v.updatedAt > out.items[k].updatedAt) out.items[k] = v;
  return out;
}
function bookWordKey(bookId, word) { return (bookId + "|" + String(word).toLocaleLowerCase("de")).slice(0, BW_KEY_MAX); }
function savedWordsOf(bookId) {
  return Object.entries(bookWordsData().items).filter(([, v]) => !v.deleted && v.b === bookId).map(([k, v]) => ({k, ...v})).sort((a, b) => b.at - a.at);
}
function isWordSaved(bookId, word) { const v = bookWordsData().items[bookWordKey(bookId, word)]; return !!(v && !v.deleted); }
function bookWordEntry(word) {
  const w = reading.book && reading.book.notes && reading.book.notes.w;
  return w ? (w[word] || w[String(word).toLocaleLowerCase("de")] || null) : null;
}
function toggleSavedWord(word, i) {
  const b = reading.book;
  if (!b || !word) return false;
  const k = bookWordKey(b.id, word), now = Date.now(), d = bookWordsData();
  if (isWordSaved(b.id, word)) d.items[k] = {deleted: true, updatedAt: now};
  else {
    const e = bookWordEntry(word) || [], s = reading.order[i] || {};
    d.items[k] = {b: b.id, w: word, lema: e[0] || "", pt: e[2] || "", s: s.text || "", sid: s.id || "", at: now, updatedAt: now, ok: 0};
  }
  saveProgress();
  updateSavedCount();
  return isWordSaved(b.id, word);
}
function saveWordButton(word) {
  const saved = isWordSaved(reading.book.id, word);
  return h("button", {class: "icon-btn" + (saved ? " on" : ""), type: "button", title: saved ? "Tirar das palavras guardadas" : "Guardar a palavra para revisar",
    "aria-label": saved ? "Tirar das palavras guardadas" : "Guardar a palavra", onclick: () => { toggleSavedWord(word, reading.sel); renderDetail(); refreshReaderPop(); }}, saved ? "★" : "☆");
}

// ---------- Dados do capítulo (funções puras sobre o livro) ----------
/* Palavras de conteúdo que aparecem pela primeira vez neste capítulo (uma por lema), das mais frequentes no livro. */
function chapterGlossary(order, notesW, ch, max = 40) {
  const first = new Map(), count = new Map();
  for (const s of order) for (const m of s.text.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) {
    const k = m[0].toLocaleLowerCase("de");
    count.set(k, (count.get(k) || 0) + 1);
    if (!first.has(k)) first.set(k, {w: m[0], ch: s.ch, s});
  }
  const out = [], lemmas = new Set();
  for (const [k, f] of first) {
    const e = notesW && notesW[k];
    if (f.ch !== ch || !e || !RD_CONTENT.has(e[1]) || lemmas.has(e[0])) continue;
    lemmas.add(e[0]);
    out.push({k, w: f.w, lema: e[0], classe: e[1], pt: e[2], obs: e[3] || "", n: count.get(k), s: f.s});
  }
  return out.sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)).slice(0, max);
}
/* A palavra que some na lacuna: a mais longa (4+ letras) que seja substantivo, verbo, adjetivo ou advérbio. */
function pickGap(text, notesW) {
  const cands = [...text.matchAll(/\p{L}+/gu)].filter(m => m[0].length >= 4 && notesW && notesW[m[0].toLocaleLowerCase("de")] && RD_CONTENT.has(notesW[m[0].toLocaleLowerCase("de")][1]));
  if (!cands.length) return null;
  const m = cands.sort((a, b) => b[0].length - a[0].length || a.index - b.index)[0], e = notesW[m[0].toLocaleLowerCase("de")];
  return {word: m[0], at: m.index, lema: e[0], pt: e[2]};
}
/* Frases do capítulo que servem para cada exercício (3 a 16 palavras; com tradução, áudio ou lacuna, conforme o tipo). */
function practicePool(kind, order, starts, notes, ch) {
  const S = (notes && notes.s) || {}, W = (notes && notes.w) || {};
  let pool = order.map((s, i) => ({s, i})).filter(({s}) => s.ch === ch && !s.h).filter(({s}) => { const n = s.text.split(/\s+/).filter(w => /\p{L}/u.test(w)).length; return n >= 3 && n <= 16; });
  if (kind === "volta") pool = pool.filter(({s}) => S[s.id] && S[s.id].pt);
  if (kind === "ditado" || kind === "sombra") pool = pool.filter(({i}) => starts[i] != null);
  let items = pool.map(({s, i}) => ({i, text: s.text, pt: (S[s.id] && S[s.id].pt) || ""}));
  if (kind === "lacuna") items = items.map(it => ({...it, gap: pickGap(it.text, W)})).filter(it => it.gap);
  return items;
}

// ---------- Tela: palavras guardadas ----------
function readingShell(title, ...content) {
  stopReadingAudio();
  bp.token++;
  if (bp.clip) { bp.clip.stop(); bp.clip = null; }
  $("readingLibrary").hidden = true;
  $("readingBook").hidden = false;
  fill($("readingBook"),
    h("div", {class: "reader-head"}, h("p", {class: "eyebrow"}, h("span", {lang: "de", text: reading.book.title}), " · capítulo " + (reading.ch + 1) + " de " + reading.book.chapters.length)),
    h("div", {class: "reader-bar"}, h("button", {class: "quiet small", type: "button", onclick: backToText}, "← Voltar ao texto"), h("b", {text: title})),
    h("div", {class: "rd-practice"}, ...content));
  window.scrollTo({top: 0});
}
function backToText() { bp.token++; if (bp.clip) { bp.clip.stop(); bp.clip = null; } stopReadingAudio(); reading.view = "text"; renderBook(); requestAnimationFrame(() => reading.sel >= 0 && scrollToSentence(reading.sel, "center")); }
function renderSavedWords() {
  reading.view = "words";
  const all = savedWordsOf(reading.book.id), list = all.filter(v => v.t !== "p"), spots = all.filter(v => v.t === "p");
  readingShell("Guardados deste livro",
    h("p", {class: "muted", text: all.length ? "Palavras (☆ no painel), expressões (marque várias palavras) e trechos para estudar depois (📌). Revise, ouça a frase onde apareceram ou transforme a frase em cartão."
      : "Nada guardado neste livro ainda. Na leitura, toque numa palavra e depois na estrela (☆); marque várias palavras para uma expressão; ou use 📌 para guardar um trecho."}),
    list.length ? h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => startWordReview(list)}, "Revisar palavras e expressões (" + list.length + ")"),
      h("button", {class: "quiet", type: "button", onclick: () => copyWords(list)}, "Copiar a lista")) : null,
    spots.length ? h("h2", {text: "Trechos para estudar (" + spots.length + ")"}) : null,
    ...spots.map(v => h("article", {class: "rd-saved"},
      h("div", null, h("p", {lang: "de", text: v.s}), v.pt ? h("p", {class: "muted small-text", text: v.pt}) : null),
      h("div", {class: "row"},
        v.sid && reading.byId.has(v.sid) ? h("button", {class: "small", type: "button", onclick: () => openSpot(v.sid)}, "Abrir no livro") : null,
        v.sid && reading.byId.has(v.sid) && reading.starts[reading.byId.get(v.sid)] != null ? h("button", {class: "quiet small", type: "button", onclick: () => playSentence(reading.byId.get(v.sid))}, icon("volume", 16), "Ouvir") : null,
        h("button", {class: "quiet small", type: "button", onclick: () => { toggleSavedWordByKey(v.k); renderSavedWords(); }}, "Tirar")))),
    list.length && spots.length ? h("h2", {text: "Palavras e expressões (" + list.length + ")"}) : null,
    ...list.map(v => h("article", {class: "rd-saved"},
      h("div", null,
        h("p", null, h("b", {lang: "de", class: "rd-word-form", text: v.w}), v.lema && v.lema.toLocaleLowerCase("de") !== v.w.toLocaleLowerCase("de") ? h("span", {class: "muted", lang: "de", text: "  (" + v.lema + ")"}) : null),
        v.pt ? h("p", {class: "rd-meaning", text: v.pt}) : null,
        v.t === "x" && v.uso ? h("p", {class: "muted small-text", text: v.uso}) : null,
        v.s ? h("p", {class: "small-text", lang: "de", text: v.s}) : null),
      h("div", {class: "row"},
        v.t === "x" ? null : h("button", {class: "icon-btn", type: "button", title: "Ouvir a palavra", "aria-label": "Ouvir a palavra", onclick: () => speak(v.w)}, icon("volume", 18)),
        v.sid && reading.byId.has(v.sid) ? h("button", {class: "quiet small", type: "button", onclick: () => openSpot(v.sid)}, "No livro") : null,
        v.sid && reading.byId.has(v.sid) && reading.starts[reading.byId.get(v.sid)] != null ? h("button", {class: "small", type: "button", onclick: () => playSentence(reading.byId.get(v.sid))}, "Ouvir a frase") : null,
        v.s ? h("button", {class: "quiet small", type: "button", onclick: e => { e.currentTarget.disabled = true; addMineDrafts(v.s, convAvailable(), "livro"); toast("Rascunho criado em Minhas frases: confira e salve lá.", "success"); }}, "Virar cartão") : null,
        h("button", {class: "quiet small", type: "button", onclick: () => { toggleSavedWordByKey(v.k); renderSavedWords(); }}, "Tirar")))));
}
/* Volta ao texto no ponto guardado, com a frase selecionada. */
function openSpot(sid) {
  const i = reading.byId.get(sid);
  if (i == null) return;
  reading.ch = reading.order[i].ch; reading.sel = i; reading.word = ""; reading.wk = -1; reading.pick = [];
  renderBook(); saveBookPosition();
  requestAnimationFrame(() => scrollToSentence(i, "center"));
}
function toggleSavedWordByKey(k) { bookWordsData().items[k] = {deleted: true, updatedAt: Date.now()}; saveProgress(); }
async function copyWords(list) {
  const text = list.map(v => v.w + (v.lema && v.lema !== v.w ? " (" + v.lema + ")" : "") + " — " + (v.pt || "") + (v.s ? "\n   " + v.s : "")).join("\n");
  try { await navigator.clipboard.writeText(text); toast("Lista copiada.", "success"); } catch (e) { setStatus("Não foi possível copiar.", "error"); }
}
/* Revisão rápida: a palavra com a frase; você tenta lembrar, vira e diz se sabia. */
function startWordReview(list) {
  Object.assign(bp, {kind: "palavras", items: shuffled(list).slice(0, 20), i: 0, score: 0, answered: false, flipped: false});
  showWordCard();
}
function showWordCard() {
  const v = bp.items[bp.i];
  if (!v) { finishPractice(); return; }
  const flip = () => { bp.flipped = true; showWordCard(); };
  readingShell("Revisar palavras · " + (bp.i + 1) + " de " + bp.items.length,
    h("div", {class: "rd-card panel"},
      h("p", {class: "rd-word-form", lang: "de", text: v.w}),
      v.s ? h("p", {class: "small-text", lang: "de"}, ...(v.t === "x" ? [v.s] : markWord(v.s, v.w))) : null,
      bp.flipped ? h("div", null, v.lema ? h("p", {lang: "de", class: "rd-lemma", text: v.lema}) : null, h("p", {class: "rd-meaning", text: v.pt || "(sem significado anotado)"})) : null,
      h("div", {class: "row center"},
        !bp.flipped ? h("button", {class: "primary", type: "button", onclick: flip}, "Mostrar o significado", h("kbd", null, "Espaço"))
          : [h("button", {type: "button", onclick: () => gradeWord(false)}, "Não sabia"), h("button", {class: "primary", type: "button", onclick: () => gradeWord(true)}, "Sabia")],
        h("button", {class: "icon-btn", type: "button", title: "Ouvir", "aria-label": "Ouvir", onclick: () => speak(v.w)}, icon("volume", 18)))));
}
function gradeWord(ok) {
  const v = bp.items[bp.i], item = bookWordsData().items[v.k];
  if (ok) { bp.score++; if (item && !item.deleted) { item.ok = (item.ok || 0) + 1; item.updatedAt = Date.now(); } }
  saveProgress();
  bp.i++; bp.flipped = false;
  showWordCard();
}
function markWord(text, word) {
  const i = text.indexOf(word);
  return i < 0 ? [text] : [text.slice(0, i), h("mark", {text: word}), text.slice(i + word.length)];
}

// ---------- Tela: praticar o capítulo ----------
const RD_PRACTICE = [
  ["vocab", "📖 Vocabulário do capítulo", "As palavras que aparecem pela primeira vez neste capítulo, com o significado. Bom para ver antes de ler."],
  ["volta", "🔁 Tradução de volta", "Você vê a frase em português e diz ou escreve em alemão. Depois compara com o livro, palavra por palavra."],
  ["ditado", "✍️ Ditado com o audiolivro", "Ouça a frase do narrador e escreva. O app mostra cada erro de grafia (maiúscula, trema, ß…)."],
  ["lacuna", "🧩 Complete a palavra", "A frase aparece com uma palavra faltando e a tradução de ajuda. Escreva a palavra que falta."],
  ["sombra", "🗣️ Repetir junto (shadowing)", "Ouça a frase do narrador e repita em voz alta, no mesmo ritmo. O app transcreve e compara palavra por palavra."],
  ["conversa", "💬 Conversar sobre o capítulo", "A parceira de conversa (IA do computador) faz perguntas sobre o que você leu, no seu nível."]
];
function practiceAvailable(kind) {
  const b = reading.book, notes = b.notes || {};
  if (kind === "vocab") return notes.w ? "" : "Precisa das anotações do livro (dicionário de palavras).";
  if (kind === "volta") return notes.s ? "" : "Precisa das traduções do livro (anotações).";
  if (kind === "lacuna") return notes.w ? "" : "Precisa das anotações do livro (dicionário de palavras).";
  if (kind === "ditado") return hasSync() ? "" : "Precisa do áudio sincronizado.";
  if (kind === "sombra") return !hasSync() ? "Precisa do áudio sincronizado." : !speechAvailable() ? "Precisa do reconhecimento de fala (Whisper) e de um microfone." : "";
  if (kind === "conversa") return convAvailable() ? "" : "Precisa da parceira de conversa (IA) instalada neste computador.";
  return "";
}
function renderBookPractice(kind) {
  reading.view = "practice";
  if (!kind) {
    readingShell("Praticar o capítulo " + (reading.ch + 1),
      h("p", {class: "muted", text: "Exercícios feitos com as frases deste capítulo. Cada rodada tem até 10 frases; o áudio é o do próprio audiolivro."}),
      h("div", {class: "rd-menu"}, ...RD_PRACTICE.map(([k, title, desc]) => {
        const why = practiceAvailable(k), n = ["volta", "ditado", "lacuna", "sombra"].includes(k) ? practicePool(k, reading.order, reading.starts, reading.book.notes, reading.ch).length : null;
        return h("button", {class: "rd-menu-item", type: "button", disabled: !!why || n === 0, onclick: () => startPractice(k)},
          h("b", {text: title}), h("span", {class: "muted small-text", text: why || (n === 0 ? "Sem frases adequadas neste capítulo." : desc)}));
      })));
    return;
  }
  startPractice(kind);
}
function startPractice(kind) {
  if (kind === "vocab") { renderGlossary(); return; }
  if (kind === "conversa") { talkAboutChapter(); return; }
  const pool = practicePool(kind, reading.order, reading.starts, reading.book.notes, reading.ch);
  const items = shuffled(pool).slice(0, 10).sort((a, b) => a.i - b.i);
  Object.assign(bp, {kind, items, i: 0, score: 0, answered: false});
  showPracticeItem();
}
function renderGlossary() {
  const list = chapterGlossary(reading.order, (reading.book.notes || {}).w, reading.ch);
  readingShell("Vocabulário do capítulo " + (reading.ch + 1),
    h("p", {class: "muted", text: list.length ? list.length + " palavras novas neste capítulo (a primeira vez que aparecem no livro), das mais frequentes no livro. ☆ guarda a palavra para revisar."
      : "Nenhuma palavra nova neste capítulo."}),
    h("div", {class: "rd-gloss"}, ...list.map(v => {
      const star = h("button", {class: "icon-btn" + (isWordSaved(reading.book.id, v.w) ? " on" : ""), type: "button", title: "Guardar a palavra", "aria-label": "Guardar a palavra",
        onclick: e => { const on = toggleSavedWord(v.w, reading.byId.get(v.s.id)); e.currentTarget.textContent = on ? "★" : "☆"; e.currentTarget.classList.toggle("on", on); }}, isWordSaved(reading.book.id, v.w) ? "★" : "☆");
      return h("div", {class: "rd-gloss-row"},
        h("div", null, h("b", {lang: "de", text: v.lema}), v.lema.toLocaleLowerCase("de").endsWith(v.w.toLocaleLowerCase("de")) ? null : h("span", {class: "muted small-text", lang: "de", text: " · no texto: " + v.w}),
          h("p", {class: "small-text", text: v.pt + (v.obs ? " · " + v.obs : "")}), h("p", {class: "muted small-text", text: v.classe + " · " + v.n + "× no livro"})),
        h("div", {class: "row"}, h("button", {class: "icon-btn", type: "button", title: "Ouvir", "aria-label": "Ouvir", onclick: () => speak(v.lema)}, icon("volume", 18)), star));
    })),
    list.length ? h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: backToText}, "Ler o capítulo")) : null);
}
function umlautRow(input) {
  return h("div", {class: "row umlaut-row"}, ...["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"].map(ch => {
    const b = h("button", {class: "quiet small", type: "button", text: ch});
    b.addEventListener("mousedown", e => e.preventDefault());
    b.addEventListener("click", () => { const s = input.selectionStart ?? input.value.length, t = input.selectionEnd ?? s; input.setRangeText(ch, s, t, "end"); input.focus(); });
    return b;
  }));
}
function showPracticeItem() {
  const it = bp.items[bp.i];
  if (!it) { finishPractice(); return; }
  bp.answered = false;
  const title = RD_PRACTICE.find(p => p[0] === bp.kind)[1].replace(/^\S+\s/, "") + " · " + (bp.i + 1) + " de " + bp.items.length;
  const input = bp.kind === "sombra" ? null : h(bp.kind === "lacuna" ? "input" : "textarea", {id: "bpInput", lang: "de", rows: "2", spellcheck: "false", autocomplete: "off",
    placeholder: bp.kind === "volta" ? "Escreva (ou fale) a frase em alemão" : bp.kind === "ditado" ? "Escreva o que você ouviu" : "A palavra que falta"});
  const result = h("div", {id: "bpResult", class: "bp-result", hidden: true});
  const listen = (slow) => playSentence(it.i, slow);
  let prompt;
  if (bp.kind === "volta") prompt = [h("p", {class: "muted small-text", text: "Diga em alemão:"}), h("p", {class: "bp-prompt", text: it.pt})];
  else if (bp.kind === "ditado") prompt = [h("p", {class: "muted small-text", text: "Ouça e escreva a frase:"}), h("div", {class: "row"},
    h("button", {class: "primary", type: "button", onclick: () => listen(false)}, icon("volume", 16), "Ouvir"), h("button", {type: "button", onclick: () => listen(true)}, icon("slow", 16), "Devagar"))];
  else if (bp.kind === "lacuna") {
    const g = it.gap;
    prompt = [h("p", {class: "bp-prompt", lang: "de"}, it.text.slice(0, g.at), h("span", {class: "bp-gap", text: "_".repeat(Math.max(4, Math.min(10, g.word.length)))}), it.text.slice(g.at + g.word.length)),
      it.pt ? h("p", {class: "muted small-text", text: it.pt}) : null,
      h("button", {class: "quiet small", type: "button", onclick: e => e.currentTarget.replaceWith(h("p", {class: "small-text", text: "Dica: " + (g.lema ? g.lema + " — " : "") + g.pt}))}, "Dica")];
  } else prompt = [h("p", {class: "muted small-text", text: "Ouça e repita em voz alta, no mesmo ritmo do narrador:"}), h("p", {class: "bp-prompt", lang: "de", text: it.text}),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => listen(false)}, icon("volume", 16), "Ouvir"), h("button", {type: "button", onclick: () => listen(true)}, icon("slow", 16), "Devagar"))];
  const mic = speechAvailable() && (bp.kind === "volta" || bp.kind === "sombra")
    ? h("button", {id: "bpMic", class: bp.kind === "sombra" ? "primary" : "", type: "button", onclick: () => practiceMic(it)}, icon("mic", 16), bp.kind === "sombra" ? "Gravar e comparar" : "Falar")
    : null;
  const check = bp.kind === "sombra" ? null : h("button", {id: "bpCheck", class: "primary", type: "button", onclick: () => checkPractice(it)}, "Conferir", h("kbd", null, "Enter"));
  readingShell(title,
    h("div", {class: "rd-card panel"}, ...prompt.filter(Boolean),
      input, input ? umlautRow(input) : null,
      h("div", {class: "row"}, mic, check,
        h("button", {class: "quiet small", type: "button", onclick: () => { bp.i++; showPracticeItem(); }}, "Pular")),
      result));
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      if (bp.answered) { bp.i++; showPracticeItem(); } else checkPractice(it);
    });
    input.focus();
  }
  if (bp.kind === "ditado" || bp.kind === "sombra") listen(false);
}
async function practiceMic(it) {
  if (bp.clip) { bp.clip.stop(); return; }
  const token = bp.token, btn = $("bpMic");
  stopReadingAudio(); stopAudio();
  const clip = await startClip(bp.kind === "sombra" ? 15000 : 20000);
  if (!clip) return;
  bp.clip = clip;
  if (btn) { btn.classList.add("danger-solid"); btn.replaceChildren(icon("stop", 16), "Parar"); }
  const blob = await clip.done;
  bp.clip = null;
  if (token !== bp.token) return;
  if (btn) { btn.classList.remove("danger-solid"); btn.disabled = true; btn.replaceChildren("Transcrevendo…"); }
  let text = "";
  try { text = await transcribeBlob(blob, false); } catch (e) { setStatus("Não foi possível transcrever: " + e.message, "error"); }
  if (token !== bp.token) return;
  if (btn) { btn.disabled = false; btn.replaceChildren(icon("mic", 16), bp.kind === "sombra" ? "Gravar de novo" : "Falar de novo"); }
  if (!text) { setStatus("Não ouvi nada. Tente de novo mais perto do microfone.", "info"); return; }
  if (bp.kind === "sombra") { checkPractice(it, text); return; }
  const input = $("bpInput");
  if (input) { input.value = text; input.focus(); }
  setStatus("Confira o que o app ouviu (o reconhecimento às vezes erra) e aperte Conferir.", "info");
}
/* Linha de comparação palavra por palavra (verde = igual, sublinhado = quase, faltou, sobrou). */
function diffLine(expected, got) {
  const d = wordDiff(expected, got), line = h("p", {class: "diff-line", lang: "de"});
  d.ops.forEach(([type, a, b], k) => {
    if (k) line.append(" ");
    if (type === "eq") line.append(h("span", {class: "bp-ok", text: a}));
    else if (type === "near") line.append(h("span", {class: "dk-err", title: "Você disse/escreveu: " + b, text: a}));
    else if (type === "ins") line.append(h("ins", {title: "faltou", text: a}));
    else line.append(h("del", {title: "não está no livro", text: a}));
  });
  return {line, pct: d.total ? (d.correct - d.near * .5) / d.total : 0, d};
}
function checkPractice(it, spoken) {
  if (bp.answered) return;
  const input = $("bpInput"), typed = spoken != null ? spoken : (input ? input.value.trim() : "");
  if (!typed) { if (input) input.focus(); return; }
  bp.answered = true;
  const box = $("bpResult"), next = h("button", {class: "primary", type: "button", onclick: () => { bp.i++; showPracticeItem(); }}, bp.i + 1 < bp.items.length ? "Próxima" : "Ver resultado", h("kbd", null, "Enter"));
  const hear = h("button", {class: "small", type: "button", onclick: () => playSentence(it.i)}, icon("volume", 16), "Ouvir o livro");
  if (bp.kind === "ditado") {
    const r = renderDiktatDiff(box, it.text, typed);
    const ok = r.exact === r.words && !r.items.some(x => x.type === "extra");
    if (ok) bp.score++;
    box.append(it.pt ? h("p", {class: "muted small-text", text: it.pt}) : "", h("div", {class: "row"}, hear, next));
  } else if (bp.kind === "lacuna") {
    const issues = spellingIssues(it.gap.word, typed.split(/\s+/)[0] || ""), ok = !issues.length || (issues.length === 1 && issues[0] === "caps");
    if (ok) bp.score++;
    fill(box, h("p", {class: ok ? "fb-ok" : "fb-bad", text: ok ? (issues.length ? "Isso! (atenção à maiúscula)" : "Isso!") : "A palavra é:"}),
      h("p", {class: "bp-prompt", lang: "de"}, ...markWord(it.text, it.gap.word)),
      h("p", {class: "small-text", text: (it.gap.lema ? it.gap.lema + " — " : "") + it.gap.pt}),
      h("div", {class: "row"}, reading.starts[it.i] != null ? hear : null, h("button", {class: "quiet small", type: "button", onclick: e => { toggleSavedWord(it.gap.word, it.i); e.currentTarget.textContent = "★ Guardada"; e.currentTarget.disabled = true; }}, "☆ Guardar a palavra"), next));
    box.hidden = false;
    if (reading.starts[it.i] != null) playSentence(it.i);
  } else {
    const {line, pct} = diffLine(it.text, typed), ok = pct >= .8;
    if (ok) bp.score++;
    fill(box,
      h("div", {class: "diff-head"}, h("span", {text: bp.kind === "sombra" ? "O que o app ouviu, comparado com o livro" : "Comparado com o livro"}),
        h("span", {class: "diff-score " + (ok ? "ok" : "partial"), text: Math.max(0, Math.round(pct * 100)) + "% das palavras"})),
      line,
      bp.kind === "sombra" ? h("p", {class: "muted small-text", lang: "de", text: "Você: " + typed}) : h("p", {class: "muted small-text", text: "A sua frase pode estar certa mesmo sendo diferente da do livro: compare o sentido e a gramática."}),
      it.pt && bp.kind === "sombra" ? h("p", {class: "muted small-text", text: it.pt}) : null,
      h("div", {class: "row"}, reading.starts[it.i] != null ? hear : null,
        bp.kind === "volta" ? h("button", {class: "quiet small", type: "button", onclick: e => { e.currentTarget.disabled = true; addMineDrafts(it.text, convAvailable(), "livro"); toast("Rascunho criado em Minhas frases: confira e salve lá.", "success"); }}, "Virar cartão") : null,
        bp.kind === "sombra" ? h("button", {type: "button", onclick: () => { bp.answered = false; practiceMic(it); }}, icon("mic", 16), "Tentar de novo") : null,
        next));
    box.hidden = false;
    if (bp.kind === "volta" && reading.starts[it.i] != null) playSentence(it.i);
  }
  if (input) { input.readOnly = true; input.focus(); }
  const btn = $("bpCheck");
  if (btn) btn.disabled = true;
}
function finishPractice() {
  const n = bp.items.length, pct = n ? bp.score / n : 0;
  if (n) { progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1; saveProgress(); }
  const kind = bp.kind;
  readingShell("Resultado",
    h("div", {class: "summary"}, h("div", {class: "summary-icon"}, icon("check", 30)),
      h("h2", {text: bp.score + " de " + n + (kind === "palavras" ? " palavras que você sabia" : " frases certas")}),
      h("p", {class: "muted", text: pct >= .9 ? "Muito bem! Esse capítulo está dominado." : pct >= .6 ? "Bom caminho. Repita daqui a pouco com outras frases." : "Releia o capítulo ouvindo o áudio e tente de novo: cada rodada escolhe frases diferentes."}),
      h("div", {class: "row center"},
        h("button", {class: "primary", type: "button", onclick: () => kind === "palavras" ? startWordReview(savedWordsOf(reading.book.id)) : startPractice(kind)}, "De novo"),
        kind === "palavras" ? null : h("button", {type: "button", onclick: () => renderBookPractice()}, "Outro exercício"),
        h("button", {class: "quiet", type: "button", onclick: backToText}, "Voltar ao texto"))));
}
/* Conversa com a IA sobre o capítulo: o texto do capítulo vai no prompt como referência. */
function chapterText(ch, max = 3500) {
  let out = "";
  for (const s of reading.order) if (s.ch === ch && !s.h) { if (out.length + s.text.length + 1 > max) break; out += (out ? " " : "") + s.text; }
  return out;
}
function talkAboutChapter() {
  const b = reading.book, chTitle = b.chapters[reading.ch].title;
  const topic = {id: "livro-" + String(reading.ch + 1), group: "Livro", level: convLevel(), pt: "Sobre “" + b.title + "” · " + chTitle,
    de: "das Buch „" + b.title + "“, " + chTitle, book: {title: b.title, chapter: chTitle, text: chapterText(reading.ch)}};
  saveBookPosition();
  stopReadingAudio();
  showView("conversa");
  openConversaTopic(topic);
}
function bookPracticeKey(e) {
  if (!reading.book || $("readingBook").hidden || reading.view === "text") return false;
  if (e.key === "Escape") { e.preventDefault(); backToText(); return true; }
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return false;
  if (e.code === "Space" && bp.kind === "palavras" && bp.items[bp.i] && !bp.flipped) { e.preventDefault(); bp.flipped = true; showWordCard(); return true; }
  if (e.key === "Enter" && bp.answered) { e.preventDefault(); bp.i++; showPracticeItem(); return true; }
  return false;
}

// ---------- Significado nesta frase (por ocorrência) e expressões ----------
const RD_CLASSES = ["substantivo", "verbo", "adjetivo", "advérbio", "preposição", "pronome", "artigo", "conjunção", "numeral", "interjeição", "nome próprio", "partícula"];
const RD_PARTICLES = new Set(["an", "auf", "aus", "ein", "mit", "zu", "ab", "vor", "zurück", "weg", "nach", "fest", "hin", "her", "los", "vorbei", "weiter", "zusammen",
  "herein", "heraus", "hinaus", "herum", "fort", "um", "dar", "bei", "entgegen", "nieder", "hinzu", "herab", "hinauf", "hervor", "zurecht"]);
/* Função na frase (para artigos e adjetivos, a do grupo do substantivo a que pertencem). */
const RD_FUNCS = ["", "sujeito", "verbo conjugado", "verbo no fim", "objeto direto", "objeto indireto", "complemento de preposição", "predicativo", "adjunto (tempo, lugar, modo)", "conector", "negação ou partícula"];
const RD_GLOSS_SCHEMA = {type: "object", properties: {pt: {type: "string"}, lema: {type: "string"}, classe: {type: "string", enum: RD_CLASSES}, flexao: {type: "string"},
  genero: {type: "string", enum: ["", "der", "die", "das"]}, plural: {type: "string"}, caso: {type: "string", enum: ["", "nominativo", "acusativo", "dativo", "genitivo"]},
  parte: {type: "string"}, funcao: {type: "string", enum: RD_FUNCS}, porque: {type: "string"}, obs: {type: "string"}},
  required: ["pt", "lema", "classe", "flexao", "genero", "plural", "caso", "parte", "funcao", "porque", "obs"]};
const RD_EXPR_SCHEMA = {type: "object", properties: {expressao: {type: "string"}, pt: {type: "string"}, uso: {type: "string"}, exemplo: {type: "string"}, exemplo_pt: {type: "string"}},
  required: ["expressao", "pt", "uso", "exemplo", "exemplo_pt"]};
const rdPending = new Map();
let rdNotesTimer = null;

function bookNotes() {
  const b = reading.book;
  b.notes = b.notes || {s: {}, w: {}};
  b.notes.o = b.notes.o || {}; b.notes.x = b.notes.x || {};
  return b.notes;
}
/* Grava as anotações do livro alguns segundos depois da última mudança (um arquivo só por livro). */
function scheduleNotesSave() {
  clearTimeout(rdNotesTimer);
  const id = reading.book.id, notes = bookNotes();
  rdNotesTimer = setTimeout(() => {
    const saved = window.satzDesktop ? window.satzDesktop.saveBookNotes(id, JSON.stringify(notes)) : rdWebSaveNotes(id, notes);
    saved.catch(e => setStatus("Não consegui salvar a explicação: " + cleanIpcError(e, "erro"), "error"));
  }, 2500);
}
/* Palavras da frase como lista (índice = k) e se há fim de oração logo depois de cada uma. */
function sentenceTokens(text) {
  const parts = sentenceWords(text), words = [], ends = [];
  parts.forEach(p => {
    if (!p) return;
    if (/^[\p{L}\p{N}]/u.test(p)) { words.push(p); ends.push(false); }
    else if (words.length && /[,;:.!?–—"“”„»«()]/.test(p)) ends[ends.length - 1] = true;
  });
  if (ends.length) ends[ends.length - 1] = true;
  return {words, ends};
}
/* Verbo separável: o prefixo que fecha a oração do verbo clicado (ruft … an → an). null se não houver. */
function sepParticle(text, k, notesW) {
  const {words, ends} = sentenceTokens(text), w = words[k];
  if (!w || RD_PARTICLES.has(w.toLocaleLowerCase("de")) || ends[k]) return null;
  const e = notesW && notesW[w.toLocaleLowerCase("de")];
  if (e && e[1] && e[1] !== "verbo") return null;
  if (!e && /^\p{Lu}/u.test(w) && k > 0) return null;
  let j = k;
  while (j < words.length - 1 && !ends[j]) j++;
  if (j === k) return null;
  const p = words[j].toLocaleLowerCase("de");
  if (!RD_PARTICLES.has(p) || /^\p{Lu}/u.test(words[j])) return null;
  const base = e && e[0] && !/\s/.test(e[0]) ? e[0].toLocaleLowerCase("de") : "";
  return {k: j, particle: words[j], verb: base ? (base.startsWith(p) ? base : p + base) : ""};
}
/* Caso definido pela preposição (quando ela só aceita um caso): mit dem Hammer → dativo, für den Freund → acusativo. */
const RD_PREP_CASE = {mit: "dativo", bei: "dativo", von: "dativo", zu: "dativo", aus: "dativo", nach: "dativo", seit: "dativo", "gegenüber": "dativo",
  zum: "dativo", zur: "dativo", vom: "dativo", beim: "dativo", im: "dativo", am: "dativo",
  "für": "acusativo", durch: "acusativo", gegen: "acusativo", ohne: "acusativo", um: "acusativo", ins: "acusativo", ans: "acusativo", aufs: "acusativo",
  wegen: "genitivo", trotz: "genitivo", "während": "genitivo", statt: "genitivo"};
const RD_DET = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein\p{L}*|mein\p{L}*|dein\p{L}*|sein\p{L}*|ihr\p{L}*|unser\p{L}*|euer|eur\p{L}*|dies\p{L}*|jen\p{L}*|jed\p{L}*|welch\p{L}*|all\p{L}*)$/u;
function prepCase(text, k) {
  const {words, ends} = sentenceTokens(text);
  for (let j = k - 1, steps = 0; j >= 0 && steps < 4; j--, steps++) {
    if (ends[j]) return "";
    const w = words[j].toLocaleLowerCase("de");
    if (RD_PREP_CASE[w]) return RD_PREP_CASE[w];
    if (!(RD_DET.test(w) || /^\p{Ll}+(e|en|em|er|es)$/u.test(words[j]))) return "";
  }
  return "";
}
/* Corrige a resposta da IA com o que a gramática garante: caso depois de preposição de caso fixo e verbo separável
   só quando o prefixo fecha de fato a oração (em “hob … an seine Lippen”, an é preposição). */
function fixGloss(text, k, word, g, notesW) {
  const out = {...g};
  const prep = ["substantivo", "pronome", "artigo", "adjetivo"].includes(out.classe) ? prepCase(text, k) : "";
  if (prep && out.classe !== "adjetivo") { out.caso = prep; if (out.flex) out.flex = out.flex.replace(/nominativo|acusativo|dativo|genitivo/g, prep); }
  // Função × caso: depois de preposição de caso fixo é complemento dela; sujeito só no nominativo, objeto direto só no
  // acusativo, objeto indireto só no dativo. Se a IA se contradiz, a função não aparece (melhor nada que errado).
  if (prep && out.fn && !["adjunto (tempo, lugar, modo)", "complemento de preposição"].includes(out.fn)) out.fn = "complemento de preposição";
  const need = {"sujeito": "nominativo", "objeto direto": "acusativo", "objeto indireto": "dativo"}[out.fn];
  if (need && out.caso && out.caso !== need) { out.fn = ""; out.pq = ""; }
  if (out.fn && out.classe === "verbo" && !["verbo conjugado", "verbo no fim"].includes(out.fn)) { out.fn = ""; out.pq = ""; }
  if (!out.fn) out.pq = "";
  if (out.classe === "verbo" && out.lema) {
    const sep = sepParticle(text, k, notesW), lema = out.lema.toLocaleLowerCase("de").replace(/^sich\s+/, "");
    const p = [...RD_PARTICLES].filter(x => lema.startsWith(x) && lema.length > x.length + 2).sort((a, b) => b.length - a.length)[0];
    const fused = p && word.toLocaleLowerCase("de").startsWith(p);
    if (p && !sep && !fused && !/zu\p{L}/u.test(word.toLocaleLowerCase("de"))) {
      const e = notesW && notesW[word.toLocaleLowerCase("de")];
      const base = e && e[0] && !e[0].toLocaleLowerCase("de").startsWith(p) ? e[0] : lema.slice(p.length);
      if (out.parte && out.parte.toLocaleLowerCase("de").replace(/^sich\s+/, "") === lema) out.parte = "";
      out.lema = base;
      if (/separ/i.test(out.obs || "")) out.obs = "";
    }
  }
  return out;
}
function occurrence(i, k) {
  const s = reading.order[i], o = reading.book.notes && reading.book.notes.o;
  return (o && o[s.id] && o[s.id][k]) || null;
}
function exprKey(ks) { return ks.slice().sort((a, b) => a - b).join("-"); }
function exprNote(i, ks) {
  const s = reading.order[i], x = reading.book.notes && reading.book.notes.x;
  return (x && x[s.id] && x[s.id][exprKey(ks)]) || null;
}
function llmReady() {
  if (convAvailable() && !conv.status && !reading.statusAsked) { reading.statusAsked = true; window.satzDesktop.convStatus().then(st => { conv.status = st; }).catch(() => {}); }
  return convAvailable() && !(conv.status && conv.status.installed === false);
}
function markedSentence(text, ks) {
  let k = 0;
  return sentenceWords(text).map(p => /^[\p{L}\p{N}]/u.test(p) ? (ks.includes(k++) ? "[[" + p + "]]" : p) : p).join("");
}
function nearText(i) {
  const prev = reading.order[i - 1], next = reading.order[i + 1];
  return (prev && !prev.h ? "Previous sentence: " + prev.text + "\n" : "") + (next && !next.h ? "Next sentence: " + next.text + "\n" : "");
}
/* Pede à IA local o sentido da palavra nesta frase. Não bloqueia a leitura: o painel atualiza quando chegar. */
function requestGloss(i, k, word) {
  const s = reading.order[i], key = "o|" + s.id + "|" + k, bookId = reading.book.id;
  if (occurrence(i, k) || rdPending.has(key) || !llmReady()) return;
  const sys = rdGlossSystem(convLevel());
  const user = nearText(i) + "Sentence: " + markedSentence(s.text, [k]);
  const job = window.satzDesktop.convChat([{role: "system", content: sys}, {role: "user", content: user}], {kind: "gloss", temperature: .1, maxTokens: 400, schema: RD_GLOSS_SCHEMA})
    .then(r => rdGlossApply(r, s, i, k, word, bookId))
    .catch(e => { reading.glossError = cleanIpcError(e, "a IA não respondeu"); })
    .finally(() => { rdPending.delete(key); if (reading.book && reading.sel === i && reading.wk === k) { renderDetail(); refreshReaderPop(); } });
  rdPending.set(key, job);
}
/* Lê a resposta da IA sobre a palavra e grava (com as correções de fixGloss), a não ser que você já tenha corrigido. */
function rdGlossApply(r, s, i, k, word, bookId) {
  const j = parseLooseJson(r.text);
  if (!j || !j.pt || !reading.book || reading.book.id !== bookId) return;
  const o = bookNotes().o;
  if (o[s.id] && o[s.id][k] && o[s.id][k].fix) return;
  (o[s.id] = o[s.id] || {})[k] = rdGlossFromJson(j, s.text, k, word, reading.book.notes && reading.book.notes.w);
  scheduleNotesSave();
}
function rdGlossFromJson(j, text, k, word, notesW) {
  const c = v => convClean(v || "");
  return fixGloss(text, k, word, {w: word, pt: c(j.pt), lema: c(j.lema), classe: RD_CLASSES.includes(j.classe) ? j.classe : "", flex: c(j.flexao),
    gen: ["der", "die", "das"].includes(j.genero) ? j.genero : "", pl: c(j.plural), caso: c(j.caso), parte: c(j.parte),
    fn: RD_FUNCS.includes(j.funcao) ? j.funcao : "", pq: c(j.porque), obs: c(j.obs)}, notesW);
}
function rdGlossSystem(level) {
  return "You explain one word in a German sentence to Luiz, a Brazilian learner (level " + level + "). The word is marked with [[ ]]. Answer as JSON:\n"
    + "- pt: what the word means IN THIS SENTENCE, in Brazilian Portuguese (1 to 5 words). If it is part of a separable verb or a fixed expression, give the meaning of the whole here.\n"
    + "- lema: dictionary form (nouns with article, e.g. \"die Bank\"; verbs in the infinitive, separable verbs complete, e.g. \"anrufen\"; adjectives in the base form).\n"
    + "- classe: word class, in Portuguese.\n"
    + "- flexao: short Portuguese description of this form, e.g. \"Präteritum, 3ª pessoa do singular\", \"particípio passado\", \"plural\", \"comparativo\"; empty for the base form.\n"
    + "- genero: for nouns only: der, die or das (the gender of the noun itself); otherwise empty.\n"
    + "- plural: for nouns only: the plural with article, e.g. \"die Bänke\"; otherwise empty.\n"
    + "- caso: for nouns, pronouns and articles: the case in THIS sentence; otherwise empty. The case depends on the sentence, the gender does not.\n"
    + "- parte: if the word belongs to a separable verb or a fixed multi-word expression in this sentence, its full dictionary form (e.g. \"anrufen\", \"sich kümmern um\"); otherwise empty.\n"
    + "- funcao: the function of the word in THIS sentence, from the list. For articles and adjectives, the function of the noun phrase they belong to. \"verbo conjugado\" = the finite verb (2nd position in a main clause); \"verbo no fim\" = infinitive, participle or a finite verb sent to the end by a subordinating conjunction (weil, dass, wenn…); \"predicativo\" = after sein/werden/bleiben (\"Er ist Arzt\"). Empty if not sure.\n"
    + "- porque: one short sentence in Portuguese linking the function to the form, e.g. \"quem recebe a ação → acusativo: der vira den\", \"vai para o fim por causa do weil\", \"depois de mit sempre dativo\". Empty if not sure.\n"
    + "- obs: at most one short, useful note in Portuguese, or empty.\nOnly write what you are sure is correct.";
}
function requestExpr(i, ks) {
  const s = reading.order[i], key = "x|" + s.id + "|" + exprKey(ks), bookId = reading.book.id;
  if (exprNote(i, ks) || rdPending.has(key) || !llmReady()) return;
  const {words} = sentenceTokens(s.text), chosen = ks.map(k => words[k]).join(" … ");
  const sys = "Luiz, a Brazilian learner of German (level " + convLevel() + "), selected some words in a sentence of a book (marked with [[ ]]). Explain the expression they form in this sentence. Answer as JSON:\n"
    + "- expressao: the reusable dictionary form, e.g. \"sich um jemanden kümmern\", \"anrufen\", \"es geht um etwas\".\n"
    + "- pt: what it means IN THIS SENTENCE, in Brazilian Portuguese.\n"
    + "- uso: one or two short sentences in Portuguese about how it works (case, preposition, reflexive pronoun, separable prefix at the end, word order).\n"
    + "- exemplo: one short, simple, correct German example sentence, different from the book sentence.\n- exemplo_pt: its Brazilian Portuguese translation.\n"
    + "If the words do not form an expression, explain what each does in this sentence in \"uso\". Only write what you are sure is correct.";
  const user = nearText(i) + "Sentence: " + markedSentence(s.text, ks) + "\nSelected: " + chosen;
  const job = window.satzDesktop.convChat([{role: "system", content: sys}, {role: "user", content: user}], {kind: "expr", temperature: .1, maxTokens: 400, schema: RD_EXPR_SCHEMA})
    .then(r => {
      const j = parseLooseJson(r.text);
      if (!j || !j.pt || !reading.book || reading.book.id !== bookId) return;
      const c = v => convClean(v || ""), x = bookNotes().x, kk = exprKey(ks);
      if (x[s.id] && x[s.id][kk] && x[s.id][kk].fix) return;
      (x[s.id] = x[s.id] || {})[kk] = {expr: c(j.expressao), pt: c(j.pt), uso: c(j.uso), ex: c(j.exemplo), exPt: c(j.exemplo_pt)};
      scheduleNotesSave();
    })
    .catch(e => { reading.glossError = cleanIpcError(e, "a IA não respondeu"); })
    .finally(() => { rdPending.delete(key); if (reading.book && reading.sel === i && exprKey(reading.pick || []) === exprKey(ks)) { renderDetail(); refreshReaderPop(); } });
  rdPending.set(key, job);
}
/* Bloco “Nesta frase” do painel da palavra: sentido, forma de dicionário, flexão, gênero/plural × caso, verbo separável. */
function occurrenceBlock(i, k, word, compact) {
  if (i < 0 || k < 0) return null;
  const s = reading.order[i], occ = occurrence(i, k), pending = rdPending.has("o|" + s.id + "|" + k);
  if (!occ && !pending) requestGloss(i, k, word);
  const sep = sepParticle(s.text, k, reading.book.notes && reading.book.notes.w);
  const sepBtn = sep ? h("button", {class: "quiet small", type: "button", title: "Juntar as partes e explicar como expressão",
    onclick: () => { reading.pick = [k, sep.k].sort((a, b) => a - b); reading.word = ""; reading.wk = -1; highlightSentence(i); renderDetail(); refreshReaderPop(); requestExpr(i, reading.pick); }},
    "🔗 " + word + " … " + sep.particle + (sep.verb ? " → " + sep.verb : "")) : null;
  if (!occ) return h("div", {class: "rd-occ"},
    h("p", {class: "muted small-text", text: pending || (llmReady() && !reading.glossError) ? "Analisando o sentido nesta frase… (pode continuar lendo)" : llmReady() ? "A IA não respondeu agora. " : "Sem a IA do computador: veja o dicionário do livro abaixo."}),
    sepBtn);
  const noun = occ.gen || occ.pl;
  return h("div", {class: "rd-occ"},
    h("p", {class: "rd-occ-label muted small-text", text: occ.fix ? "Nesta frase (corrigido por você):" : "Nesta frase:"}),
    h("p", {class: "rd-meaning", text: occ.pt}),
    occ.lema ? h("p", null, h("span", {lang: "de", class: "rd-lemma", text: occ.lema}), occ.classe ? h("span", {class: "muted small-text", text: " · " + occ.classe}) : null) : null,
    occ.flex ? h("p", {class: "small-text", text: word + " = " + occ.flex}) : null,
    noun ? h("p", {class: "small-text"}, h("span", {class: "muted", text: "Da palavra: "}), [occ.gen ? "gênero " + occ.gen : "", occ.pl ? "plural " + occ.pl : ""].filter(Boolean).join(" · "),
      occ.caso ? h("span", null, h("span", {class: "muted", text: " · nesta frase: "}), occ.caso) : null) : occ.caso ? h("p", {class: "small-text", text: "Caso nesta frase: " + occ.caso}) : null,
    occ.parte ? h("p", {class: "small-text"}, h("span", {class: "muted", text: "Faz parte de: "}), h("b", {lang: "de", text: occ.parte})) : null,
    occ.fn ? h("p", {class: "small-text rd-fn"}, h("span", {class: "muted", text: "Função na frase: "}), h("b", {text: occ.fn}), occ.pq ? h("span", {class: "muted", text: " — " + occ.pq}) : null) : null,
    !compact && occ.obs ? h("p", {class: "muted small-text", text: occ.obs}) : null,
    h("div", {class: "row"}, sepBtn, compact ? null : h("button", {class: "quiet small", type: "button", onclick: e => e.currentTarget.closest(".rd-occ").replaceWith(occEditor(i, k, word, occ))}, "Corrigir")));
}
/* Correção pelo usuário: fica salva e a IA não sobrescreve mais. */
function occEditor(i, k, word, occ) {
  const f = (label, key) => { const el = h("input", {type: "text", value: occ[key] || "", lang: key === "lema" || key === "parte" ? "de" : null}); el.dataset.key = key; return h("div", {class: "field"}, h("label", {text: label}), el); };
  const box = h("div", {class: "rd-occ rd-edit"},
    f("Sentido nesta frase", "pt"), f("Forma de dicionário", "lema"), f("Flexão", "flex"), f("Caso nesta frase", "caso"), f("Função na frase", "fn"), f("Por quê", "pq"), f("Faz parte de", "parte"), f("Observação", "obs"),
    h("div", {class: "row"},
      h("button", {class: "primary small", type: "button", onclick: () => {
        const s = reading.order[i], o = bookNotes().o, v = {...occ, w: word, fix: true};
        for (const el of box.querySelectorAll("input")) v[el.dataset.key] = el.value.trim();
        if (!v.pt) { setStatus("Escreva pelo menos o sentido.", "error"); return; }
        (o[s.id] = o[s.id] || {})[k] = v;
        scheduleNotesSave(); renderDetail(); refreshReaderPop();
      }}, "Salvar correção"),
      h("button", {class: "quiet small", type: "button", onclick: () => renderDetail()}, "Cancelar")));
  return box;
}
/* Painel da expressão marcada (Ctrl + clique ou “Marcar expressão”). */
function exprDetail(i, ks, compact) {
  const s = reading.order[i], {words} = sentenceTokens(s.text), chosen = ks.map(k => words[k]).filter(Boolean);
  const note = exprNote(i, ks), pending = rdPending.has("x|" + s.id + "|" + exprKey(ks));
  if (ks.length >= 2 && !note && !pending) requestExpr(i, ks);
  const saved = isExprSaved(i, ks);
  return h("section", {class: "rd-word"},
    h("div", {class: "row between"}, h("b", {class: "rd-word-form", lang: "de", text: chosen.join(" … ")}),
      h("button", {class: "quiet small", type: "button", onclick: () => { reading.pick = []; reading.picking = false; renderBook(); }}, "Desmarcar")),
    ks.length < 2 ? h("p", {class: "muted small-text", text: "Toque em mais palavras da mesma frase (Ctrl + clique, ou com “Marcar expressão” ligado)."}) : null,
    note ? h("div", {class: "rd-occ"},
      note.expr ? h("p", null, h("b", {lang: "de", class: "rd-lemma", text: note.expr})) : null,
      h("p", {class: "rd-meaning", text: note.pt}),
      !compact && note.uso ? h("p", {class: "small-text", text: note.uso}) : null,
      !compact && note.ex ? h("p", {class: "small-text"}, h("span", {lang: "de", text: note.ex}), note.exPt ? h("span", {class: "muted", text: " — " + note.exPt}) : null) : null)
      : ks.length >= 2 ? h("p", {class: "muted small-text", text: pending ? "Explicando a expressão… (pode continuar lendo)" : llmReady() ? "A IA não respondeu agora." : "Explicar expressões precisa da IA do computador."}) : null,
    ks.length >= 2 ? h("div", {class: "row"},
      h("button", {class: saved ? "small" : "primary small", type: "button", disabled: saved, onclick: () => { saveExpr(i, ks, chosen, note); renderDetail(); refreshReaderPop(); }}, saved ? "★ Guardada" : "☆ Guardar a expressão"),
      reading.starts[i] != null ? h("button", {class: "quiet small", type: "button", onclick: () => playSentence(i)}, icon("volume", 16), "Ouvir a frase") : null) : null);
}
function exprStoreKey(i, ks) { return (reading.book.id + "|x:" + reading.order[i].id + ":" + exprKey(ks)).slice(0, BW_KEY_MAX); }
function isExprSaved(i, ks) { const v = bookWordsData().items[exprStoreKey(i, ks)]; return !!(v && !v.deleted); }
function saveExpr(i, ks, chosen, note) {
  const s = reading.order[i], now = Date.now();
  bookWordsData().items[exprStoreKey(i, ks)] = {t: "x", b: reading.book.id, w: chosen.join(" … "), lema: note ? note.expr : "", pt: note ? note.pt : "", uso: note ? note.uso : "",
    ks: exprKey(ks), s: s.text, sid: s.id, at: now, updatedAt: now, ok: 0};
  saveProgress();
  updateSavedCount();
}
/* “Estudar este trecho depois”: guarda a frase (com a tradução, se houver) para o modo de estudo. */
function passageKey(i) { return (reading.book.id + "|p:" + reading.order[i].id).slice(0, BW_KEY_MAX); }
function passageButton(i) {
  const k = passageKey(i), on = !!(bookWordsData().items[k] && !bookWordsData().items[k].deleted);
  return h("button", {class: "quiet small", type: "button", title: "Guarda este trecho para estudar com calma depois", onclick: () => {
    const d = bookWordsData(), now = Date.now(), s = reading.order[i], note = reading.book.notes && reading.book.notes.s && reading.book.notes.s[s.id];
    d.items[k] = on ? {deleted: true, updatedAt: now} : {t: "p", b: reading.book.id, w: "", s: s.text, sid: s.id, pt: note && note.pt || "", at: now, updatedAt: now, ok: 0};
    saveProgress(); updateSavedCount(); renderDetail(); refreshReaderPop();
    if (!on) toast("Trecho guardado para estudar depois.", "success");
  }}, on ? "✓ Estudar depois" : "📌 Estudar depois");
}
function updateSavedCount() { const btn = $("rdSavedBtn"); if (btn && reading.book) btn.textContent = "★ Guardados (" + savedWordsOf(reading.book.id).length + ")"; }
/* Conteúdo do balão do modo contínuo: o essencial e atalhos; o resto abre no painel. */
function readerPopContent() {
  const i = reading.sel;
  if (i < 0) return [];
  const close = h("button", {class: "icon-btn rd-pop-x", type: "button", title: "Fechar (Esc)", "aria-label": "Fechar", onclick: hideReaderPop}, "×");
  const more = h("button", {class: "quiet small", type: "button", title: "Abre o painel completo (tradução da frase, gramática, exemplos)",
    onclick: () => { reading.flow = false; saveReadingState({flow: false}); renderBook(); }}, "Mais detalhes");
  if ((reading.pick || []).length) return [close, exprDetail(i, reading.pick, true), h("div", {class: "row"}, more)];
  if (!reading.word) return [];
  const e = bookWordEntry(reading.word);
  return [close,
    h("div", {class: "row between"}, h("b", {class: "rd-word-form", lang: "de", text: reading.word}),
      h("div", {class: "row"}, h("button", {class: "icon-btn", type: "button", title: "Ouvir a palavra", "aria-label": "Ouvir a palavra", onclick: () => speak(reading.word)}, icon("volume", 18)), saveWordButton(reading.word))),
    occurrenceBlock(i, reading.wk, reading.word, true) || null,
    !occurrence(i, reading.wk) && e ? h("p", {class: "small-text"}, h("span", {lang: "de", class: "rd-lemma", text: e[0]}), " — " + (e[2] || "")) : null,
    h("div", {class: "row"}, reading.starts[i] != null ? h("button", {class: "quiet small", type: "button", onclick: () => playSentence(i)}, icon("volume", 16), "Frase") : null,
      passageButton(i), more)].filter(Boolean);
}
