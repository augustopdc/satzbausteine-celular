"use strict";
/* Leitura: livros importados (EPUB + audiolivro) com o áudio sincronizado frase a frase.
   Tocar numa palavra seleciona a frase, toca o trecho do áudio e mostra a palavra e a gramática da frase.
   Os livros ficam no processo principal (livros.cjs); aqui só a interface. */
const KEY_READING = "satzbausteine.reading.v1";
const reading = {books: [], book: null, ch: 0, order: [], byId: new Map(), starts: [], sel: -1, word: "", audio: null,
  playing: null, follow: false, raf: 0, rate: 1, clickPlays: true, ptMode: "painel", wordCount: null, articles: null, catalogWords: null, view: "text"};
const RD_PT_MODES = {painel: "Tradução no painel", pedir: "Tradução só quando pedir", abaixo: "Tradução embaixo", borrada: "Tradução borrada (toque)"};

function readingState() { return safeRead(KEY_READING, {}); }
function saveReadingState(patch) { const s = readingState(); safeWrite(KEY_READING, {...s, ...patch}); }
function bookPosition(id) { return (readingState().pos || {})[id] || null; }
function saveBookPosition() {
  const b = reading.book;
  if (!b) return;
  const s = readingState();
  s.pos = {...(s.pos || {}), [b.id]: {ch: reading.ch, sel: reading.sel, at: Date.now()}};
  safeWrite(KEY_READING, s);
}

// ---------- Biblioteca ----------
async function renderReading() {
  if (reading.book) { renderBook(); return; }
  await renderLibrary();
}
function syncStatusNode(b) {
  if (!b.audio) return h("div", {class: "book-status"}, h("span", {class: "muted", text: "Sem áudio."}),
    h("button", {class: "small", type: "button", onclick: () => addBookAudio(b.id)}, "Adicionar áudio"));
  // MP3 de taxa variável: o player pula para o lugar errado. A conversão mantém os tempos (a sincronização continua valendo).
  if (b.audio.vbr || b.audio.fixing) return h("div", {class: "book-status warn"},
    h("span", {class: "small-text", text: b.audio.fixing ? "Corrigindo o áudio… (1 a 2 minutos; pode continuar usando o app)"
      : "O áudio deste livro é de taxa variável (comum em áudio baixado da internet): ao tocar uma frase, o app pode cair na frase vizinha. Corrigir converte o áudio para taxa fixa; a sincronização já feita continua valendo."}),
    b.audio.fixing ? null : h("button", {class: "primary small", type: "button", onclick: async e => {
      e.currentTarget.disabled = true; b.audio.fixing = true; renderLibrary();
      try { await window.satzDesktop.fixBookAudio(b.id); setStatus("Áudio corrigido: agora cada frase toca do ponto certo.", "success"); }
      catch (err) { setStatus(cleanIpcError(err, "Não consegui corrigir o áudio."), "error"); }
      renderLibrary();
    }}, "Corrigir o áudio"));
  if (b.sync.state === "running") {
    const bar = h("span");
    setWidth(bar, b.sync.pct || 0);
    return h("div", {class: "book-status"}, h("span", {text: "Sincronizando o áudio com o texto… " + (b.sync.pct || 0) + "%"}),
      h("div", {class: "track"}, bar),
      h("span", {class: "muted small-text", text: "Pode continuar usando o app. Fechar o aplicativo interrompe a sincronização."}),
      h("button", {class: "quiet small", type: "button", onclick: () => window.satzDesktop.cancelAlign(b.id)}, "Cancelar"));
  }
  if (b.sync.state === "done") return h("div", {class: "book-status ok"},
    h("span", {text: "Áudio sincronizado · " + Math.round((b.sync.matched || 0) * 100) + "% das palavras reconhecidas"}));
  return h("div", {class: "book-status"},
    h("span", {class: "muted small-text", text: "O áudio ainda não está ligado ao texto. A sincronização roda neste computador e leva de 10 a 30 minutos por hora de áudio, conforme o uso do PC."}),
    h("button", {class: "primary small", type: "button", onclick: () => alignBook(b.id)}, "Sincronizar áudio"));
}
function bookCard(b) {
  const pos = bookPosition(b.id);
  return h("article", {class: "book-card"},
    h("div", {class: "book-top"}, h("h3", {lang: "de", text: b.title}), h("span", {class: "muted small-text", text: b.author && b.author !== "Unbekannt" ? b.author : ""})),
    h("p", {class: "muted small-text", text: b.chapters + " capítulos · " + (b.words || 0).toLocaleString("pt-BR") + " palavras" + (pos ? " · parou no capítulo " + (pos.ch + 1) : "")}),
    syncStatusNode(b),
    annotStatusNode(b),
    typeof rdBookCardDifficulty === "function" ? rdBookCardDifficulty(b) : null,
    typeof rdSendButton === "function" ? rdSendButton(b) : null,
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: () => openBook(b.id)}, pos ? "Continuar lendo" : "Abrir"),
      h("button", {class: "quiet small", type: "button", onclick: () => deleteBook(b.id)}, "Remover")));
}
async function renderLibrary() {
  const box = $("readingLibrary");
  $("readingBook").hidden = true;
  box.hidden = false;
  // Celular: os livros vêm do GitHub privado e ficam guardados no aparelho (leitura-celular.js).
  if (!window.satzDesktop || !window.satzDesktop.listBooks) {
    if (typeof rdWebLibrary === "function") return rdWebLibrary(box);
    fill(box, h("p", {class: "notice", text: "A leitura com áudio funciona no aplicativo do Windows."})); return;
  }
  try { reading.books = await window.satzDesktop.listBooks(); }
  catch (e) { reportError("livros", e.message, e.stack); reading.books = []; }
  fill(box,
    typeof rdDiaryNode === "function" ? rdDiaryNode() : null,
    h("div", {class: "row spaced-bottom"},
      h("button", {class: "primary", type: "button", onclick: importBook}, "Importar livro (EPUB + áudio)"),
      h("span", {class: "muted small-text", text: "Escolha o EPUB e, se tiver, o MP3 do audiolivro (os dois de uma vez). Os arquivos originais não são alterados."})),
    reading.books.length ? h("div", {class: "book-grid"}, ...reading.books.map(bookCard))
      : h("p", {class: "empty", text: "Nenhum livro ainda. Importe um EPUB com o audiolivro: o app sincroniza o áudio com o texto e você lê ouvindo, frase por frase."}));
}
async function importBook() {
  try {
    setStatus("Escolha o EPUB e o áudio. Se o áudio precisar de ajuste, a importação leva 1 a 2 minutos.", "info");
    const b = await window.satzDesktop.importBook();
    if (!b) return;
    setStatus("Livro importado: " + b.title + ".", "success");
    await renderLibrary();
    if (b.audio && b.sync.state === "none") alignBook(b.id);
  } catch (e) { setStatus(cleanIpcError(e, "Não consegui importar o livro."), "error"); }
}
async function addBookAudio(id) {
  try { const b = await window.satzDesktop.addBookAudio(id); if (b) { await renderLibrary(); alignBook(id); } }
  catch (e) { setStatus(cleanIpcError(e, "Não consegui adicionar o áudio."), "error"); }
}
async function alignBook(id) {
  try { await window.satzDesktop.alignBook(id); if (currentView === "reading" && !reading.book) renderLibrary(); }
  catch (e) { setStatus(cleanIpcError(e, "Não consegui iniciar a sincronização."), "error"); }
}
async function deleteBook(id) {
  try {
    if (await window.satzDesktop.deleteBook(id)) {
      const s = readingState();
      if (s.pos) { delete s.pos[id]; safeWrite(KEY_READING, s); }
      setStatus("Livro removido.", "success");
      renderLibrary();
    }
  } catch (e) { setStatus(cleanIpcError(e, "Não consegui remover o livro."), "error"); }
}
function cleanIpcError(e, fallback) {
  const msg = String(e && e.message || "").replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
  return msg || fallback;
}
function onBookProgress(data) {
  const b = reading.books.find(x => x.id === data.id);
  if (b) {
    if (data.state === "running") b.sync = {state: "running", pct: data.pct};
    else if (data.state === "done") b.sync = {state: "done", matched: data.matched};
    else b.sync = {state: "none"};
  }
  if (data.state === "done") setStatus("Áudio do livro sincronizado. Toque numa frase para ouvir.", "success");
  if (data.state === "error") setStatus(data.message || "A sincronização falhou.", "error");
  if (currentView === "reading") {
    if (!reading.book) renderLibrary();
    else if (reading.book.id === data.id && data.state === "done") openBook(data.id, true);
  }
}

