"use strict";
/* Leitura: livros importados (EPUB + audiolivro) com o áudio sincronizado frase a frase.
   Tocar numa palavra seleciona a frase, toca o trecho do áudio e mostra a palavra e a gramática da frase.
   Os livros ficam no processo principal (livros.cjs); aqui só a interface. */
const KEY_READING = "satzbausteine.reading.v1";
const reading = {books: [], book: null, ch: 0, order: [], byId: new Map(), starts: [], sel: -1, word: "", audio: null,
  playing: null, follow: false, raf: 0, rate: 1, clickPlays: true, ptMode: "painel", wordCount: null, articles: null, catalogWords: null, view: "text"};
const RD_PT_MODES = {painel: "Imersão: só no painel", pedir: "Só quando eu pedir", toque: "Apoio: abre na frase escolhida", abaixo: "Sempre embaixo de cada frase"};

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
  // Vindo da Hoje (“Palavras dos livros”): abre direto a revisão das vencidas, com ou sem livro aberto.
  if (reading.pendingReview && typeof bwStartDue === "function") {
    reading.pendingReview = false;
    if (!reading.book && window.satzDesktop && window.satzDesktop.listBooks) reading.books = await window.satzDesktop.listBooks().catch(() => reading.books || []);
    bwStartDue();
    return;
  }
  if (reading.view === "review") reading.view = "text";
  if (reading.book) { renderBook(); return; }
  reading.libEnter = true;
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
    return h("div", {class: "book-status"}, h("span", {text: (b.kind === "media" ? "Transcrevendo a mídia… " : "Sincronizando o áudio com o texto… ") + (b.sync.pct || 0) + "%"}),
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
// ---------- Estante (PC e celular) ----------
const RD_COVER_COLORS = [["#1f4f48", "#e6f1ee"], ["#6b2737", "#f7e9ec"], ["#26406e", "#e7edf8"], ["#8a5a17", "#fbf1df"],
  ["#3d4f2b", "#edf2e4"], ["#4b3160", "#f1eaf6"], ["#9c4a2f", "#fbebe4"], ["#2d5566", "#e5f0f4"]];
function rdAuthor(b) { return b.author && b.author !== "Unbekannt" ? b.author : ""; }
function rdHash(s) { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; }
/* Cor de cada capa gerada: vem do título, mas dois livros da mesma estante nunca ficam com a mesma cor. */
const rdCoverColor = new Map();
function rdAssignCovers(books) {
  const used = new Set();
  for (const b of books) {
    if (b.cover) continue;
    let k = rdHash(b.title) % RD_COVER_COLORS.length;
    for (let n = 0; n < RD_COVER_COLORS.length && used.has(k); n++) k = (k + 1) % RD_COVER_COLORS.length;
    used.add(k);
    rdCoverColor.set(b.id, k);
  }
}
/* Capa do EPUB ou, sem ela, uma capa gerada: cor própria, moldura, título e a inicial grande da palavra principal. */
function rdCoverNode(b) {
  if (b.cover) {
    const img = h("img", {src: rdImageUrl(b, b.cover) + (window.satzDesktop && b.coverAt ? "?v=" + b.coverAt : ""), alt: "", loading: "lazy", decoding: "async"});
    const el = h("div", {class: "cover cover-img"}, img);
    rdKeepRatio(b, el, img);
    return el;
  }
  const [bg, fg] = RD_COVER_COLORS[rdCoverColor.has(b.id) ? rdCoverColor.get(b.id) : rdHash(b.title) % RD_COVER_COLORS.length];
  const main = String(b.title).split(/\s+/).find(w => !/^(der|die|das|den|dem|des|ein|eine|einer|the|a|an)$/i.test(w)) || String(b.title);
  const el = h("div", {class: "cover cover-gen"},
    h("span", {class: "cover-mark", "aria-hidden": "true", lang: "de", text: main.charAt(0)}),
    h("span", {class: "cover-title", lang: "de", text: b.title}),
    rdAuthor(b) ? h("span", {class: "cover-author", text: rdAuthor(b)}) : null);
  el.style.setProperty("--cv-bg", bg);
  el.style.setProperty("--cv-fg", fg);
  return el;
}
/* Onde a pessoa está no livro: pela frase em que parou (o livro sabe quantas frases tem), senão pelo começo do capítulo. */
function rdBookPct(b, pos) {
  if (!pos || !b.chapters) return 0;
  const total = b.notes && b.notes.total;
  if (total && pos.sel >= 0) return Math.max(0, Math.min(100, Math.round((pos.sel + 1) / total * 100)));
  return Math.round(pos.ch / b.chapters * 100);
}
/* Não iniciado, lendo ou lido (até o fim). */
function rdBookState(b, pos) { return !pos ? "new" : rdBookPct(b, pos) >= 98 ? "done" : "reading"; }
function rdWhen(at) {
  if (!at) return "";
  const d = calendarDays(at, Date.now());
  return d <= 0 ? "Lido hoje" : d === 1 ? "Lido ontem" : d < 7 ? "Lido há " + d + " dias" : "Lido em " + new Date(at).toLocaleDateString("pt-BR", {day: "numeric", month: "short"});
}
/* Barras e colunas que mudam de valor deslizam do valor anterior para o novo (o nó é refeito a cada renderização). */
const rdLastSize = new Map();
function rdGrow(el, key, pct, prop = "width") {
  const v = Math.max(0, Math.min(100, pct)), prev = rdLastSize.get(key);
  rdLastSize.set(key, v);
  if (prev == null || Math.abs(prev - v) < .5 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style[prop] = v + "%"; return; }
  el.style[prop] = prev + "%";
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style[prop] = v + "%"; }));
}
/* Proporção de cada capa (largura ÷ altura), lida da imagem e guardada, para a estante não pular ao reabrir. */
const RD_RATIO = [.62, .86];
function rdKeepRatio(b, el, img) {
  const saved = (readingState().ratios || {})[b.id];
  if (saved) el.style.setProperty("--cv-ratio", saved);
  const go = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const r = Math.round(Math.max(RD_RATIO[0], Math.min(RD_RATIO[1], img.naturalWidth / img.naturalHeight)) * 1000) / 1000;
    el.style.setProperty("--cv-ratio", r);
    if (saved !== r) saveReadingState({ratios: {...(readingState().ratios || {}), [b.id]: r}});
  };
  img.complete ? go() : img.addEventListener("load", go, {once: true});
}
/* Cor média da capa (as cores vivas pesam mais), para o cartão em destaque ganhar um reflexo bem leve dela. */
const rdTints = new Map();
function rdTintFrom(img, target) {
  const key = img.getAttribute("src"), apply = c => target.style.setProperty("--rd-tint", c);
  if (rdTints.has(key)) { apply(rdTints.get(key)); return; }
  const go = () => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const x = c.getContext("2d", {willReadFrequently: true});
      x.drawImage(img, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, bl = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const w = 1 + (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 32;
        r += d[i] * w; g += d[i + 1] * w; bl += d[i + 2] * w; n += w;
      }
      const col = "rgb(" + [r, g, bl].map(v => Math.round(v / n)).join(" ") + ")";
      rdTints.set(key, col);
      apply(col);
    } catch (e) { /* imagem que não dá para ler: fica sem reflexo */ }
  };
  img.complete && img.naturalWidth ? go() : img.addEventListener("load", go, {once: true});
}
/* Um livro na estante: a capa em pé (proporção original, alinhada pela base), título, onde parou e, ao passar o mouse, a engrenagem. */
function rdShelfItem(b, o) {
  const pos = bookPosition(b.id), pct = rdBookPct(b, pos), state = rdBookState(b, pos), bar = h("i");
  rdGrow(bar, "shelf|" + b.id, pct);
  const status = state === "new" ? h("span", {class: "shelf-meta", text: "Ainda não começou"})
    : state === "done" ? h("span", {class: "shelf-meta shelf-done"}, icon("check", 14), h("span", {text: "Lido"}))
    : [h("span", {class: "shelf-meta", text: "Cap. " + (pos.ch + 1) + " de " + b.chapters}), h("span", {class: "shelf-pct", text: pct + "%"}),
      h("span", {class: "shelf-bar", role: "progressbar", "aria-label": "Progresso", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100"}, bar)];
  const when = pos && pos.at ? rdWhen(pos.at) : "";
  return h("div", {class: "shelf-item is-" + state + (o.cloud ? " cloud" : ""), "data-q": rdFold(b.title + " " + rdAuthor(b))},
    h("button", {class: "shelf-book", type: "button", "data-book": b.id, "aria-label": (o.cloud ? "Baixar " : "Abrir ") + b.title, onclick: o.open},
      rdCoverNode(b), o.cloud ? h("span", {class: "shelf-cloud"}, icon("download", 16)) : null),
    h("div", {class: "shelf-info"},
      h("div", {class: "shelf-title-row"}, h("b", {lang: "de", title: b.title, text: b.title}),
        h("button", {class: "icon-btn quiet shelf-gear", type: "button", title: "Ajustes do livro", "aria-label": "Ajustes de " + b.title, onclick: o.gear}, icon("more", 18))),
      // Só na lista: autor e quando leu (na grade a capa já diz isso).
      rdAuthor(b) ? h("span", {class: "shelf-author", text: rdAuthor(b)}) : null,
      h("div", {class: "shelf-progress"}, status),
      when ? h("span", {class: "shelf-when", text: when}) : null,
      o.alert ? h("button", {class: "shelf-alert", type: "button", onclick: o.gear}, h("i", {"aria-hidden": "true"}), h("span", {text: o.alert})) : null));
}
/* Lugar de importar um livro, com o formato de uma capa ainda em branco (também recebe o EPUB arrastado). */
function rdAddTile(onclick) {
  const busy = !!reading.importing, drop = !!(window.satzDesktop && window.satzDesktop.importBookFiles);
  return h("div", {class: "shelf-item shelf-add" + (busy ? " busy" : "")},
    h("button", {class: "shelf-book", type: "button", disabled: busy, "aria-label": "Importar livro",
      title: "Escolha o EPUB e, se tiver, o MP3 do audiolivro (os dois de uma vez). Os arquivos originais não são alterados.", onclick},
      h("div", {class: "cover cover-add"}, h("span", {class: "cover-add-icon"}, busy ? h("span", {class: "rd-spin", "aria-hidden": "true"}) : icon("plus", 24)),
        h("span", {class: "cover-add-t", text: busy ? "Importando…" : "Importar livro"}),
        h("span", {class: "cover-add-s", text: busy ? "Leva até 2 minutos" : drop ? "EPUB com áudio, ou arraste e solte aqui" : "EPUB com o audiolivro"}))));
}
function rdShelf(items, addTile) {
  return h("div", {class: "shelf" + (readingState().shelfView === "list" ? " is-list" : "")}, items, addTile || null,
    h("p", {class: "shelf-none muted", hidden: true}));
}
/* Texto sem acento e em minúsculas, para a busca. */
function rdFold(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
/* Ordem da estante (Ordenar por): últimos lidos, título, progresso ou importados por último. bookOf tira o livro de cada item. */
const RD_SORTS = [["recent", "Últimos lidos"], ["title", "Título"], ["progress", "Progresso"], ["added", "Adicionados"]];
function rdSortBooks(list, bookOf = x => x) {
  const by = readingState().shelfSort || "recent", at = b => (bookPosition(b.id) || {}).at || 0;
  const cmp = {
    recent: (x, y) => at(y) - at(x) || (y.importedAt || 0) - (x.importedAt || 0),
    title: (x, y) => String(x.title).localeCompare(String(y.title), "de"),
    progress: (x, y) => rdBookPct(y, bookPosition(y.id)) - rdBookPct(x, bookPosition(x.id)) || at(y) - at(x),
    added: (x, y) => (y.importedAt || 0) - (x.importedAt || 0)}[by] || (() => 0);
  return [...list].sort((p, q) => cmp(bookOf(p), bookOf(q)));
}
/* Ordenar por + grade/lista, no cabeçalho da estante. */
function rdShelfControls() {
  const sel = h("select", {class: "rd-sort", "aria-label": "Ordenar a estante"}, ...RD_SORTS.map(([v, t]) => new Option(t, v)));
  sel.value = readingState().shelfSort || "recent";
  sel.addEventListener("change", () => { saveReadingState({shelfSort: sel.value}); rdRerender(); });
  const view = readingState().shelfView === "list" ? "list" : "grid";
  const seg = (v, ic, label) => h("button", {class: "rd-seg-btn" + (view === v ? " on" : ""), type: "button", "aria-pressed": String(view === v), "aria-label": label, title: label,
    onclick: () => { if (view !== v) { saveReadingState({shelfView: v}); rdRerender(); } }}, icon(ic, 18));
  return h("div", {class: "shelf-controls"},
    h("label", {class: "rd-sort-label"}, h("span", {text: "Ordenar por:"}), sel),
    h("div", {class: "rd-seg", role: "group", "aria-label": "Mostrar a estante"}, seg("grid", "grid", "Em grade"), seg("list", "list", "Em lista")));
}
function rdRerender() { if (typeof rdWebRender === "function" && !(window.satzDesktop && window.satzDesktop.listBooks)) rdWebRender(); else renderLibrary(); }
/* Busca e “Importar livro” no alto da tela, ao lado do título (o cabeçalho é fixo no HTML; os botões entram uma vez). */
function rdHeadActions() {
  const head = document.querySelector("#view-reading > .page-head");
  if (!head || $("rdHeadActions")) return;
  const row = head.querySelector(".title-row") || head;
  const input = h("input", {id: "rdSearch", class: "rd-search-input", type: "search", placeholder: "Buscar na estante", "aria-label": "Buscar livro na estante", autocomplete: "off"});
  const wrap = h("div", {class: "rd-search"}, input);
  const btn = h("button", {class: "icon-btn rd-head-btn", type: "button", title: "Buscar livro", "aria-label": "Buscar livro", "aria-expanded": "false"}, icon("search", 20));
  const open = on => {
    wrap.classList.toggle("open", on); btn.setAttribute("aria-expanded", String(on));
    if (on) input.focus(); else { input.value = ""; rdApplyFilter(""); }
  };
  btn.addEventListener("click", () => open(!wrap.classList.contains("open")));
  input.addEventListener("input", () => rdApplyFilter(input.value));
  input.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); open(false); btn.focus(); } });
  input.addEventListener("blur", () => { if (!input.value) open(false); });
  const canImport = window.satzDesktop && window.satzDesktop.importBook;
  row.append(h("div", {id: "rdHeadActions", class: "rd-head-actions"}, wrap, btn,
    canImport && window.satzDesktop.importMedia ? h("button", {class: "rd-head-import rd-head-media", type: "button", title: "Áudio ou vídeo curto em alemão (até 15 min): música, entrevista, podcast. Fica só neste computador.",
      onclick: () => importMediaFile()}, icon("mic", 17), h("span", {text: "Áudio ou vídeo"})) : null,
    canImport ? h("button", {class: "primary rd-head-import", type: "button", onclick: () => importBook()}, icon("plus", 18), h("span", {text: "Importar livro"})) : null));
}
/* Esconde os livros que não batem com a busca (título ou autor, sem acento). */
function rdApplyFilter(q) {
  reading.query = q = rdFold(q).trim();
  const items = [...document.querySelectorAll("#readingLibrary .shelf-item:not(.shelf-add)")];
  let shown = 0;
  for (const it of items) { const ok = !q || (it.dataset.q || "").includes(q); it.hidden = !ok; if (ok) shown++; }
  const add = document.querySelector("#readingLibrary .shelf-add");
  if (add) add.hidden = !!q;
  const none = document.querySelector("#readingLibrary .shelf-none");
  if (none) { none.hidden = !q || shown > 0; none.textContent = "Nenhum livro com “" + q + "” na estante."; }
}
/* Nome do capítulo, quando o livro tem um (não o “Capítulo N” que o importador põe quando falta). */
function rdChapterName(b, ch) {
  const t = String((b.chTitles || [])[ch] || "").trim().replace(/^(kapitel|cap[ií]tulo|chapter)\s*\d+[.:]?\s*(?=\S)/i, "");
  return !t || /^(cap[ií]tulo|kapitel|chapter)\s*\d+\.?$/i.test(t) || t === b.title ? "" : t.length > 40 ? t.slice(0, 38) + "…" : t;
}
/* Livro em destaque: a capa grande e, ao lado, título, autor, onde parou (capítulo e porcentagem) e o botão. */
function rdContinueNode(b, open) {
  const pos = bookPosition(b.id) || {ch: 0, sel: -1}, pct = rdBookPct(b, pos), bar = h("i");
  rdGrow(bar, "hero|" + b.id, pct);
  const saved = typeof savedWordsOf === "function" ? savedWordsOf(b.id).length : 0;
  const weekMin = typeof rdWeek === "function" ? Math.round(rdWeek().ms / 60000) : 0;
  const cover = rdCoverNode(b), chName = rdChapterName(b, pos.ch), when = rdWhen(pos.at);
  const stat = (ic, big, small) => h("div", {class: "rd-stat"}, icon(ic, 22), h("span", null, h("b", {text: big}), h("small", {text: small})));
  const card = h("section", {class: "rd-continue", "aria-label": "Lendo agora: " + b.title},
    h("button", {class: "shelf-book rd-continue-cover", type: "button", "data-book": b.id, "aria-label": "Continuar " + b.title, onclick: open}, cover),
    h("div", {class: "rd-continue-text"},
      h("p", {class: "rd-kicker"}, icon("bookOpen", 15), h("span", {text: "Lendo agora"})),
      h("h2", {class: "rd-continue-title", lang: "de", text: b.title}),
      h("p", {class: "rd-continue-ch"}, "Capítulo ", h("b", {text: String(pos.ch + 1)}), " de " + b.chapters,
        chName ? [h("span", {class: "rd-dot", "aria-hidden": "true", text: "·"}), h("span", {lang: "de", text: chName})] : null),
      h("div", {class: "rd-continue-progress"},
        h("span", {class: "rd-bar", role: "progressbar", "aria-label": "Progresso do livro", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100"}, bar),
        h("span", {class: "rd-continue-pct", text: pct + "%"})),
      h("div", {class: "rd-continue-act"},
        h("button", {class: "primary rd-go", type: "button", onclick: open}, icon("play", 18), h("span", {text: "Continuar lendo"})),
        when ? h("span", {class: "rd-when-pill"}, icon("bookmark", 17), h("span", {text: when})) : null),
      h("div", {class: "rd-stats"},
        stat("bookOpen", pct + "%", "do livro"),
        stat("clock", weekMin + " min", "nesta semana"),
        stat("bookmark", String(saved), saved === 1 ? "palavra guardada" : "palavras guardadas"))));
  const img = cover.querySelector("img");
  if (img) rdTintFrom(img, card); else card.style.setProperty("--rd-tint", cover.style.getPropertyValue("--cv-bg"));
  return card;
}
/* Composição da estante: em cima, o livro em destaque e o diário lado a lado (o que é de agora); embaixo, a coleção inteira.
   Sem livro em andamento, a estante sobe e o diário fica ao lado dela. */
function rdLibraryLayout(hero, before, shelf, after) {
  // Sem livro, só o convite: o diário de leitura não teria o que contar.
  if (!shelf) return [hero, before, rdWordsReviewNode(), after];
  // Ao lado do diário, as palavras dos livros só quando há o que revisar (sem isso, o cartão “Lendo agora” esticava à toa).
  const side = h("div", {class: "rd-lib-side"}, typeof rdDiaryNode === "function" ? rdDiaryNode() : null, rdWordsReviewNode(true));
  const n = shelf.querySelectorAll(".shelf-item:not(.shelf-add)").length;
  const sec = h("section", {class: "rd-lib-shelf"},
    h("div", {class: "shelf-head"},
      h("div", {class: "shelf-head-t"}, icon("library", 26), h("h2", {text: "Sua estante"}), n ? h("span", {class: "shelf-count", text: plural(n, "livro", "livros")}) : null),
      n > 1 ? rdShelfControls() : null),
    shelf, after);
  return hero ? [h("div", {class: "rd-lib-top"}, hero, side), before, sec] : [before, h("div", {class: "rd-lib"}, sec, side)];
}
/* Palavras guardadas de todos os livros: quantas venceram hoje e o botão para revisar. */
function rdWordsReviewNode(onlyDue) {
  if (typeof bwInfo !== "function") return null;
  const info = bwInfo();
  if (!info.total || (onlyDue && !info.due)) return null;
  return h("section", {id: "rdWordsReview", class: "panel rd-words-review"},
    h("p", {class: "label", text: "Palavras dos livros"}),
    info.due ? h("p", {class: "rd-wr-num"}, h("b", {text: String(info.due)}), " para revisar hoje")
      : h("p", {class: "rd-wr-num muted", text: info.today ? plural(info.today, "revisada hoje", "revisadas hoje") + ". " + bwNextText() : "Nada vencido. " + bwNextText()}),
    h("p", {class: "muted small-text", text: plural(info.total, "palavra ou expressão guardada", "palavras e expressões guardadas")}),
    info.due ? h("button", {class: "primary", type: "button", onclick: bwStartDue}, "Revisar agora") : null);
}
/* Janela de ajustes do livro. render(id) devolve [título, conteúdo]; é refeita a cada renderização da estante. */
function rdBookDialog(id, render) {
  let dlg = $("rdBookDialog");
  if (!dlg) {
    dlg = h("dialog", {id: "rdBookDialog", class: "grammar-dialog book-dialog", "aria-labelledby": "rdBookDialogTitle"});
    dlg.addEventListener("close", () => { reading.dialog = null; });
    document.body.append(dlg);
  }
  reading.dialog = {id, render};
  rdBookDialogRefresh();
  if (reading.dialog && !dlg.open) dlg.showModal();
}
function rdBookDialogRefresh() {
  const dlg = $("rdBookDialog");
  if (!dlg || !reading.dialog) return;
  const out = reading.dialog.render(reading.dialog.id);
  if (!out) { if (dlg.open) dlg.close(); reading.dialog = null; return; }
  fill(dlg, h("div", {class: "dialog-head"}, h("h2", {id: "rdBookDialogTitle", lang: "de", text: out[0]}),
    h("button", {class: "icon-btn quiet", type: "button", "aria-label": "Fechar", onclick: () => dlg.close()}, "×")),
    h("div", {class: "book-dialog-body"}, out[1]));
}
function rdShelfAlert(b) {
  if (!b.audio) return "Sem áudio";
  if (b.audio.fixing) return "Corrigindo o áudio…";
  if (b.audio.vbr) return "O áudio precisa de correção";
  if (b.sync.state === "running") return (b.kind === "media" ? "Transcrevendo… " : "Sincronizando… ") + (b.sync.pct || 0) + "%";
  if (b.sync.state !== "done") return "Áudio não sincronizado";
  if (!b.annotated) return "Sem traduções";
  return null;
}
function rdBookSettings(id) {
  const b = reading.books.find(x => x.id === id);
  if (!b) return null;
  return [b.title, [
    h("div", {class: "bd-cover"}, rdCoverNode(b), h("button", {class: "small", type: "button", onclick: () => rdPickCover(b.id)}, b.cover ? "Trocar a capa" : "Buscar a capa")),
    h("div", {class: "bd-info"},
      h("p", {class: "muted small-text", text: (rdAuthor(b) ? rdAuthor(b) + ". " : "") + plural(b.chapters, "capítulo", "capítulos") + ", " + (b.words || 0).toLocaleString("pt-BR") + " palavras."}),
      h("h3", {text: "Áudio"}), syncStatusNode(b),
      h("h3", {text: "Traduções e gramática"}), annotStatusNode(b),
      typeof rdBookCardDifficulty === "function" ? rdBookCardDifficulty(b) : null,
      typeof rdSendButton === "function" ? [h("h3", {text: "Celular"}), rdSendButton(b)] : null,
      h("div", {class: "bd-foot"}, h("button", {class: "quiet small danger-text", type: "button", onclick: () => { $("rdBookDialog").close(); deleteBook(b.id); }}, "Remover o livro")))]];
}
async function rdPickCover(id) {
  try {
    const b = await window.satzDesktop.setBookCover(id);
    if (b) { setStatus("Capa atualizada.", "success"); await renderLibrary(); }
  } catch (e) { setStatus(cleanIpcError(e, "Não consegui trocar a capa."), "error"); }
}
async function renderLibrary() {
  const box = $("readingLibrary");
  $("readingBook").hidden = true;
  box.hidden = false;
  rdDropZone(box);
  // Celular: os livros vêm do GitHub privado e ficam guardados no aparelho (leitura-celular.js).
  if (!window.satzDesktop || !window.satzDesktop.listBooks) {
    if (typeof rdWebLibrary === "function") return rdWebLibrary(box);
    fill(box, h("p", {class: "notice", text: "A leitura com áudio funciona no aplicativo do Windows."})); return;
  }
  try { reading.books = await window.satzDesktop.listBooks(); }
  catch (e) { reportError("livros", e.message, e.stack); reading.books = []; }
  const recent = reading.books.map(b => [b, bookPosition(b.id)]).filter(([, p]) => p).sort((x, y) => (y[1].at || 0) - (x[1].at || 0))[0];
  rdAssignCovers(reading.books);
  fill(box, rdLibraryLayout(
    recent ? rdContinueNode(recent[0], e => rdOpenFromCover(recent[0].id, rdCoverOf(e))) : null,
    reading.books.length ? null : emptyState("bookOpen", "Sua estante está vazia", "Importe um livro em EPUB com o audiolivro: o app liga o áudio ao texto e você lê ouvindo, frase por frase.", ["Importar livro", importBook]),
    // Sem livro, o convite acima já tem o botão: a prateleira só com o “Importar livro” repetiria.
    reading.books.length ? rdShelf(rdSortBooks(reading.books).map(b => rdShelfItem(b, {open: e => rdOpenFromCover(b.id, rdCoverOf(e)), gear: () => rdBookDialog(b.id, rdBookSettings), alert: rdShelfAlert(b)})), rdAddTile(importBook)) : null));
  rdLibEnter(box);
  rdBookDialogRefresh();
  rdHeadActions();
  if (reading.query) rdApplyFilter(reading.query);
}
/* Ao chegar na Leitura, o conteúdo sobe uns poucos pixels enquanto aparece (uma vez; as atualizações seguintes não repetem). */
function rdLibEnter(box) {
  if (!reading.libEnter) return;
  reading.libEnter = false;
  if (document.documentElement.dataset.nav === "book") return;
  box.classList.remove("rd-enter");
  void box.offsetWidth;
  box.classList.add("rd-enter");
  clearTimeout(rdLibEnter.t);
  rdLibEnter.t = setTimeout(() => box.classList.remove("rd-enter"), 700);
}
/* Arrastar o EPUB (e o áudio) para a estante importa como o botão. Só no PC, que sabe o caminho do arquivo arrastado. */
function rdDropZone(box) {
  if (box.dataset.drop || !window.satzDesktop || !window.satzDesktop.importBookFiles) return;
  box.dataset.drop = "1";
  let depth = 0;
  const isFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  const set = on => box.classList.toggle("rd-dropping", on);
  box.addEventListener("dragenter", e => { if (!isFiles(e) || reading.book) return; e.preventDefault(); depth++; set(true); });
  box.addEventListener("dragover", e => { if (!isFiles(e) || reading.book) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
  box.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) set(false); });
  box.addEventListener("drop", e => {
    if (!isFiles(e) || reading.book) return;
    e.preventDefault(); depth = 0; set(false);
    const files = [...e.dataTransfer.files];
    if (!files.some(f => /\.epub$/i.test(f.name))) { setStatus("Arraste o arquivo EPUB do livro (e, se tiver, o MP3 do audiolivro junto).", "info"); return; }
    importBook(files);
  });
}
/* Importa pelo seletor de arquivos ou, com files (arrastados), direto; enquanto isso, o lugar de importar mostra “Importando…”. */
async function importBook(files) {
  if (reading.importing) return;
  const dropped = Array.isArray(files);
  try {
    if (dropped) { reading.importing = true; renderLibrary(); }
    else setStatus("Escolha o EPUB e o áudio. Se o áudio precisar de ajuste, a importação leva 1 a 2 minutos.", "info");
    const b = dropped ? await window.satzDesktop.importBookFiles(files) : await window.satzDesktop.importBook();
    reading.importing = false;
    if (!b) { if (dropped) renderLibrary(); return; }
    setStatus("Livro importado: " + b.title + ".", "success");
    await renderLibrary();
    rdFlashBook(b.id);
    if (b.audio && b.sync.state === "none") alignBook(b.id);
  } catch (e) { reading.importing = false; if (dropped) renderLibrary(); setStatus(cleanIpcError(e, "Não consegui importar o livro."), "error"); }
}
/* Mídia curta (áudio ou vídeo de até 15 min): o Whisper transcreve neste computador e ela vira um “livro” de um capítulo. */
async function importMediaFile() {
  try {
    setStatus("Escolha um áudio ou vídeo curto em alemão (até 15 minutos).", "info");
    const b = await window.satzDesktop.importMedia();
    if (!b) return;
    setStatus("Transcrevendo “" + b.title + "” neste computador. Leva alguns minutos; pode continuar usando o app.", "info");
    await renderLibrary();
    rdFlashBook(b.id);
  } catch (e) { setStatus(cleanIpcError(e, "Não consegui importar a mídia."), "error"); }
}
/* O livro que acabou de chegar entra na estante com um destaque breve (para o olho achar onde ele ficou). */
function rdFlashBook(id) {
  const el = document.querySelector("#readingLibrary .shelf-item [data-book=\"" + CSS.escape(id) + "\"]");
  const item = el && el.closest(".shelf-item");
  if (!item) return;
  item.classList.add("just-added");
  el.scrollIntoView({block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  setTimeout(() => item.classList.remove("just-added"), 1600);
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
  // Mídia que falhou ou foi cancelada some da estante (a pasta foi apagada).
  if (data.removed) reading.books = reading.books.filter(x => x.id !== data.id);
  if (data.state === "done") setStatus(data.media ? "Transcrição pronta: toque numa frase para ouvir. Confira o texto: o Whisper pode errar palavras." : "Áudio do livro sincronizado. Toque numa frase para ouvir.", "success");
  if (data.state === "error") setStatus(data.message || "A sincronização falhou.", "error");
  if (currentView === "reading") {
    if (!reading.book || data.removed) renderLibrary();
    else if (reading.book.id === data.id && data.state === "done") openBook(data.id, true);
  }
}

// ---------- Livro aberto ----------
/* Transição herói: a capa tocada cresce até virar a tela de leitura e, ao voltar, a tela encolhe até a capa do livro
   na estante (View Transitions, com o mesmo cuidado do navGo: só com a janela visível e com foco, e sem “Reduzir movimento”).
   O livro é carregado antes, para a tela não ficar parada esperando o arquivo durante a animação. */
function rdMotion() {
  return typeof document.startViewTransition === "function" && document.visibilityState === "visible" && document.hasFocus() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function rdHeroName(el) { if (el) { el.style.viewTransitionName = "rd-hero"; el.dataset.vtHero = "1"; } }
function rdHeroClear() { all("[data-vt-hero]").forEach(el => { el.style.viewTransitionName = ""; delete el.dataset.vtHero; }); }
function rdHeroRun(update) {
  const root = document.documentElement;
  root.dataset.nav = "book";
  const t = document.startViewTransition(update);
  const guard = setTimeout(() => { try { t.skipTransition(); } catch (e) { /* já terminou */ } }, 2500);
  // Transição pulada (janela sem foco, trava de tempo) rejeita ready/finished: não é erro.
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => { clearTimeout(guard); delete root.dataset.nav; rdHeroClear(); });
}
/* A capa do cartão tocado (o botão da capa ou o “Continuar lendo” do mesmo cartão). */
function rdCoverOf(e) {
  const el = e && e.currentTarget;
  return el && el.querySelector ? el.querySelector(".cover") || (el.closest(".rd-continue, .shelf-item") || {querySelector: () => null}).querySelector(".cover") : null;
}
async function rdOpenFromCover(id, cover) {
  if (!cover || !rdMotion()) return openBook(id);
  let book;
  try { book = window.satzDesktop ? await window.satzDesktop.getBook(id) : await rdWebGetBook(id); }
  catch (e) { return openBook(id); }
  rdHeroName(cover);
  rdHeroRun(async () => { rdHeroClear(); await openBook(id, false, book); rdHeroName($("readingBook")); });
}
function rdCloseBook() {
  const id = reading.book && reading.book.id;
  if (!id || !rdMotion()) { closeBook(); return; }
  rdHeroName($("readingBook"));
  rdHeroRun(async () => {
    rdHeroClear();
    await closeBook();
    const box = $("readingLibrary"), key = CSS.escape(id);
    rdHeroName(box.querySelector('.rd-continue [data-book="' + key + '"] .cover') || box.querySelector('.shelf-item [data-book="' + key + '"] .cover'));
  });
}
async function openBook(id, keepPlace, preloaded) {
  let book = preloaded;
  try { if (!book) book = window.satzDesktop ? await window.satzDesktop.getBook(id) : await rdWebGetBook(id); }
  catch (e) { setStatus(cleanIpcError(e, "Não consegui abrir o livro."), "error"); return; }
  if (!book.chapters || !book.chapters.length) { setStatus("Ainda transcrevendo: o texto aparece quando o Whisper terminar.", "info"); return; }
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
  // Fim da fala de cada frase (sinc v2). Sem ele, a frase vai até o início da seguinte.
  const ends = (book.sync && book.sync.ends) || {};
  reading.ends = reading.order.map(s => Number.isFinite(ends[s.id]) ? ends[s.id] : null);
  // Tempo de cada palavra (palavras.json, quando o livro foi alinhado): [k, início, fim, ...] por frase.
  const wt = (book.sync && book.sync.wt) || {};
  reading.wt = reading.order.map(s => Array.isArray(wt[s.id]) ? wt[s.id] : null);
  reading.lit = null;
  reading.wordCount = reading.articles = null;
  // Vídeo curto (mídia .mp4): o mesmo elemento toca e mostra a imagem, em cima do texto.
  reading.audio = book.video ? h("video", {class: "rd-video", playsinline: true, "aria-label": "Vídeo de " + book.title}) : new Audio();
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
  // “borrada” (antigo) virou o modo Apoio: a tradução se abre embaixo da frase escolhida, sem borrão nas outras.
  reading.ptMode = s.ptMode === "borrada" ? "toque" : RD_PT_MODES[s.ptMode] ? s.ptMode : s.showPt ? "abaixo" : "painel";
  reading.flow = !!s.flow;
  reading.focus = s.focus !== false;
  reading.lookOpen = false; reading.summaryOpen = null; reading.sheet = null;
  reading.fs = Math.min(1.8, Math.max(.9, Number(s.fs) || 1.24));
  reading.lh = [1.6, 1.85, 2.15].includes(Number(s.lh)) ? Number(s.lh) : 1.6;
  reading.pick = []; reading.wk = -1; reading.picking = false;
  reading.view = "text";
  renderBook();
  if (reading.sel >= 0) requestAnimationFrame(() => scrollToSentence(reading.sel, "center"));
}
function closeBook() {
  saveBookPosition();
  stopReadingAudio();
  reading.book = null;
  reading.shownCh = null;
  reading.cycle = null;
  reading.lookOpen = false;
  rdApplyFocus();
  return renderLibrary();
}
function hasSync() { return !!(reading.book && reading.book.audio && reading.book.sync); }
function chapterRange(ci) {
  let a = -1, b = -1;
  reading.order.forEach((s, i) => { if (s.ch === ci) { if (a < 0) a = i; b = i; } });
  return [a, b];
}
function renderBook() {
  const book = reading.book;
  if (!book) return;
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
  // Tradução: só no painel (imersão), no painel só quando pedir, embaixo da frase escolhida (apoio) ou embaixo de todas.
  const ptMode = h("select", {id: "rdPtMode", "aria-label": "Tradução", title: "Onde mostrar a tradução"},
    ...Object.entries(RD_PT_MODES).map(([k, l]) => new Option(l, k)));
  ptMode.value = reading.ptMode;
  ptMode.addEventListener("change", () => { reading.ptMode = ptMode.value; saveReadingState({ptMode: reading.ptMode}); renderBook(); });
  const togglePick = () => { reading.picking = !reading.picking; if (!reading.picking) reading.pick = []; renderBook(); };
  const phone = rdPhone();
  const practiceBtn = h("button", {class: phone ? "small" : "quiet small", type: "button", title: "Vocabulário, tradução de volta, ditado, lacunas e conversa sobre este capítulo", onclick: () => renderBookPractice()}, iconText("target", phone ? "Praticar o capítulo" : "Praticar"));
  const savedBtn = h("button", {id: "rdSavedBtn", class: "quiet small", type: "button", title: "Palavras e expressões guardadas deste livro", onclick: () => renderSavedWords()}, "★ (" + savedWordsOf(book.id).length + ")");
  // Ajustes de exibição (“Aa”): ficam num menu para a barra caber numa linha só. No celular, praticar e guardados também.
  const look = h("div", {id: "rdLook", class: "rd-look panel", hidden: !reading.lookOpen},
    notes ? h("label", {class: "rd-look-row"}, h("span", {text: "Tradução"}), ptMode) : null,
    h("div", {class: "rd-look-row"}, h("span", {text: "Letra"}),
      h("div", {class: "reader-controls"},
        h("button", {class: "icon-btn", type: "button", title: "Letra menor", "aria-label": "Letra menor", onclick: () => setReaderLook(-.08, 0)}, "A−"),
        h("button", {class: "icon-btn", type: "button", title: "Letra maior", "aria-label": "Letra maior", onclick: () => setReaderLook(.08, 0)}, "A+"),
        h("button", {class: "icon-btn", type: "button", title: "Espaçamento entre linhas", "aria-label": "Espaçamento entre linhas", onclick: () => setReaderLook(0, 1)}, icon("lineHeight", 18)))),
    h("label", {class: "inline-check", title: "Tela limpa: a consulta abre num balão ao lado da palavra, sem o painel lateral"},
      h("input", {id: "rdFlow", type: "checkbox", checked: reading.flow, onchange: e => { reading.flow = e.target.checked; saveReadingState({flow: reading.flow}); renderBook(); }}), phone ? "Leitura contínua (balão em vez da gaveta)" : "Leitura contínua (sem painel lateral)"),
    h("label", {class: "rd-look-row"}, h("span", {text: "Fundo"}), (() => {
      const sel = h("select", {"aria-label": "Fundo do livro"}, ...Object.entries(RD_PAPERS).map(([k, l]) => new Option(l, k)));
      sel.value = RD_PAPERS[readingState().paper] ? readingState().paper : "padrao";
      sel.addEventListener("change", () => { saveReadingState({paper: sel.value}); rdApplyPaper(); });
      return sel;
    })()),
    h("label", {class: "inline-check", title: "Liga com a mesma cor as partes do verbo que o alemão separa (habe … gesehen, weil … ist, ruft … an)"},
      h("input", {type: "checkbox", checked: readingState().bridges !== false, onchange: e => { saveReadingState({bridges: e.target.checked}); rdDrawBridges(reading.sel); }}), "Ponte do verbo na frase escolhida"),
    reading.wt && reading.wt.some(Boolean) ? h("label", {class: "inline-check", title: "Enquanto o áudio toca, a palavra que está sendo dita fica marcada"},
      h("input", {type: "checkbox", checked: readingState().wordLight !== false, onchange: e => { saveReadingState({wordLight: e.target.checked}); rdLightWord(-1); }}), "Acender a palavra falada") : null,
    h("label", {class: "inline-check", title: "Sublinhado em azul (der), vermelho (die) ou verde (das) nos substantivos"},
      h("input", {type: "checkbox", checked: !!readingState().gender, onchange: e => { saveReadingState({gender: e.target.checked}); renderBook(); }}), "Cor do gênero nos substantivos"),
    h("label", {class: "inline-check", title: "Pontilhado leve nas palavras que ainda não apareceram nos seus cartões; o texto vai clareando conforme você estuda"},
      h("input", {type: "checkbox", checked: !!readingState().newWords, onchange: e => { saveReadingState({newWords: e.target.checked}); renderBook(); }}), "Marcar palavras que você ainda não estudou"),
    h("label", {class: "inline-check", title: "Mostra tudo aberto no painel: dicionário, exemplos, análise completa e todas as notas de gramática"},
      h("input", {type: "checkbox", checked: rdPanelFull(), onchange: e => { saveReadingState({panelFull: e.target.checked}); renderDetail(); }}), "Painel completo (tudo aberto)"),
    h("label", {class: "inline-check", title: "Toca a frase quando você escolhe outra frase"}, h("input", {type: "checkbox", checked: reading.clickPlays, onchange: e => { reading.clickPlays = e.target.checked; saveReadingState({clickPlays: reading.clickPlays}); }}), "Tocar a frase ao clicar"),
    h("button", {id: "rdPickBtn", class: "quiet small" + (reading.picking ? " on" : ""), type: "button", title: "Toque em várias palavras da mesma frase para explicar a expressão (ou use Ctrl + clique)",
      onclick: togglePick}, reading.picking ? "✓ Marcando expressão" : phone ? "Marcar expressão" : "Marcar expressão (ou Ctrl + clique)"),
    phone ? h("div", {class: "row rd-look-more"}, practiceBtn, savedBtn)
      : h("p", {class: "muted small-text", text: "Teclado: Espaço lê ouvindo · ← → frase · R repete · D devagar · T tradução · F tela cheia"}));
  const lookWrap = h("div", {class: "rd-look-wrap"},
    h("button", {id: "rdLookBtn", class: "icon-btn" + (phone ? "" : " quiet") + (reading.lookOpen ? " on" : ""), type: "button", title: "Tradução, tamanho da letra, leitura contínua", "aria-label": "Ajustes de exibição", "aria-expanded": String(!!reading.lookOpen),
      onclick: e => { e.stopPropagation(); rdToggleLook(); }}, "Aa"),
    look);
  const player = h("div", {class: "reader-controls rd-player"},
    h("button", {class: "icon-btn", type: "button", title: "Frase anterior (←)", "aria-label": "Frase anterior", onclick: () => stepSentence(-1)}, icon("skipBack", 16)),
    h("button", {id: "rdPlay", class: "primary small", type: "button", title: "Ler acompanhando o áudio (Espaço)", onclick: toggleFollow}, iconText("play", "Ler ouvindo")),
    h("button", {class: "icon-btn", type: "button", title: "Próxima frase (→)", "aria-label": "Próxima frase", onclick: () => stepSentence(1)}, icon("skipFwd", 16)),
    h("button", {class: "icon-btn", type: "button", title: "Repetir a frase (R)", "aria-label": "Repetir a frase", onclick: () => reading.sel >= 0 && playSentence(reading.sel)}, icon("repeat", 16)),
    speed,
    // O progresso do capítulo também fica na pílula, que continua à vista quando a barra de cima some ao rolar.
    phone ? null : h("span", {class: "rd-player-prog", "aria-hidden": "true"}, h("i", {class: "rd-prog-fill"})));
  const pickChip = reading.picking ? h("button", {class: "quiet small on", type: "button", title: "Parar de marcar a expressão", onclick: togglePick}, phone ? "✓ ✕" : "✓ Marcando expressão ✕") : null;
  const bar = phone
    ? h("div", {class: "reader-bar rd-bar-phone"},
      h("button", {class: "icon-btn quiet", type: "button", title: "Voltar à lista de livros", "aria-label": "Voltar à lista de livros", onclick: rdCloseBook}, "←"),
      chapterSelect, pickChip, lookWrap)
    : h("div", {class: "reader-bar"},
      h("div", {class: "rd-nav"}, h("button", {class: "quiet small rd-back", type: "button", title: "Voltar à estante", onclick: rdCloseBook}, iconText("back", "Estante")),
        h("span", {class: "rd-book-name", lang: "de", text: book.title}), chapterSelect),
      pickChip,
      h("span", {class: "rd-progress", "aria-hidden": "true"}, h("i", {id: "rdProgress", class: "rd-prog-fill"})),
      h("div", {class: "reader-controls rd-bar-end rd-tools"}, practiceBtn, savedBtn, lookWrap,
        h("button", {id: "rdFocusBtn", class: "icon-btn quiet", type: "button", title: reading.focus ? "Mostrar o menu do app (F)" : "Tela cheia de leitura (F)", "aria-label": "Tela cheia de leitura",
          onclick: () => rdSetFocus(!reading.focus)}, icon(reading.focus ? "minimize" : "maximize", 17))));
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
      // O primeiro parágrafo do capítulo ganha a capitular.
      if (!para) { para = h("p", {class: "rd-p" + (text.querySelector(".rd-p") || !/^\p{L}/u.test(s.text) ? "" : " rd-first")}); text.append(para); } else para.append(" ");
      para.append(sentenceNode(i));
      if ((reading.ptMode === "abaixo" || reading.ptMode === "toque") && notes && notes[s.id] && notes[s.id].pt)
        para.append(reading.ptMode === "toque" ? h("span", {class: "rd-pt fold", lang: "pt-BR"}, h("span", {text: notes[s.id].pt}))
          : h("span", {class: "rd-pt", lang: "pt-BR", text: " " + notes[s.id].pt}));
    }
  }
  if (typeof rdOpeningNode === "function") { const open = rdOpeningNode(); if (open) text.prepend(open); }
  text.append(typeof rdClosingNode === "function" ? rdClosingNode() : h("div", {class: "row center rd-end"}, h("button", {type: "button", onclick: markChapterRead}, "Capítulo lido ✓")));
  text.addEventListener("click", onReaderClick);
  if (typeof rdDecorateText === "function") rdDecorateText(text);
  applyReaderLook(text);
  hideReaderPop();
  // Resumo do capítulo (anotação): para ler antes; já aberto no 1º passo do ouvir → ler → ouvir.
  const summary = book.notes && book.notes.c && book.notes.c[reading.ch];
  const summaryOpen = !!summary && (reading.summaryOpen === reading.ch || !!(reading.cycle && reading.cycle.step === 1));
  const chips = rdChapterChips(summary, summaryOpen), summaryNode = summaryOpen ? h("div", {id: "rdSummary", class: "rd-summary panel", lang: "pt-BR"}, h("p", {text: summary})) : null;
  if (chips) chips.lang = "pt-BR";
  // No PC, o nome do livro vai para a barra e as etiquetas (Resumo, ciclo, %) viram o cabeçalho da própria página:
  // uma camada só antes do texto. No ciclo ouvir → ler → ouvir o texto fica borrado, então elas ficam fora da página.
  const inPaper = !phone && !reading.cycle;
  if (inPaper && (chips || summaryNode)) text.prepend(...[chips, summaryNode].filter(Boolean));
  chapterSelect.title = "Capítulo " + (reading.ch + 1) + " de " + book.chapters.length;
  // Capítulo novo entra com um deslize curto; renderizar o mesmo capítulo de novo (ajustes, tradução) não anima.
  const shown = book.id + ":" + reading.ch;
  if (reading.shownCh !== shown) { if (reading.shownCh) text.classList.add("rd-enter"); reading.shownCh = shown; }
  fill($("readingBook"),
    phone ? h("div", {class: "reader-head"}, h("p", {class: "label"}, h("span", {lang: "de", text: book.title}), ", capítulo " + (reading.ch + 1) + " de " + book.chapters.length)) : null,
    bar,
    warn ? h("p", {class: "notice warn", text: warn}) : null,
    inPaper ? null : chips,
    inPaper ? null : summaryNode,
    reading.cycle && typeof rdCycleBanner === "function" ? rdCycleBanner() : null,
    book.video && reading.audio ? h("div", {class: "rd-video-wrap"}, reading.audio) : null,
    // O player fica embaixo do texto: no PC, uma pílula que acompanha a rolagem; no celular, a faixa fixa do polegar.
    h("div", {class: "reader" + (reading.flow ? " flow" : "") + (typeof rdCycleHides === "function" && rdCycleHides() ? " cycle-hide" : "")}, text, h("aside", {id: "rdDetail", class: "reader-detail panel" + (phone ? " rd-sheet " + (reading.sheet === "full" ? "full" : "peek") : " rd-detail-empty"), hidden: reading.flow || (phone && !reading.sheet)}, detailPlaceholder()),
      // No PC a pílula fica numa faixa que acompanha a rolagem e esmaece o texto embaixo dela (nunca corta uma linha seca).
      phone ? player : h("div", {class: "rd-dock"}, player)));
  rdCheckDropCap(text);
  if (reading.sel >= a && reading.sel <= b) { highlightSentence(reading.sel); renderDetail(); }
  updateReaderControls();
  rdApplyFocus();
  if (typeof rdApplyPaper === "function") rdApplyPaper();
  rdWatchBar();
  document.body.classList.remove("rd-bar-up");
}
/* A capitular só fica quando o 1º parágrafo (ou a 1ª frase, na tradução de apoio) tem 2+ linhas para abraçá-la; com 1 linha ela invadia o que vem depois
   (o CSS ainda põe clear: left no seguinte, para o caso de a letra mudar de tamanho depois). Sem layout (tela escondida), mantém. */
function rdCheckDropCap(text) {
  const p = text.querySelector(".rd-p.rd-first");
  if (!p || typeof document.createRange !== "function") return;
  // Com a tradução de apoio, cada frase é seguida de um bloco (fecha a linha): só a 1ª frase fica ao lado da letra.
  const first = p.querySelector(".rd-s"), alone = first && first.nextElementSibling && first.nextElementSibling.classList.contains("fold");
  const r = document.createRange(); r.selectNodeContents(alone ? first : p);
  // A própria capitular é um retângulo bem mais alto: fica de fora da contagem das linhas.
  const rects = [...r.getClientRects()].filter(x => x.width > 1), low = Math.min(...rects.map(x => x.height));
  const tops = rects.filter(x => x.height < low * 1.6).map(x => x.top);
  if (tops.length && Math.max(...tops) - Math.min(...tops) < 10) p.classList.remove("rd-first");
}
/* Linha curta antes do texto: resumo do capítulo, ouvir → ler → ouvir e a dificuldade (explicação no título). */
function rdChapterChips(summary, summaryOpen) {
  const chips = [
    summary ? h("button", {id: "rdSummaryBtn", class: "chip small" + (summaryOpen ? " on" : ""), type: "button", "aria-expanded": String(summaryOpen), title: "Resumo do capítulo (conta o que acontece: melhor depois de ler)",
      onclick: () => { reading.summaryOpen = summaryOpen ? null : reading.ch; renderBook(); }}, iconText("bookOpen", "Resumo", 15)) : null,
    !reading.cycle && hasSync() && typeof rdCycleStart === "function" ? h("button", {class: "chip small", type: "button", title: "Ouvir o capítulo sem texto, ler com apoio e ouvir de novo", onclick: rdCycleStart}, iconText("repeat", "Ouvir → ler → ouvir", 15)) : null,
    typeof rdDifficultyNode === "function" ? rdDifficultyNode(true) : null].filter(Boolean);
  return chips.length ? h("div", {class: "rd-chips"}, ...chips) : null;
}
/* Tela cheia de leitura: sem o menu do app e sem o cabeçalho da página, só com um livro aberto na Leitura. */
function rdApplyFocus() {
  const open = currentView === "reading" && !!reading.book && !$("readingBook").hidden;
  document.body.classList.toggle("book-open", open);
  document.body.classList.toggle("reading-focus", open && !!reading.focus);
}
function rdSetFocus(on) {
  reading.focus = !!on;
  saveReadingState({focus: reading.focus});
  const btn = $("rdFocusBtn");
  if (btn) { fill(btn, icon(reading.focus ? "minimize" : "maximize", 17)); btn.title = reading.focus ? "Mostrar o menu do app (F)" : "Tela cheia de leitura (F)"; }
  rdApplyFocus();
  hideReaderPop();
}
function rdToggleLook(open = !reading.lookOpen) {
  reading.lookOpen = open;
  if (open) document.body.classList.remove("rd-bar-up");
  const menu = $("rdLook"), btn = $("rdLookBtn");
  if (menu) menu.hidden = !open;
  if (btn) { btn.classList.toggle("on", open); btn.setAttribute("aria-expanded", String(open)); }
}
document.addEventListener("click", e => { if (reading.lookOpen && !e.target.closest(".rd-look-wrap")) rdToggleLook(false); });
/* O painel lateral fica preso logo abaixo da barra, qualquer que seja a altura dela. */
function rdWatchBar() {
  const bar = document.querySelector("#readingBook .reader-bar");
  if (!bar || typeof ResizeObserver === "undefined") return;
  if (reading.barObs) reading.barObs.disconnect();
  reading.barObs = new ResizeObserver(() => $("readingBook").style.setProperty("--rdbar", Math.ceil(bar.offsetHeight) + "px"));
  reading.barObs.observe(bar);
}
// ---------- Celular: player embaixo, gaveta da frase e barra que se esconde ao rolar ----------
const rdPhoneMq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 600px), (max-width: 1024px) and (pointer: coarse)") : null;
function rdPhone() { return !!(rdPhoneMq && rdPhoneMq.matches); }
if (rdPhoneMq && rdPhoneMq.addEventListener) rdPhoneMq.addEventListener("change", () => { if (reading.book && reading.view === "text" && !$("readingBook").hidden) renderBook(); });
/* Altura coberta embaixo (player + gaveta aberta), para a frase escolhida não ficar escondida. */
function rdBottomCover() {
  let px = 0;
  for (const el of all("#readingBook .rd-player, #rdDetail.rd-sheet")) if (!el.hidden) px += el.getBoundingClientRect().height;
  return px;
}
/* Gaveta: fechada (null), pequena ("peek") ou aberta ("full"). Tocar no texto abre pequena. */
function rdOpenSheet() {
  if (!rdPhone() || reading.flow || reading.sheet) return;
  rdSetSheet("peek");
}
function rdSetSheet(state) {
  reading.sheet = state || null;
  const box = $("rdDetail");
  if (!box || !box.classList.contains("rd-sheet")) return;
  box.hidden = !reading.sheet;
  box.classList.toggle("full", reading.sheet === "full");
  box.classList.toggle("peek", reading.sheet === "peek");
  const grip = box.querySelector(".rd-grip");
  if (grip) grip.setAttribute("aria-label", reading.sheet === "full" ? "Mostrar menos" : "Mostrar mais");
  if (reading.sheet === "peek") box.scrollTop = 0;
  if (reading.sheet && reading.sel >= 0) requestAnimationFrame(() => scrollToSentence(reading.sel));
}
/* Topo da gaveta: puxador (toque alterna pequena/aberta; arrastar para cima abre, para baixo fecha) e ✕. */
function rdSheetHead() {
  if (!rdPhone() || reading.flow) return null;
  let y0 = null;
  const grip = h("button", {class: "rd-grip", type: "button", "aria-label": reading.sheet === "full" ? "Mostrar menos" : "Mostrar mais",
    onclick: () => rdSetSheet(reading.sheet === "full" ? "peek" : "full")}, h("span"));
  const head = h("div", {class: "rd-sheet-head"}, grip,
    h("button", {class: "icon-btn quiet rd-sheet-x", type: "button", "aria-label": "Fechar", onclick: () => rdSetSheet(null)}, "✕"));
  head.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; }, {passive: true});
  head.addEventListener("touchend", e => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (dy < -30) rdSetSheet("full");
    else if (dy > 30) rdSetSheet(reading.sheet === "full" ? "peek" : null);
  });
  return head;
}
/* Rolar para baixo esconde a barra de cima; rolar um pouco para cima (ou levar o mouse ao topo, no PC) mostra de novo. */
if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("mousemove", e => { if (e.clientY < 90 && document.body.classList.contains("rd-bar-up")) document.body.classList.remove("rd-bar-up"); }, {passive: true});
let rdLastY = 0;
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("scroll", () => {
  const y = window.scrollY;
  // Rolagem feita pelo app (abrir na última frase, acompanhar o áudio) não esconde a barra.
  if (!document.body.classList.contains("book-open") || reading.lookOpen || Date.now() - (reading.autoScroll || 0) < 1200) { rdLastY = y; if (y < 60) document.body.classList.remove("rd-bar-up"); return; }
  if (y > rdLastY + 8 && y > 90) document.body.classList.add("rd-bar-up");
  else if (y < rdLastY - 8 || y < 60) document.body.classList.remove("rd-bar-up");
  if (Math.abs(y - rdLastY) > 8) rdLastY = y;
}, {passive: true});
/* T: mostra ou esconde a tradução da frase escolhida, em qualquer modo de tradução. */
function rdToggleTranslation() {
  const i = reading.sel, s = reading.order[i], note = s && reading.book.notes && reading.book.notes.s && reading.book.notes.s[s.id];
  if (!note || !note.pt) { setStatus(i < 0 ? "Escolha uma frase primeiro." : "Esta frase não tem tradução anotada.", "info"); return; }
  const el = document.querySelector('#rdText .rd-s[data-i="' + i + '"]'), next = el && el.nextElementSibling;
  if (next && next.classList.contains("rd-pt")) { next.classList.toggle(next.classList.contains("fold") ? "open" : "shown"); return; }
  if (reading.flow) { const w = el && (el.querySelector(".rd-w.on") || el.querySelector(".rd-w")); if (w) showReaderPop(w); return; }
  const box = $("rdDetail"), shown = box && box.querySelector(".rd-translation");
  if (shown && reading.ptMode === "pedir") { renderDetail(); return; }
  const ask = box && [...box.querySelectorAll("button")].find(b => b.textContent === "Ver tradução");
  if (ask) ask.click();
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
/* Painel vazio: um convite curto, sem cartão (o cartão aparece no 1º toque; gestos e teclas ficam no Aa). */
function detailPlaceholder() {
  return h("p", {class: "rd-empty-hint", text: "Toque em qualquer palavra para ver o sentido, ouvir a frase e a gramática."});
}
/* Clique no texto: palavra da frase que já está escolhida só mostra a palavra (não relê a frase);
   frase nova toca o trecho; clique fora das palavras (espaço, pontuação) repete a frase.
   Lendo ouvindo, o clique só mostra a palavra e o áudio segue. */
function onReaderClick(e) {
  const pt = e.target.closest(".rd-pt");
  if (pt) { if (!pt.classList.contains("fold")) pt.classList.toggle("shown"); return; }
  const s = e.target.closest(".rd-s");
  if (!s) return;
  const i = Number(s.dataset.i), w = e.target.closest(".rd-w"), word = w ? w.textContent : "", k = w ? Number(w.dataset.k) : -1;
  const same = i === reading.sel;
  // Ctrl/Shift + clique (ou o modo “Marcar expressão”) junta palavras da mesma frase numa expressão.
  if (w && (e.ctrlKey || e.shiftKey || e.metaKey || reading.picking)) {
    if (!same) reading.pick = [];
    reading.pick = reading.pick.includes(k) ? reading.pick.filter(x => x !== k) : [...reading.pick, k].sort((a, b) => a - b);
    reading.sel = i; reading.word = ""; reading.wk = -1;
    rdOpenSheet();
    highlightSentence(i); renderDetail(); hideReaderPop();
    if (reading.flow && reading.pick.length) showReaderPop(w);
    return;
  }
  reading.pick = [];
  rdOpenSheet();
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
  const prev = document.querySelector("#rdText .rd-s.on");
  for (const el of all("#rdText .rd-s.on")) el.classList.remove("on");
  const el = document.querySelector('#rdText .rd-s[data-i="' + i + '"]');
  // A tradução de apoio da frase anterior vai se fechar: se ela está acima da nova, a nova sobe a altura dela,
  // e o destaque tem de pousar já no lugar final (antes ele pousava mais baixo e só depois a frase subia).
  const oldFold = document.querySelector("#rdText .rd-pt.fold.open");
  let dy = 0;
  if (el && oldFold && (oldFold.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) {
    const cs = getComputedStyle(oldFold);
    dy = oldFold.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }
  if (el) { if (prev && prev !== el) rdSlideMark(prev, el, dy); el.classList.add("on"); }
  for (const el2 of all("#rdText .rd-w.on, #rdText .rd-w.pick")) el2.classList.remove("on", "pick");
  if (!el) return;
  const ws = [...el.querySelectorAll(".rd-w")];
  if (reading.word) {
    const hit = ws.find(w => Number(w.dataset.k) === reading.wk) || ws.find(w => w.textContent === reading.word);
    if (hit) hit.classList.add("on");
  }
  for (const k of reading.pick || []) if (ws[k]) ws[k].classList.add("pick");
  for (const f of all("#rdText .rd-pt.fold.open")) f.classList.remove("open");
  const fold = el.nextElementSibling;
  if (fold && fold.classList.contains("fold")) fold.classList.add("open");
  if (typeof rdDrawBridges === "function") rdDrawBridges(i);
  if (typeof rdWatchSelection === "function") rdWatchSelection(el);
  const [pa, pb] = chapterRange(reading.ch);
  for (const prog of all(".rd-prog-fill")) setWidth(prog, pa < 0 ? 0 : (i - pa + 1) / Math.max(1, pb - pa + 1) * 100);
}
/* O destaque desliza da frase anterior para a nova (só a 1ª linha de cada uma, ~220 ms) e some quando o fundo da nova
   já apareceu. Sem animação com “reduzir movimento”, com a janela escondida ou se as frases estão longe na tela. */
function rdSlideMark(from, to, dy = 0) {
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.hidden || typeof Element === "undefined" || !Element.prototype.animate) return;
  const host = $("rdText"), a = from.getClientRects()[0], b0 = to.getClientRects()[0];
  const b = b0 && dy ? {left: b0.left, top: b0.top - dy, width: b0.width, height: b0.height} : b0;
  if (!host || !a || !b || Math.abs(a.top - b.top) > window.innerHeight * .6) return;
  // Fica dentro do texto, atrás das letras (o #rdText isola o empilhamento), e acompanha a rolagem.
  const c = host.getBoundingClientRect(), ghost = h("div", {class: "rd-mark-ghost", "aria-hidden": "true"});
  host.append(ghost);
  const box = r => ({left: (r.left - c.left) + "px", top: (r.top - c.top) + "px", width: r.width + "px", height: r.height + "px"});
  Object.assign(ghost.style, box(a));
  const anim = ghost.animate([{...box(a), opacity: 1}, {...box(b), opacity: 1, offset: .75}, {...box(b), opacity: 0}],
    {duration: 300, easing: "cubic-bezier(.77, 0, .175, 1)"}); // mover na tela: --ease-in-out
  const done = () => ghost.remove();
  anim.onfinish = done; anim.oncancel = done;
  setTimeout(done, 600);
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
  if (typeof rdDrawBridges === "function") rdDrawBridges(reading.sel, false);
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
  if (rdPhone()) {
    reading.autoScroll = Date.now();
    const bottom = window.innerHeight - rdBottomCover() - 16;
    if (block === "center" || r.top < 70 || r.bottom > bottom) window.scrollBy({top: r.top - Math.max(70, (bottom - r.height) * .35), behavior: scrollBehavior()});
    return;
  }
  if (block === "center" || r.top < 110 || r.bottom > window.innerHeight - 40) { reading.autoScroll = Date.now(); el.scrollIntoView({block: "center", behavior: scrollBehavior()}); }
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
function rdPanelFull() { return !!readingState().panelFull; }
/* Resumo da palavra numa linha, sem repetir: forma de dicionário, classe, gênero (na cor dele), plural, função e caso juntos. */
function wordSummary(occ, word) {
  if (!occ) return [];
  const parts = [];
  if (occ.lema && normWord(occ.lema) !== normWord(word)) parts.push(h("span", null, "de ", h("b", {lang: "de", text: occ.lema})));
  if (occ.classe) parts.push(occ.classe);
  if (occ.gen) parts.push(h("b", {class: "g-" + occ.gen, lang: "de", text: occ.gen}));
  if (occ.pl) parts.push(h("span", null, "plural ", h("span", {lang: "de", text: occ.pl})));
  const fn = occ.fn ? occ.fn + (occ.caso ? " (" + occ.caso + ")" : "") : occ.caso || "";
  if (fn) parts.push(fn);
  return parts;
}
/* Painel simples (padrão): a palavra, o sentido nesta frase e uma linha; o resto fica fechado em “Mais sobre…”. */
function wordCard(word, i, wk) {
  const s = reading.order[i], occ = typeof occurrence === "function" ? occurrence(i, wk) : null;
  const entry = typeof bookWordEntry === "function" ? bookWordEntry(word) : null;
  const pending = typeof rdPending !== "undefined" && rdPending.has("o|" + s.id + "|" + wk);
  // Palavra que já apareceu em 2+ frases estudadas do catálogo: só o sentido, sem a análise toda.
  const known = catalogWithWord(word).filter(studied).length >= 2;
  const parts = known ? [] : wordSummary(occ, word);
  const meaning = occ ? occ.pt : entry && entry[2] ? entry[2] : "";
  return h("section", {class: "rd-word rd-word-simple"},
    h("div", {class: "rd-word-top"},
      h("b", {class: "rd-word-form" + (occ && occ.gen ? " g-" + occ.gen : ""), lang: "de", text: word}),
      h("div", {class: "rd-word-acts"},
        h("button", {class: "icon-btn", type: "button", title: "Ouvir a palavra", "aria-label": "Ouvir a palavra", onclick: () => speak(word)}, icon("volume", 18)),
        typeof saveWordButton === "function" ? saveWordButton(word, i, wk) : null)),
    meaning ? h("p", {class: "rd-meaning", text: meaning}) : h("p", {class: "muted small-text", text: pending ? "Analisando o sentido nesta frase…" : "Sem o sentido desta palavra ainda."}),
    parts.length ? h("p", {class: "rd-word-sum"}, parts.flatMap((p, n) => n ? [", ", p] : [p])) : null,
    known ? h("p", {class: "rd-known", text: "Você já estudou esta palavra nos cartões."}) : null,
    h("details", {class: "rd-more"}, h("summary", null, "Mais sobre “", h("span", {lang: "de", text: word}), "”"), wordDetail(word, i, wk, true)));
}
/* Palavras da frase que a dica cita: verbo separável (as duas partes) e trechos entre aspas que existem na frase. */
/* Palavras que a caneta âmbar marca: as citadas entre aspas na dica; sem citação e com a dica vinda do tópico (`topics`),
   as que a regra do exercício muda para estragar a frase (`rdRuleWords`). Com a ponte do verbo ligada, as palavras da ponte
   ficam só com a cor dela (arco = estrutura do verbo, âmbar = ponto da dica); sem a ponte, o separável ganha a caneta. */
function rdTipWords(i, tip, topics = []) {
  const s = reading.order[i], {words} = sentenceTokens(s.text), ks = new Set(), low = words.map(w => String(w).toLocaleLowerCase("de"));
  for (const m of String(tip || "").matchAll(/["“„'‘]([^"”“'’]{1,40})["”“'’]/g))
    for (const piece of m[1].split(/\s+|…|\.\.\./)) { const k = low.indexOf(piece.toLocaleLowerCase("de")); if (piece && k >= 0) ks.add(k); }
  if (!ks.size) for (const id of topics.slice(0, 2)) { const r = rdRuleWords(s.text, id); if (r.size) { r.forEach(k => ks.add(k)); break; } }
  const notesW = reading.book.notes && reading.book.notes.w;
  if (readingState().bridges !== false && typeof rdVerbBridges === "function") {
    for (const b of rdVerbBridges(s.text, notesW)) for (const k of [b.a, b.b, b.c, ...(b.m || [])]) ks.delete(k);
  } else for (let k = 0; k < words.length; k++) { const sep = sepParticle(s.text, k, notesW); if (sep) { ks.add(k); ks.add(sep.k); break; } }
  return ks;
}
/* Onde a regra do tópico está na frase, por regra: o exercício “Escolha a forma” estraga a frase só na parte da regra
   (formItem); as palavras que mudaram são o lugar. Sem regra que consiga estragar a frase, nada é marcado (marcar a
   palavra errada seria pior). Devolve índices de `sentenceTokens().words`. */
function rdRuleWords(text, id) {
  const out = new Set();
  if (typeof formItem !== "function" || typeof exTokens !== "function") return out;
  let it = null;
  try { it = formItem({frase: text}, id); } catch (e) { it = null; }
  if (!it || !it.wrong) return out;
  const toks = exTokens(text), wr = exTokens(it.wrong), mark = new Set();
  if (wr.length === toks.length) toks.forEach((x, k) => { if (x !== wr[k]) mark.add(k); });
  else { const rest = [...wr]; toks.forEach((x, k) => { const j = rest.indexOf(x); if (j >= 0) rest.splice(j, 1); else mark.add(k); }); }
  if (!mark.size || mark.size > 3) return out;
  // Pedaço separado por espaço → palavras do texto („Was = uma palavra; Pelz-Schal pode dar duas).
  let w = 0;
  toks.forEach((x, k) => { const n = sentenceTokens(x).words.length; if (mark.has(k)) for (let q = 0; q < n; q++) out.add(w + q); w += n; });
  if (w !== sentenceTokens(text).words.length) out.clear();
  return out;
}
/* Marca-texto nas palavras da dica: a caneta passa palavra por palavra (--tip-d), só quando a marca muda; clicar noutra palavra da mesma frase não repete. */
let rdTipLast = "";
function rdMarkTip(i, ks) {
  const key = i + ":" + [...ks].sort((x, y) => x - y).join(","), marked = all("#rdText .rd-w.tip");
  if (key === rdTipLast && marked.length === ks.size) return;
  rdTipLast = key;
  for (const el of marked) el.classList.remove("tip");
  const el = document.querySelector('#rdText .rd-s[data-i="' + i + '"]');
  if (!el) return;
  let n = 0;
  for (const w of el.querySelectorAll(".rd-w")) if (ks.has(Number(w.dataset.k))) { w.style.setProperty("--tip-d", (260 + n++ * 120) + "ms"); w.classList.add("tip"); }
}
function wordDetail(word, i = reading.sel, wk = reading.wk, inner = false) {
  bookWordStats();
  const notes = reading.book.notes && reading.book.notes.w, k = normWord(word);
  const entry = notes && (notes[word] || notes[word.toLocaleLowerCase("de")] || notes[k]);
  const arts = reading.articles.get(word);
  const artText = arts ? [...arts.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => a + " " + word + (n > 1 ? " (" + n + "×)" : "")).join(" · ") : "";
  const examples = catalogWithWord(word);
  return h("section", {class: "rd-word"},
    inner ? null : h("div", {class: "row between"}, h("b", {class: "rd-word-form", lang: "de", text: word}),
      h("div", {class: "row"}, h("button", {class: "icon-btn", type: "button", title: "Ouvir a palavra", "aria-label": "Ouvir a palavra", onclick: () => speak(word)}, icon("volume", 18)),
        typeof saveWordButton === "function" ? saveWordButton(word, i, wk) : null)),
    typeof occurrenceBlock === "function" ? occurrenceBlock(i, wk, word) : null,
    entry ? h("p", {class: "small-text"}, h("span", {class: "muted", text: "Dicionário do livro: "}), h("span", {lang: "de", class: "rd-lemma", text: entry[0]}), entry[1] ? h("span", {class: "muted", text: " · " + entry[1]}) : null) : null,
    entry && entry[2] ? h("p", {class: "small-text", text: entry[2]}) : null,
    entry && entry[3] && !(typeof occurrence === "function" && occurrence(i, wk)) ? h("p", {class: "muted small-text", text: entry[3]}) : null,
    artText ? h("p", {class: "small-text"}, h("span", {class: "muted", text: "Com artigo no livro: "}), h("span", {lang: "de", text: artText})) : null,
    h("p", {class: "muted small-text", text: "Aparece " + (reading.wordCount.get(k) || 1) + "× no livro."}),
    examples.length ? h("div", {class: "rd-examples"}, h("span", {class: "muted small-text", text: "No seu catálogo:"}),
      ...examples.map(c => h("p", {class: "small-text"}, h("b", {lang: "de", text: c.frase}), h("span", {class: "muted", text: " — " + c.traducao})))) : null);
}
function bookGrammar(i) {
  const s = reading.order[i];
  const pseudo = {id: "livro:" + reading.book.id + ":" + s.id, frase: s.text, alvo: "", tags: "", situacao: "[neutro] "};
  const priority = ["konj1", "partizip", "nominal", "vermutung", "passivers", "fvg", "genpraep", "konnektb2", "plusquam", "konj2verg", "passiv2", "lassen", "zuinf", "obwohl", "temporal", "indem", "futur", "ndekl", "relativ", "indirekt", "umzu", "alswenn", "doppelkonj", "zweiobjekt", "daworter", "deshalb",
    "nebensatz", "v2", "trennbar", "perfekt", "praeteritum", "modal", "imperativ", "reflexiv", "passiv", "konjunktiv", "praep", "wfragen",
    "komparativ", "adjektiv", "possessiv", "konnektoren", "negacao", "falsos", "richtung", "praepdat", "praepakk", "uhrzeit", "perspron", "vokalwechsel", "plural", "man", "janeindoch", "praesens", "verbpaare", "zeitpraep", "demonstr", "wortbildung", "partikeln", "konj2irreal", "praetall", "ohnezu", "werden3", "adjsubst"];
  return topicsFor(pseudo).filter(id => id !== "genero").sort((a, b) => priority.indexOf(a) - priority.indexOf(b)).slice(0, 3);
}
function rdPanelSwap(box) {
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  box.classList.remove("rd-swap");
  void box.offsetWidth;
  box.classList.add("rd-swap");
  clearTimeout(rdPanelSwap.t);
  rdPanelSwap.t = setTimeout(() => box.classList.remove("rd-swap"), 260);
}
function renderDetail() {
  const box = $("rdDetail");
  if (!box || reading.sel < 0) return;
  box.classList.remove("rd-detail-empty");
  const i = reading.sel, s = reading.order[i], note = reading.book.notes && reading.book.notes.s && reading.book.notes.s[s.id];
  const topics = note && Array.isArray(note.t) && note.t.length ? note.t.filter(id => GRAMMAR_BY_ID.has(id)) : bookGrammar(i);
  const picked = (reading.pick || []).length, full = rdPanelFull();
  const tip = !full ? (note && note.g) || (topics[0] ? GRAMMAR_BY_ID.get(topics[0]).short : "") : "";
  const listen = [
    h("button", {class: full ? "small" : "small rd-act-main", type: "button", disabled: reading.starts[i] == null, onclick: () => playSentence(i)}, icon("volume", 16), "Ouvir"),
    h("button", {class: "small", type: "button", disabled: reading.starts[i] == null, onclick: () => playSentence(i, true)}, icon("slow", 16), "Devagar")];
  const toCard = h("button", {class: full ? "quiet small" : "small", type: "button", title: "Cria um rascunho de cartão em Minhas frases", onclick: e => {
    e.currentTarget.disabled = true;
    addMineDrafts(s.text, convAvailable(), "livro");
    toast("Rascunho criado em Minhas frases: confira e salve lá.", "success");
  }}, full ? "Criar cartão" : iconText("plus", "Criar cartão"));
  const copyBtn = h("button", {class: "quiet small", type: "button", onclick: () => copySentence(s.text)}, "Copiar");
  // Frase nova: o conteúdo entra com um fade curto; a mesma frase (explicação que chegou, palavra trocada) só se atualiza.
  const changed = box.dataset.sel !== String(i);
  box.dataset.sel = String(i);
  if (changed) rdPanelSwap(box);
  const wordPart = picked && typeof exprDetail === "function" ? exprDetail(i, reading.pick) : reading.word ? (full ? wordDetail(reading.word, i, reading.wk) : wordCard(reading.word, i, reading.wk)) : null;
  fill(box, rdSheetHead(),
    full ? wordPart : null,
    // Painel simples em dois cartões: a palavra e o que a frase diz (com o que fazer com ela) num; a gramática no outro.
    !full ? h("div", {class: "rd-card rd-card-main"}, wordPart, h("section", {class: "rd-sentence"},
      h("p", {class: "label rd-sec-label", text: "Nesta frase"}),
      note && note.pt ? (reading.ptMode === "pedir"
        ? h("button", {class: "quiet small", type: "button", onclick: e => e.currentTarget.replaceWith(h("p", {class: "rd-translation", text: note.pt}))}, "Ver tradução")
        : h("p", {class: "rd-translation", text: note.pt})) : null,
      h("div", {class: "row rd-acts"}, ...listen, toCard,
        h("details", {class: "rd-acts-more"}, h("summary", {class: "icon-btn", title: "Mais ações", "aria-label": "Mais ações"}, "⋯"),
          h("div", {class: "rd-acts-menu panel"}, copyBtn, typeof passageButton === "function" ? passageButton(i) : null))))) : null,
    !full && (tip || (typeof rdBridgeNotes === "function" && rdBridgeNotes(i).length)) ? h("section", {class: "rd-gram rd-card"},
      h("p", {class: "rd-gram-title"}, icon("book", 18), "Gramática"),
      typeof rdBridgeNotes === "function" ? rdBridgeNotes(i) : null,
      !tip ? null : h("div", {class: "rd-tip"}, h("p", {class: "rd-tip-text", text: tip}),
        topics.length ? h("div", {class: "rd-tip-topics"}, ...topics.slice(0, 2).map(id => h("button", {class: "rd-topic-link", type: "button", onclick: () => openGrammarDialog(id)}, iconText("book", GRAMMAR_BY_ID.get(id).title, 14)))) : null)) : null,
    !full ? null : h("section", {class: "rd-sentence"},
      h("p", {class: "rd-sent-de", lang: "de", text: s.text}),
      note && note.pt ? (reading.ptMode === "pedir"
        ? h("button", {class: "quiet small", type: "button", onclick: e => e.currentTarget.replaceWith(h("p", {class: "rd-translation", text: note.pt}))}, "Ver tradução")
        : h("p", {class: "rd-translation", text: note.pt})) : null,
      note && note.g ? h("p", {class: "small-text", text: note.g}) : null,
      h("div", {class: "row"}, ...listen, copyBtn, toCard, typeof passageButton === "function" ? passageButton(i) : null),
      topics.length ? h("div", {class: "rd-grammar"}, h("span", {class: "muted small-text", text: "Gramática nesta frase:"}),
        ...topics.map(id => { const t = GRAMMAR_BY_ID.get(id); return h("div", {class: "rd-topic"},
          h("button", {class: "chip chip-grammar small", type: "button", onclick: () => openGrammarDialog(id)}, iconText("book", t.title, 15)), h("p", {class: "muted small-text", text: t.short})); }))
        : h("p", {class: "muted small-text", text: note ? "" : "Sem ponto de gramática destacado nesta frase."})));
  rdMarkTip(i, tip ? rdTipWords(i, tip, note && note.g ? [] : topics) : new Set());
  if (typeof rdAwayUpdate === "function") rdAwayUpdate();
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
  const next = rdNextStart(i), end = reading.ends && reading.ends[i];
  // Com o fim da própria fala, um pouco de folga para a última sílaba, sem entrar na frase seguinte.
  if (end != null && end > reading.starts[i]) return Math.min(end + 250, next == null ? Infinity : next - 20);
  return next == null ? reading.starts[i] + 8000 : next - 60;
}
/* Onde o áudio da frase começa: um pouco antes da voz, sem pegar o fim da frase anterior. */
function rdFrom(i) {
  const prevEnd = i > 0 && reading.ends ? reading.ends[i - 1] : null;
  const lead = prevEnd != null && prevEnd < reading.starts[i] ? Math.min(150, Math.max(0, reading.starts[i] - prevEnd - 30)) : 150;
  return Math.max(0, reading.starts[i] - lead);
}
function rdNextStart(i) {
  for (let k = i + 1; k < reading.starts.length; k++) if (reading.starts[k] != null && reading.starts[k] > reading.starts[i]) return reading.starts[k];
  return null;
}
function playSentence(i, slow) {
  if (!hasSync() || reading.starts[i] == null) { if (reading.book && !hasSync()) setStatus("Sincronize o áudio do livro para ouvir frase por frase.", "info"); return; }
  stopAudio();
  const a = reading.audio;
  reading.follow = false;
  const playing = reading.playing = {i, end: sentenceEnd(i)};
  if (reading.sel !== i) { reading.sel = i; highlightSentence(i); renderDetail(); }
  rdSeek(rdFrom(i)).then(() => {
    if (reading.playing !== playing) return;
    a.playbackRate = reading.rate * (slow ? .75 : 1);
    a.play().catch(() => {});
    tickReading();
    rdStopGuard(playing);
    updateReaderControls();
  });
}
/* Para no fim da frase também por relógio: o laço de animação (tickReading) fica lento quando a janela está coberta
   ou sem foco, e a frase seguinte começava a tocar (medido: até 0,8 s a mais). */
function rdStopGuard(playing) {
  clearTimeout(reading.stopTimer);
  const a = reading.audio;
  if (reading.playing !== playing || !a || a.paused) return;
  const left = (playing.end - rdNowMs()) / (a.playbackRate || 1);
  if (left <= 12) { a.pause(); reading.playing = null; updateReaderControls(); return; }
  reading.stopTimer = setTimeout(() => rdStopGuard(playing), left > 400 ? left - 200 : Math.max(8, left - 10));
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
    if (!a || a.paused) { rdLightWord(-1); updateReaderControls(); return; }
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
    } else if (reading.playing && ms >= reading.playing.end) { a.pause(); reading.playing = null; rdLightWord(-1); updateReaderControls(); return; }
    rdLightWord(reading.follow ? reading.sel : reading.playing ? reading.playing.i : -1, ms);
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
  return rdSeek(rdFrom(i)).then(() => {
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
  if (reading.follow && reading.audio && !reading.audio.paused) { const a = reading.audio; rdSeek(rdFrom(next)).then(() => { if (reading.follow && a.paused) a.play().catch(() => {}); }); }
  else if (reading.clickPlays) playSentence(next);
}
/* Palavra falada agora na frase i (índice k do data-k) ou -1. Acende 60 ms antes do início medido (o alinhador
   começa em média ~50 ms depois da voz) e apaga 250 ms depois do fim da última palavra. */
function rdSpokenWord(i, ms) {
  const row = reading.wt && reading.wt[i];
  if (!row) return -1;
  let n = -3;
  while (n + 3 < row.length && row[n + 4] <= ms + 60) n += 3;
  if (n < 0 || (n + 3 >= row.length && row[n + 2] + 250 < ms)) return -1;
  return row[n];
}
function rdLightWord(i, ms) {
  const cyc = reading.cycle && reading.cycle.step !== 2; // texto borrado no ciclo: acender entregaria a palavra
  const k = i >= 0 && !cyc && readingState().wordLight !== false ? rdSpokenWord(i, ms) : -1;
  const lit = reading.lit;
  if (lit && lit.i === i && lit.k === k && (!lit.el || lit.el.isConnected)) return;
  if (lit && lit.el) lit.el.classList.remove("spoken");
  const el = k >= 0 ? document.querySelector("#rdText .rd-s[data-i=\"" + i + "\"] .rd-w[data-k=\"" + k + "\"]") : null;
  if (el) el.classList.add("spoken");
  reading.lit = {i, k, el};
}
function stopReadingAudio() {
  rdLightWord(-1);
  cancelAnimationFrame(reading.raf);
  if (reading.audio) reading.audio.pause();
  reading.follow = false;
  reading.playing = null;
}
function updateReaderControls() {
  const btn = $("rdPlay");
  if (!btn) return;
  const on = reading.follow && reading.audio && !reading.audio.paused;
  fill(btn, iconText(on ? "pause" : "play", on ? "Pausar" : "Ler ouvindo"));
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
  if (!reading.book) return reading.view === "review" && typeof bookPracticeKey === "function" ? bookPracticeKey(e) : false;
  if ($("readingBook").hidden) return false;
  if (reading.view !== "text") return typeof bookPracticeKey === "function" ? bookPracticeKey(e) : false;
  if (e.key === "Escape" && reading.lookOpen) { e.preventDefault(); rdToggleLook(false); return true; }
  if (e.key === "Escape" && (document.getElementById("rdPop") || (reading.pick || []).length)) {
    e.preventDefault(); hideReaderPop(); reading.pick = []; if (reading.sel >= 0) { highlightSentence(reading.sel); renderDetail(); } return true;
  }
  const key = e.key.toLowerCase();
  if (e.code === "Space") { e.preventDefault(); toggleFollow(); return true; }
  if (e.key === "ArrowRight") { e.preventDefault(); stepSentence(1); return true; }
  if (e.key === "ArrowLeft") { e.preventDefault(); stepSentence(-1); return true; }
  if (key === "r" && reading.sel >= 0) { e.preventDefault(); playSentence(reading.sel); return true; }
  if (key === "d" && reading.sel >= 0) { e.preventDefault(); playSentence(reading.sel, true); return true; }
  if (key === "t") { e.preventDefault(); rdToggleTranslation(); return true; }
  if (key === "f") { e.preventDefault(); rdSetFocus(!reading.focus); return true; }
  return false;
}
function bindReading() {
  if (window.satzDesktop && window.satzDesktop.onBookProgress) window.satzDesktop.onBookProgress(onBookProgress);
}
