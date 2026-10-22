"use strict";
/* Leitura (ajudas de compreensão no texto): ponte do verbo (Satzklammer) na frase escolhida, cor do gênero nos substantivos,
   palavras ainda não estudadas, abertura e fechamento do capítulo, fundo do livro (papel, sépia, noite) e o aviso de quando
   a frase do painel saiu da tela. Usa o dicionário do livro (notes.w: forma → [lema, classe, significado, obs]).
   Carregado depois de leitura-extra.js; usa o estado de app.js e de leitura.js só quando chamado. */

// ---------- Ponte do verbo ----------
/* Conjunções que mandam o verbo para o fim da oração (só valem no começo dela). Ficaram de fora as que também são
   preposição ou advérbio no começo da frase (seit, bis, während, da). */
const RD_SUBORD = new Set(["dass", "daß", "weil", "als", "wenn", "ob", "obwohl", "obgleich", "damit", "bevor", "nachdem", "sobald", "falls", "indem", "sodass", "solange", "ehe"]);
// Verbos que abrem a “ponte” na oração principal: auxiliares, modais e lassen (habe … gesehen, kann … kommen, ließ … duften).
const RD_BRIDGE_LEMMA = new Set(["haben", "sein", "werden", "können", "müssen", "wollen", "sollen", "dürfen", "mögen", "möchten", "lassen"]);
function rdIsAux(word, notesW) {
  const low = word.toLocaleLowerCase("de"), e = notesW && notesW[low];
  return e && e[0] ? RD_BRIDGE_LEMMA.has(String(e[0]).toLocaleLowerCase("de").replace(/^sichs+/, "")) : RD_AUX.has(low);
}
const RD_AUX = new Set(["habe", "hast", "hat", "haben", "habt", "hatte", "hattest", "hatten", "hattet", "bin", "bist", "ist", "sind", "seid", "war", "warst", "waren", "wart",
  "werde", "wirst", "wird", "werden", "werdet", "wurde", "wurden", "kann", "kannst", "können", "könnt", "konnte", "konnten", "muss", "musst", "müssen", "musste", "mussten",
  "will", "willst", "wollen", "wollte", "wollten", "soll", "sollst", "sollen", "sollte", "sollten", "darf", "darfst", "dürfen", "durfte", "möchte", "möchtest", "möchten", "würde", "würden"]);
function rdIsVerb(word, k, notesW) {
  const low = word.toLocaleLowerCase("de"), e = notesW && notesW[low];
  if (e && e[1]) return e[1] === "verbo";
  return RD_AUX.has(low) && (k === 0 || !/^\p{Lu}/u.test(word));
}
/* Pares de palavras ligadas na frase: [conjunção, verbo no fim] na subordinada, [verbo conjugado, particípio/infinitivo]
   na principal e [verbo, prefixo] no separável. Só quando há pelo menos uma palavra entre as duas partes. Máximo de 3. */