// ---------- Livro aberto ----------
async function openBook(id, keepPlace) {
  let book;
  try { book = window.satzDesktop ? await window.satzDesktop.getBook(id) : await rdWebGetBook(id); }
  catch (e) { setStatus(cleanIpcError(e, "Não consegui abrir o livro."), "error"); return; }
  stopReadingAudio();
  const prevCh = reading.ch, prevSel = reading.sel;
  reading.book = book;
  reading.order = [];
  reading.byId = new Map();
  book.chapters.forEach((ch, ci) => ch.blocks.forEach((b, bi) => b.s.forEach(([sid, text]) => {
    reading.byId.set(sid, reading.order.length);
    reading.order.push({id: sid, text, ch: ci, h: b.h, block: bi});
  })));
  const starts = (book.sync && book.sync.starts) || {};
  reading.starts = reading.order.map(s => Number.isFinite(starts[s.id]) ? starts[s.id] : null);
  reading.wordCount = reading.articles = null;
  reading.audio = new Audio();
  reading.audio.preload = "metadata";
  // No PC, um arquivo para o livro todo; no celular, um por capítulo (book.parts, com o início de cada um no tempo do livro).
  reading.partIdx = -1;
  if (book.audio && !book.parts) reading.audio.src = "livro/" + book.id + "/audio";
  reading.audio.addEventListener("ended", () => {
    const parts = book.parts, next = reading.partIdx + 1;
    // Lendo ouvindo no celular: o capítulo acabou, segue para o arquivo do próximo (menos no ciclo, que para no fim do capítulo).
    if (parts && reading.follow && !reading.cycle && next < parts.length) { rdSeek(parts[next].start).then(() => { reading.audio.play().catch(() => {}); tickReading(); }); return; }
    reading.follow = false; reading.playing = null; updateReaderControls();
    if (reading.cycle && typeof rdCycleChapterEnd === "function") rdCycleChapterEnd();
  });
  reading.cycle = null;
  const pos = keepPlace ? {ch: prevCh, sel: prevSel} : bookPosition(id);
  reading.ch = pos && pos.ch < book.chapters.length ? pos.ch : 0;
  reading.sel = pos && pos.sel >= 0 && pos.sel < reading.order.length ? pos.sel : -1;
  reading.word = "";
  const s = readingState();
  reading.rate = Number(s.rate) || 1;
  reading.clickPlays = s.clickPlays !== false;
  reading.ptMode = RD_PT_MODES[s.ptMode] ? s.ptMode : s.showPt ? "abaixo" : "painel";
  reading.flow = !!s.flow;
  reading.fs = Math.min(1.8, Math.max(.9, Number(s.fs) || 1.14));
  reading.lh = [1.6, 1.85, 2.15].includes(Number(s.lh)) ? Number(s.lh) : 1.85;
  reading.pick = []; reading.wk = -1; reading.picking = false;
  reading.view = "text";
  renderBook();
  if (reading.sel >= 0) requestAnimationFrame(() => scrollToSentence(reading.sel, "center"));
}
function closeBook() {
  saveBookPosition();
  stopReadingAudio();
  reading.book = null;
  reading.cycle = null;
  renderLibrary();
}
function hasSync() { return !!(reading.book && reading.book.audio && reading.book.sync); }
function chapterRange(ci) {
  let a = -1, b = -1;
  reading.order.forEach((s, i) => { if (s.ch === ci) { if (a < 0) a = i; b = i; } });
  return [a, b];
}
function renderBook() {
  const book = reading.book;
  reading.view = "text";
  $("readingLibrary").hidden = true;
  $("readingBook").hidden = false;
  // Cada capítulo mostra quanto das palavras o app já ensina até o seu nível (leitura-extra.js).
  const chapterSelect = h("select", {id: "rdChapter", "aria-label": "Capítulo"}, ...book.chapters.map((c, i) => new Option((i + 1) + ". " + c.title + (typeof rdChapterSuffix === "function" ? rdChapterSuffix(i) : ""), String(i))));
  chapterSelect.value = String(reading.ch);
  chapterSelect.addEventListener("change", () => { reading.ch = Number(chapterSelect.value); reading.sel = -1; reading.cycle = null; stopReadingAudio(); renderBook(); window.scrollTo({top: 0}); saveBookPosition(); });
  const speed = h("select", {id: "rdSpeed", "aria-label": "Velocidade"}, ...[[.75, "0,75×"], [.9, "0,9×"], [1, "1×"], [1.1, "1,1×"]].map(([v, l]) => new Option(l, String(v))));
  speed.value = String(reading.rate);
  speed.addEventListener("change", () => { reading.rate = Number(speed.value); if (reading.audio) reading.audio.playbackRate = reading.rate; saveReadingState({rate: reading.rate}); });
  const notes = book.notes && book.notes.s;
  // Tradução: no painel (ao tocar), no painel só quando pedir (para se testar), embaixo de cada frase, ou embaixo mas borrada.
  const ptMode = h("select", {id: "rdPtMode", "aria-label": "Tradução", title: "Onde mostrar a tradução"},
    ...Object.entries(RD_PT_MODES).map(([k, l]) => new Option(l, k)));
  ptMode.value = reading.ptMode;
  ptMode.addEventListener("change", () => { reading.ptMode = ptMode.value; saveReadingState({ptMode: reading.ptMode}); renderBook(); });
  const bar = h("div", {class: "reader-bar"},
    h("button", {class: "quiet small", type: "button", onclick: closeBook}, "← Livros"),
    chapterSelect,
    h("div", {class: "reader-controls"},
      h("button", {class: "icon-btn", type: "button", title: "Frase anterior (←)", "aria-label": "Frase anterior", onclick: () => stepSentence(-1)}, "⏮"),
      h("button", {id: "rdPlay", class: "primary small", type: "button", title: "Ler acompanhando o áudio (Espaço)", onclick: toggleFollow}, "▶ Ler ouvindo"),
      h("button", {class: "icon-btn", type: "button", title: "Próxima frase (→)", "aria-label": "Próxima frase", onclick: () => stepSentence(1)}, "⏭"),
      h("button", {class: "small", type: "button", title: "Repetir a frase (R)", onclick: () => reading.sel >= 0 && playSentence(reading.sel)}, "Repetir"),
      speed),
    h("label", {class: "inline-check", title: "Toca a frase quando você escolhe outra frase"}, h("input", {type: "checkbox", checked: reading.clickPlays, onchange: e => { reading.clickPlays = e.target.checked; saveReadingState({clickPlays: reading.clickPlays}); }}), "Tocar ao clicar"),
    notes ? ptMode : null,
    h("div", {class: "reader-controls"},
      h("label", {class: "inline-check", title: "Tela limpa: a consulta abre num balão ao lado da palavra, sem o painel lateral"},
        h("input", {id: "rdFlow", type: "checkbox", checked: reading.flow, onchange: e => { reading.flow = e.target.checked; saveReadingState({flow: reading.flow}); renderBook(); }}), "Leitura contínua"),
      h("button", {class: "icon-btn", type: "button", title: "Letra menor", "aria-label": "Letra menor", onclick: () => setReaderLook(-.08, 0)}, "A−"),
      h("button", {class: "icon-btn", type: "button", title: "Letra maior", "aria-label": "Letra maior", onclick: () => setReaderLook(.08, 0)}, "A+"),
      h("button", {class: "icon-btn", type: "button", title: "Espaçamento entre linhas", "aria-label": "Espaçamento entre linhas", onclick: () => setReaderLook(0, 1)}, "↕"),
      h("button", {id: "rdPickBtn", class: "quiet small" + (reading.picking ? " on" : ""), type: "button", title: "Toque em várias palavras da mesma frase para explicar a expressão (ou use Ctrl + clique)",
        onclick: () => { reading.picking = !reading.picking; if (!reading.picking) reading.pick = []; renderBook(); }}, reading.picking ? "✓ Marcando expressão" : "Marcar expressão")),
    h("div", {class: "reader-controls"},
      h("button", {class: "small", type: "button", title: "Vocabulário, tradução de volta, ditado, lacunas e conversa sobre este capítulo", onclick: () => renderBookPractice()}, "🎯 Praticar o capítulo"),
      h("button", {id: "rdSavedBtn", class: "quiet small", type: "button", onclick: () => renderSavedWords()}, "★ Guardados (" + savedWordsOf(book.id).length + ")")));
  const warn = !book.audio ? "Este livro não tem áudio. Adicione o MP3 na lista de livros para ouvir frase por frase."
    : !book.sync ? (book.status && book.status.sync.state === "running" ? "Sincronizando o áudio (" + book.status.sync.pct + "%). Quando terminar, as frases ficam clicáveis para ouvir." : "O áudio ainda não foi sincronizado. Volte à lista de livros e toque em “Sincronizar áudio”.") : "";
  const [a, b] = chapterRange(reading.ch);
  const text = h("div", {id: "rdText", class: "reader-text", lang: "de"});
  // Bloco a bloco: título, parágrafo (frases) ou ilustração do livro.
  for (const blk of book.chapters[reading.ch].blocks) {
    if (blk.img) {
      if (typeof rdImageUrl === "function") text.append(h("figure", {class: "rd-fig"}, h("img", {src: rdImageUrl(book, blk.img), alt: blk.alt || "", loading: "lazy"})));
      continue;
    }
    let para = null;
    for (const [sid] of blk.s) {
      const i = reading.byId.get(sid), s = reading.order[i];
      if (s.h) { text.append(h("h2", {class: "rd-h"}, sentenceNode(i))); continue; }
      if (!para) { para = h("p", {class: "rd-p"}); text.append(para); } else para.append(" ");
      para.append(sentenceNode(i));
      if ((reading.ptMode === "abaixo" || reading.ptMode === "borrada") && notes && notes[s.id] && notes[s.id].pt)
        para.append(h("span", {class: "rd-pt" + (reading.ptMode === "borrada" ? " blur" : ""), lang: "pt-BR", title: reading.ptMode === "borrada" ? "Toque para ver a tradução" : null, text: " " + notes[s.id].pt}));
    }
  }
  const last = reading.ch === book.chapters.length - 1;
  text.append(h("div", {class: "row center rd-end"},
    h("button", {type: "button", onclick: markChapterRead}, "Capítulo lido ✓"),
    last ? null : h("button", {class: "primary", type: "button", onclick: () => { reading.ch++; reading.sel = -1; reading.cycle = null; stopReadingAudio(); renderBook(); window.scrollTo({top: 0}); saveBookPosition(); }}, "Próximo capítulo →")));
  text.addEventListener("click", onReaderClick);
  applyReaderLook(text);
  hideReaderPop();
  fill($("readingBook"),
    h("div", {class: "reader-head"}, h("p", {class: "eyebrow"}, h("span", {lang: "de", text: book.title}), " · capítulo " + (reading.ch + 1) + " de " + book.chapters.length)),
    bar,
    warn ? h("p", {class: "notice warn", text: warn}) : null,
    // Resumo do capítulo (anotação): para ler antes; já aberto no 1º passo do ouvir → ler → ouvir.
    book.notes && book.notes.c && book.notes.c[reading.ch] ? h("details", {class: "rd-summary", open: !!(reading.cycle && reading.cycle.step === 1)},
      h("summary", {text: "Resumo do capítulo (para ler antes)"}), h("p", {text: book.notes.c[reading.ch]})) : null,
    typeof rdCycleBanner === "function" ? rdCycleBanner() : null,
    h("div", {class: "reader" + (reading.flow ? " flow" : "") + (typeof rdCycleHides === "function" && rdCycleHides() ? " cycle-hide" : "")}, text, h("aside", {id: "rdDetail", class: "reader-detail panel", hidden: reading.flow}, detailPlaceholder())));
  if (reading.sel >= a && reading.sel <= b) { highlightSentence(reading.sel); renderDetail(); }
  updateReaderControls();
}
/* Palavras da frase com o índice (k) de cada uma: é a chave do significado por ocorrência e das expressões. */
function sentenceWords(text) { return text.split(/([\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*)/u); }
function sentenceNode(i) {
  const span = h("span", {class: "rd-s" + (reading.starts[i] == null ? " nosync" : ""), dataset: {i: String(i)}});
  let k = 0;
  for (const part of sentenceWords(reading.order[i].text)) {
    if (!part) continue;
    if (/^[\p{L}\p{N}]/u.test(part)) span.append(h("span", {class: "rd-w", text: part, dataset: {k: String(k++)}})); else span.append(part);
  }
  return span;
}
function detailPlaceholder() {
  return h("p", {class: "muted small-text", text: "Toque numa palavra: a frase toca uma vez e aqui aparecem a palavra, a frase e a gramática. Outras palavras da mesma frase não repetem o áudio; para ouvir de novo, toque no espaço entre as palavras, em “Ouvir” ou aperte R. Teclado: Espaço lê ouvindo, ← → trocam de frase, D devagar."});
}
/* Clique no texto: palavra da frase que já está escolhida só mostra a palavra (não relê a frase);
   frase nova toca o trecho; clique fora das palavras (espaço, pontuação) repete a frase.
   Lendo ouvindo, o clique só mostra a palavra e o áudio segue. */
function onReaderClick(e) {
  const pt = e.target.closest(".rd-pt");
  if (pt) { pt.classList.toggle("shown"); return; }
  const s = e.target.closest(".rd-s");
  if (!s) return;
  const i = Number(s.dataset.i), w = e.target.closest(".rd-w"), word = w ? w.textContent : "", k = w ? Number(w.dataset.k) : -1;
  const same = i === reading.sel;
  // Ctrl/Shift + clique (ou o modo “Marcar expressão”) junta palavras da mesma frase numa expressão.
  if (w && (e.ctrlKey || e.shiftKey || e.metaKey || reading.picking)) {
    if (!same) reading.pick = [];
    reading.pick = reading.pick.includes(k) ? reading.pick.filter(x => x !== k) : [...reading.pick, k].sort((a, b) => a - b);
    reading.sel = i; reading.word = ""; reading.wk = -1;
    highlightSentence(i); renderDetail(); hideReaderPop();
    if (reading.flow && reading.pick.length) showReaderPop(w);
    return;
  }
  reading.pick = [];
  const listening = reading.follow && reading.audio && !reading.audio.paused;
  if (listening) { reading.word = word; reading.wk = k; if (!same) reading.sel = i; highlightSentence(i); renderDetail(); if (reading.flow && w) showReaderPop(w); return; }
  selectSentence(i, word, k);
  if (reading.flow) { if (w) showReaderPop(w); else hideReaderPop(); }
  if (!reading.clickPlays) return;
  if (!same || !word) playSentence(i);
}
function selectSentence(i, word, k = -1) {
  reading.sel = i;
  reading.word = word || "";
  reading.wk = word ? k : -1;
  if (!word) reading.pick = [];
  highlightSentence(i);
  renderDetail();
  saveBookPosition();
}
function highlightSentence(i) {
  for (const el of all("#rdText .rd-s.on")) el.classList.remove("on");
  const el = document.querySelector('#rdText .rd-s[data-i="' + i + '"]');
  if (el) el.classList.add("on");
  for (const el2 of all("#rdText .rd-w.on, #rdText .rd-w.pick")) el2.classList.remove("on", "pick");
  if (!el) return;
  const ws = [...el.querySelectorAll(".rd-w")];
  if (reading.word) {
    const hit = ws.find(w => Number(w.dataset.k) === reading.wk) || ws.find(w => w.textContent === reading.word);
    if (hit) hit.classList.add("on");
  }
  for (const k of reading.pick || []) if (ws[k]) ws[k].classList.add("pick");
}
/* Modo contínuo: consulta rápida num balão ao lado da palavra, sem painel lateral e sem mexer na rolagem. */
function showReaderPop(anchor) {
  hideReaderPop();
  if (typeof readerPopContent !== "function") return;
  const pop = h("div", {id: "rdPop", class: "rd-pop panel", role: "dialog"}, ...readerPopContent());
  document.body.append(pop);
  // Posição absoluta na página: o balão acompanha o texto quando você rola.
  const r = anchor.getBoundingClientRect(), pw = Math.min(360, window.innerWidth - 24);
  pop.style.width = pw + "px";
  pop.style.left = (window.scrollX + Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2))) + "px";
  const ph = pop.offsetHeight, below = r.bottom + 10 + ph < window.innerHeight - 8;
  pop.style.top = (window.scrollY + (below ? r.bottom + 10 : Math.max(8, r.top - ph - 10))) + "px";
  reading.popAnchor = anchor;
}
document.addEventListener("click", e => {
  const pop = document.getElementById("rdPop");
  if (pop && !pop.contains(e.target) && !e.target.closest("#rdText")) hideReaderPop();
});
function hideReaderPop() { const p = document.getElementById("rdPop"); if (p) p.remove(); }
function refreshReaderPop() {
  const pop = document.getElementById("rdPop");
  if (!pop || typeof readerPopContent !== "function") return;
  if (reading.popAnchor && document.contains(reading.popAnchor)) showReaderPop(reading.popAnchor); else fill(pop, ...readerPopContent());
}
function setReaderLook(dfs, dlh) {
  if (dfs) reading.fs = Math.round(Math.min(1.8, Math.max(.9, reading.fs + dfs)) * 100) / 100;
  if (dlh) { const steps = [1.6, 1.85, 2.15]; reading.lh = steps[(steps.indexOf(reading.lh) + 1) % steps.length]; }
  saveReadingState({fs: reading.fs, lh: reading.lh});
  applyReaderLook($("rdText"));
  hideReaderPop();
}
function applyReaderLook(text) {
  if (!text) return;
  text.style.fontSize = reading.fs + "rem";
  text.style.lineHeight = String(reading.lh);
}
function scrollToSentence(i, block = "nearest") {
  const el = document.querySelector('#rdText .rd-s[data-i="' + i + '"]');
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (block === "center" || r.top < 110 || r.bottom > window.innerHeight - 40) el.scrollIntoView({block: "center", behavior: "smooth"});
}

// ---------- Palavra e frase ----------
function bookWordStats() {
  if (reading.wordCount) return;
  const counts = new Map(), arts = new Map();
  for (const s of reading.order) {
    for (const m of s.text.matchAll(/[\p{L}\p{N}]+/gu)) { const k = normWord(m[0]); counts.set(k, (counts.get(k) || 0) + 1); }
    for (const m of s.text.matchAll(/\b(der|die|das|ein|eine)\s+(\p{Lu}[\p{L}-]+)/gu)) {
      const key = m[2], art = m[1].toLowerCase() === "ein" ? "der/das" : m[1].toLowerCase() === "eine" ? "die" : m[1].toLowerCase();
      const map = arts.get(key) || new Map();
      map.set(art, (map.get(art) || 0) + 1);
      arts.set(key, map);
    }
  }
  reading.wordCount = counts;
  reading.articles = arts;
}
function catalogWithWord(word) {
  if (!reading.catalogWords) {
    reading.catalogWords = new Map();
    for (const c of cards) for (const m of c.frase.matchAll(/[\p{L}]+/gu)) {
      const k = normWord(m[0]);
      const list = reading.catalogWords.get(k) || [];
      if (list.length < 6 && !list.includes(c)) list.push(c);
      reading.catalogWords.set(k, list);
    }
  }
  return (reading.catalogWords.get(normWord(word)) || []).slice(0, 3);
}
function wordDetail(word, i = reading.sel, wk = reading.wk) {
  bookWordStats();
  const notes = reading.book.notes && reading.book.notes.w, k = normWord(word);
  const entry = notes && (notes[word] || notes[word.toLocaleLowerCase("de")] || notes[k]);
  const arts = reading.articles.get(word);
  const artText = arts ? [...arts.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => a + " " + word + (n > 1 ? " (" + n + "×)" : "")).join(" · ") : "";
  const examples = catalogWithWord(word);
  return h("section", {class: "rd-word"},
    h("div", {class: "row between"}, h("b", {class: "rd-word-form", lang: "de", text: word}),
      h("div", {class: "row"}, h("button", {class: "icon-btn", type: "button", title: "Ouvir a palavra", "aria-label": "Ouvir a palavra", onclick: () => speak(word)}, icon("volume", 18)),
        typeof saveWordButton === "function" ? saveWordButton(word) : null)),
    typeof occurrenceBlock === "function" ? occurrenceBlock(i, wk, word) : null,
    entry ? h("p", {class: "small-text"}, h("span", {class: "muted", text: "Dicionário do livro: "}), h("span", {lang: "de", class: "rd-lemma", text: entry[0]}), entry[1] ? h("span", {class: "muted", text: " · " + entry[1]}) : null) : null,
    entry && entry[2] ? h("p", {class: "small-text", text: entry[2]}) : null,
    entry && entry[3] ? h("p", {class: "muted small-text", text: entry[3]}) : null,
    artText ? h("p", {class: "small-text"}, h("span", {class: "muted", text: "Com artigo no livro: "}), h("span", {lang: "de", text: artText})) : null,
    h("p", {class: "muted small-text", text: "Aparece " + (reading.wordCount.get(k) || 1) + "× no livro."}),
    examples.length ? h("div", {class: "rd-examples"}, h("span", {class: "muted small-text", text: "No seu catálogo:"}),
      ...examples.map(c => h("p", {class: "small-text"}, h("b", {lang: "de", text: c.frase}), h("span", {class: "muted", text: " — " + c.traducao})))) : null);
}
function bookGrammar(i) {
  const s = reading.order[i];
  const pseudo = {id: "livro:" + reading.book.id + ":" + s.id, frase: s.text, alvo: "", tags: "", situacao: "[neutro] "};
  const priority = ["relativ", "indirekt", "umzu", "alswenn", "doppelkonj", "zweiobjekt", "daworter", "deshalb",
    "nebensatz", "v2", "trennbar", "perfekt", "praeteritum", "modal", "imperativ", "reflexiv", "passiv", "konjunktiv", "praep", "wfragen",
    "komparativ", "adjektiv", "possessiv", "konnektoren", "negacao", "falsos"];
  return topicsFor(pseudo).filter(id => id !== "genero").sort((a, b) => priority.indexOf(a) - priority.indexOf(b)).slice(0, 3);
}
function renderDetail() {
  const box = $("rdDetail");
  if (!box || reading.sel < 0) return;
  const i = reading.sel, s = reading.order[i], note = reading.book.notes && reading.book.notes.s && reading.book.notes.s[s.id];
  const topics = note && Array.isArray(note.t) && note.t.length ? note.t.filter(id => GRAMMAR_BY_ID.has(id)) : bookGrammar(i);
  const picked = (reading.pick || []).length;
  fill(box,
    picked && typeof exprDetail === "function" ? exprDetail(i, reading.pick) : reading.word ? wordDetail(reading.word, i, reading.wk) : null,
    h("section", {class: "rd-sentence"},
      h("p", {class: "rd-sent-de", lang: "de", text: s.text}),
      h("div", {class: "row"},
        h("button", {class: "small", type: "button", disabled: reading.starts[i] == null, onclick: () => playSentence(i)}, icon("volume", 16), "Ouvir"),
        h("button", {class: "small", type: "button", disabled: reading.starts[i] == null, onclick: () => playSentence(i, true)}, icon("slow", 16), "Devagar"),
        h("button", {class: "quiet small", type: "button", onclick: () => copySentence(s.text)}, "Copiar"),
        h("button", {class: "quiet small", type: "button", title: "Cria um rascunho de cartão em Minhas frases", onclick: e => {
          e.currentTarget.disabled = true;
          addMineDrafts(s.text, convAvailable(), "livro");
          toast("Rascunho criado em Minhas frases: confira e salve lá.", "success");
        }}, "Virar cartão"),
        typeof passageButton === "function" ? passageButton(i) : null),
      note && note.pt ? (reading.ptMode === "pedir"
        ? h("button", {class: "quiet small", type: "button", onclick: e => e.currentTarget.replaceWith(h("p", {class: "rd-translation", text: note.pt}))}, "Ver tradução")
        : h("p", {class: "rd-translation", text: note.pt})) : null,
      note && note.g ? h("p", {class: "small-text", text: note.g}) : null,
      topics.length ? h("div", {class: "rd-grammar"}, h("span", {class: "muted small-text", text: "Gramática nesta frase:"}),
        ...topics.map(id => { const t = GRAMMAR_BY_ID.get(id); return h("div", {class: "rd-topic"},
          h("button", {class: "chip chip-grammar small", type: "button", onclick: () => openGrammarDialog(id)}, "📘 " + t.title), h("p", {class: "muted small-text", text: t.short})); }))
        : h("p", {class: "muted small-text", text: note ? "" : "Sem ponto de gramática destacado nesta frase."})));
}
async function copySentence(text) {
  try { await navigator.clipboard.writeText(text); setStatus("Frase copiada.", "success"); }
  catch (e) { setStatus("Não foi possível copiar.", "error"); }
}