function rdVerbBridges(text, notesW) {
  const {words, ends} = sentenceTokens(text), out = [];
  let s = 0;
  for (let k = 0; k < words.length; k++) {
    if (!ends[k]) continue;
    // “und weil …”, “aber wenn …”: a conjunção que manda o verbo para o fim pode vir depois de und/aber/oder/denn.
    const e = k, lead = /^(und|aber|oder|denn)$/i.test(words[s]) && s < e ? s + 1 : s, first = words[lead].toLocaleLowerCase("de"), verbs = [];
    for (let j = s; j <= e; j++) if (rdIsVerb(words[j], j, notesW)) verbs.push(j);
    if (e - s >= 2) {
      const last = verbs[verbs.length - 1];
      if (RD_SUBORD.has(first) && verbs.length && last - lead >= 2) out.push({a: lead, b: last, kind: "neben"});
      else if (verbs.length >= 2 && last - verbs[0] >= 2 && rdIsAux(words[verbs[0]], notesW)) out.push({a: verbs[0], b: last, kind: "klammer"});
      else if (verbs.length === 1) { const sep = sepParticle(text, verbs[0], notesW); if (sep && sep.k <= e && sep.k - verbs[0] >= 2) out.push({a: verbs[0], b: sep.k, kind: "trennbar"}); }
    }
    s = k + 1;
  }
  return out.slice(0, 3);
}
const RD_BRIDGE_TIP = {neben: "a conjunção manda o verbo para o fim", klammer: "o verbo se divide: a 2ª parte fecha a frase", trennbar: "verbo separável: o prefixo vai para o fim"};
/* Na frase escolhida: as duas partes ganham a mesma cor e, se estiverem na mesma linha, um arco que se desenha entre elas. */
function rdDrawBridges(i) {
  const text = $("rdText");
  if (!text) return;
  text.querySelectorAll(".rd-bridges").forEach(x => x.remove());
  for (const w of text.querySelectorAll(".rd-w.vb")) { w.classList.remove("vb", "vb-1", "vb-2", "vb-3"); w.removeAttribute("title"); }
  if (i < 0 || readingState().bridges === false || !reading.book) return;
  const el = text.querySelector('.rd-s[data-i="' + i + '"]');
  if (!el) return;
  const ws = [...el.querySelectorAll(".rd-w")], bridges = rdVerbBridges(reading.order[i].text, reading.book.notes && reading.book.notes.w);
  if (!bridges.length) return;
  const box = text.getBoundingClientRect(), svg = svgEl("svg", {class: "rd-bridges", width: box.width, height: box.height, "aria-hidden": "true"});
  bridges.forEach((b, n) => {
    const A = ws[b.a], B = ws[b.b];
    if (!A || !B) return;
    for (const w of [A, B]) { w.classList.add("vb", "vb-" + (n + 1)); w.title = RD_BRIDGE_TIP[b.kind]; }
    const ra = A.getClientRects()[0], rb = B.getClientRects()[0];
    if (!ra || !rb || Math.abs(ra.top - rb.top) > 4) return;
    const x1 = ra.left + ra.width / 2 - box.left, x2 = rb.left + rb.width / 2 - box.left, y = ra.top - box.top + 1, lift = Math.min(7, 3 + (x2 - x1) * .02);
    svg.append(svgEl("path", {class: "vb-arc vb-" + (n + 1), d: "M" + x1.toFixed(1) + " " + y.toFixed(1) + " C" + x1.toFixed(1) + " " + (y - lift).toFixed(1) + " " + x2.toFixed(1) + " " + (y - lift).toFixed(1) + " " + x2.toFixed(1) + " " + y.toFixed(1), pathLength: "100"}));
  });
  if (svg.childNodes.length) text.append(svg);
}
window.addEventListener("resize", () => { if (reading.book && reading.sel >= 0 && currentView === "reading") rdDrawBridges(reading.sel); });

// ---------- Gênero e palavras novas no texto ----------
function rdDecorateText(text) {
  const st = readingState(), notesW = reading.book.notes && reading.book.notes.w;
  if (!st.gender && !st.newWords) return;
  const known = st.newWords && typeof rdKnownForms === "function" ? rdKnownForms().mine : null, names = known ? rdNames(reading.book) : null;
  for (const w of text.querySelectorAll(".rd-p .rd-s .rd-w")) {
    const low = w.textContent.toLocaleLowerCase("de"), e = notesW && notesW[low];
    if (st.gender && e && e[1] === "substantivo") { const m = /^(der|die|das)\s/.exec(e[0] || ""); if (m) w.classList.add("gn", "gn-" + m[1]); }
    if (known && /\p{L}{3,}/u.test(w.textContent)) { const k = normWord(w.textContent); if (!known.has(k) && !names.has(k)) w.classList.add("nw"); }
  }
}