// ---------- Áudio ----------
/* Tempo do livro (ms) ↔ arquivo de áudio. Sem partes (PC), é o próprio currentTime; com partes (celular), troca o arquivo
   quando o trecho é de outro capítulo e espera os metadados antes de posicionar. */
function rdSeek(ms) {
  const a = reading.audio, parts = reading.book && reading.book.parts;
  if (!parts) { a.currentTime = Math.max(0, ms) / 1000; return Promise.resolve(); }
  let k = parts.findIndex(p => p.end == null || ms < p.end);
  if (k < 0) k = parts.length - 1;
  const place = () => { a.currentTime = Math.max(0, ms - parts[k].start) / 1000; };
  if (reading.partIdx === k && a.src) { place(); return Promise.resolve(); }
  reading.partIdx = k;
  a.src = parts[k].url;
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; a.removeEventListener("loadedmetadata", finish); try { place(); } catch (e) { /* posição fora do arquivo */ } resolve(); };
    a.addEventListener("loadedmetadata", finish);
    setTimeout(finish, 4000);
  });
}
function rdNowMs() {
  const a = reading.audio, parts = reading.book && reading.book.parts;
  return a.currentTime * 1000 + (parts && reading.partIdx >= 0 ? parts[reading.partIdx].start : 0);
}
function sentenceEnd(i) {
  for (let k = i + 1; k < reading.starts.length; k++) if (reading.starts[k] != null && reading.starts[k] > reading.starts[i]) return reading.starts[k];
  return reading.starts[i] + 8000;
}
function playSentence(i, slow) {
  if (!hasSync() || reading.starts[i] == null) { if (reading.book && !hasSync()) setStatus("Sincronize o áudio do livro para ouvir frase por frase.", "info"); return; }
  stopAudio();
  const a = reading.audio;
  reading.follow = false;
  const playing = reading.playing = {i, end: sentenceEnd(i) - 60};
  if (reading.sel !== i) { reading.sel = i; highlightSentence(i); renderDetail(); }
  rdSeek(Math.max(0, reading.starts[i] - 150)).then(() => {
    if (reading.playing !== playing) return;
    a.playbackRate = reading.rate * (slow ? .75 : 1);
    a.play().catch(() => {});
    tickReading();
    updateReaderControls();
  });
}
function currentSentenceAt(ms) {
  let lo = 0, hi = reading.starts.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, t = reading.starts[mid];
    if (t != null && t <= ms + 120) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
function tickReading() {
  cancelAnimationFrame(reading.raf);
  const loop = () => {
    const a = reading.audio;
    if (!a || a.paused) { updateReaderControls(); return; }
    const ms = rdNowMs();
    if (reading.follow) {
      const i = currentSentenceAt(ms);
      if (i >= 0 && i !== reading.sel) {
        // No ciclo ouvir → ler → ouvir, a escuta para no fim do capítulo.
        if (reading.order[i].ch !== reading.ch && reading.cycle && typeof rdCycleChapterEnd === "function") { a.pause(); reading.follow = false; rdCycleChapterEnd(); return; }
        if (reading.order[i].ch !== reading.ch) { reading.ch = reading.order[i].ch; reading.sel = i; renderBook(); window.scrollTo({top: 0}); }
        reading.sel = i;
        reading.word = ""; reading.wk = -1; reading.pick = [];
        hideReaderPop();
        highlightSentence(i);
        renderDetail();
        scrollToSentence(i);
        saveBookPosition();
      }
    } else if (reading.playing && ms >= reading.playing.end) { a.pause(); reading.playing = null; updateReaderControls(); return; }
    reading.raf = requestAnimationFrame(loop);
  };
  reading.raf = requestAnimationFrame(loop);
}
function toggleFollow() {
  const a = reading.audio;
  if (!a || !hasSync()) { setStatus("Sincronize o áudio do livro para ler ouvindo.", "info"); return; }
  if (!a.paused && reading.follow) { a.pause(); reading.follow = false; updateReaderControls(); return; }
  stopAudio();
  const [first] = chapterRange(reading.ch);
  let i = reading.sel >= 0 ? reading.sel : first;
  while (i < reading.starts.length && reading.starts[i] == null) i++;
  if (i >= reading.starts.length) return;
  reading.follow = true;
  reading.playing = null;
  if (reading.sel !== i) { reading.sel = i; highlightSentence(i); renderDetail(); }
  updateReaderControls();
  return rdSeek(Math.max(0, reading.starts[i] - 150)).then(() => {
    if (!reading.follow) return;
    a.playbackRate = reading.rate;
    a.play().catch(() => {});
    tickReading();
    updateReaderControls();
  });
}
function stepSentence(delta) {
  if (!reading.book) return;
  const [a, b] = chapterRange(reading.ch);
  const next = Math.min(b, Math.max(a, (reading.sel < 0 ? a - delta : reading.sel) + delta));
  reading.word = "";
  selectSentence(next, "");
  scrollToSentence(next);
  if (reading.follow && reading.audio && !reading.audio.paused) { const a = reading.audio; rdSeek(Math.max(0, reading.starts[next] - 150)).then(() => { if (reading.follow && a.paused) a.play().catch(() => {}); }); }
  else if (reading.clickPlays) playSentence(next);
}
function stopReadingAudio() {
  cancelAnimationFrame(reading.raf);
  if (reading.audio) reading.audio.pause();
  reading.follow = false;
  reading.playing = null;
}
function updateReaderControls() {
  const btn = $("rdPlay");
  if (!btn) return;
  const on = reading.follow && reading.audio && !reading.audio.paused;
  btn.textContent = on ? "⏸ Pausar" : "▶ Ler ouvindo";
  btn.disabled = !hasSync();
}
function markChapterRead() {
  const s = readingState(), key = reading.book.id;
  s.read = {...(s.read || {}), [key]: [...new Set([...((s.read || {})[key] || []), reading.ch])]};
  safeWrite(KEY_READING, s);
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  renderHome();
  setStatus("Capítulo " + (reading.ch + 1) + " marcado como lido.", "success");
}
function readingKey(e) {
  if (!reading.book || $("readingBook").hidden) return false;
  if (reading.view !== "text") return typeof bookPracticeKey === "function" ? bookPracticeKey(e) : false;
  if (e.key === "Escape" && (document.getElementById("rdPop") || (reading.pick || []).length)) {
    e.preventDefault(); hideReaderPop(); reading.pick = []; if (reading.sel >= 0) { highlightSentence(reading.sel); renderDetail(); } return true;
  }
  const key = e.key.toLowerCase();
  if (e.code === "Space") { e.preventDefault(); toggleFollow(); return true; }
  if (e.key === "ArrowRight") { e.preventDefault(); stepSentence(1); return true; }
  if (e.key === "ArrowLeft") { e.preventDefault(); stepSentence(-1); return true; }
  if (key === "r" && reading.sel >= 0) { e.preventDefault(); playSentence(reading.sel); return true; }
  if (key === "d" && reading.sel >= 0) { e.preventDefault(); playSentence(reading.sel, true); return true; }
  return false;
}
function bindReading() {
  if (window.satzDesktop && window.satzDesktop.onBookProgress) window.satzDesktop.onBookProgress(onBookProgress);
}