// ---------- Abertura e fechamento do capítulo ----------
/* Antes de ler: uma linha do resumo e as 5 palavras novas mais frequentes do capítulo (toque para ouvir). */
function rdOpeningNode() {
  const book = reading.book, c = book.notes && book.notes.c && book.notes.c[reading.ch];
  const line = c ? String(c).split(/(?<=[.!?])\s+/)[0] : "";
  // Só substantivos, verbos e adjetivos (palavras como “wie” e “auch” não ajudam a entender a história).
  const words = typeof chapterGlossary === "function" ? chapterGlossary(reading.order, book.notes && book.notes.w, reading.ch, 40).filter(w => ["substantivo", "verbo", "adjetivo"].includes(w.classe)).slice(0, 5) : [];
  if (!line && !words.length) return null;
  return h("aside", {class: "rd-open", lang: "pt-BR"},
    h("p", {class: "label", text: "Antes de ler"}),
    line ? h("p", {class: "rd-open-line", text: line}) : null,
    words.length ? h("div", {class: "rd-open-words"}, ...words.map(w => h("button", {class: "rd-open-word", type: "button", title: "Ouvir", onclick: () => speak(w.lema || w.w)},
      h("b", {lang: "de", text: w.lema || w.w}), w.pt ? h("span", {text: w.pt}) : null))) : null);
}
/* Fim do capítulo: o que você fez hoje e o próximo passo à vista. */
function rdClosingNode() {
  const book = reading.book, last = reading.ch === book.chapters.length - 1;
  const min = typeof readingLog === "function" ? Math.round(((readingLog().days[dateKey()] || {}).ms || 0) / 60000) : 0;
  const saved = typeof savedWordsOf === "function" ? savedWordsOf(book.id).filter(x => { const i = reading.byId.get(x.sid); return i != null && reading.order[i].ch === reading.ch; }).length : 0;
  const next = () => { reading.ch++; reading.sel = -1; reading.cycle = null; stopReadingAudio(); renderBook(); window.scrollTo({top: 0}); saveBookPosition(); };
  return h("section", {class: "rd-close", lang: "pt-BR"},
    h("p", {class: "label", text: "Fim do capítulo " + (reading.ch + 1)}),
    h("p", {class: "rd-close-stats"}, h("b", {text: min + " min"}), " de leitura hoje", saved ? ", " : "", saved ? h("b", {text: String(saved)}) : null, saved ? (saved === 1 ? " palavra guardada neste capítulo" : " palavras guardadas neste capítulo") : ""),
    last ? h("p", {class: "rd-close-next", text: "Você chegou ao fim do livro."})
      : h("p", {class: "rd-close-next"}, "Próximo: ", h("b", {lang: "de", text: book.chapters[reading.ch + 1].title})),
    h("div", {class: "row"},
      h("button", {type: "button", onclick: markChapterRead}, "Capítulo lido ✓"),
      last ? null : h("button", {class: "primary", type: "button", onclick: next}, "Continuar no próximo")));
}

// ---------- Fundo do livro ----------
const RD_PAPERS = {padrao: "Do app", sepia: "Sépia", noite: "Noite"};
function rdApplyPaper() {
  const p = readingState().paper, open = document.body.classList.contains("book-open");
  document.body.classList.toggle("rd-paper-sepia", open && p === "sepia");
  document.body.classList.toggle("rd-paper-noite", open && p === "noite");
}

// ---------- Frase do painel fora da tela ----------
/* O painel mostra a frase escolhida mesmo depois que ela sai da tela; aí ele avisa e oferece voltar até ela. */
let rdSelObserver = null, rdSelAway = false, rdAwayDir = "up";
function rdWatchSelection(el) {
  if (typeof IntersectionObserver !== "function") return;
  if (rdSelObserver) rdSelObserver.disconnect();
  rdSelAway = false;
  rdAwayUpdate();
  if (!el) return;
  rdSelObserver = new IntersectionObserver(([e]) => { rdSelAway = !e.isIntersecting; rdAwayUpdate(e.boundingClientRect.top < 0 ? "up" : "down"); }, {threshold: 0});
  rdSelObserver.observe(el);
}
function rdAwayUpdate(dir) {
  if (dir) rdAwayDir = dir;
  const box = $("rdDetail");
  if (!box) return;
  box.classList.toggle("away", rdSelAway);
  let bar = box.querySelector(".rd-away");
  if (!rdSelAway) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = h("button", {class: "rd-away", type: "button", onclick: () => scrollToSentence(reading.sel, "center")});
    box.prepend(bar);
  }
  fill(bar, icon("chevron", 14), rdAwayDir === "up" ? "A frase está mais acima: voltar a ela" : "A frase está mais abaixo: ir até ela");
}
