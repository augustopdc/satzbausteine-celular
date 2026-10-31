"use strict";
/* Menschen: o livro do curso particular (Menschen A2.1 e A2.2, Hueber) dentro do app, só no PC. Lição com `passos` abre pela aula
   guiada (menschen-aula.js); o material solto (metas, frases de reforço do catalog-menschen.js com tag MS::LL, gramática,
   palavras, áudios, conversa) fica em “Tudo da lição”. Os áudios do livro tocam em etapas (ouvir, ler com tradução e
   significado das palavras, ouvir de novo, repetir com Whisper, ditado), com as anotações de Menschen/satz/notas.
   O livro, os áudios e as transcrições ficam na pasta Menschen ao lado do app (fora do Git): satz://app/menschen/…
   “Estou na Lektion” (settings.msLesson) libera as frases até a lição e as põe primeiro entre as novas (orderNew). */
const menschen = {view: null, info: null, infoAsked: false, track: null, data: null, mode: "ler", audio: null, until: null, onUntil: null, playing: -1,
  dk: 0, wordOpen: null, passo: null, cache: null, ctx: null, pop: null, showPt: new Set(), allPt: false, heard: false, rk: 0, rres: null, rphase: "", rclip: null, rtk: 0, slow: false};

function msLessonData(n) { return MENSCHEN_LICOES.find(l => l.n === n) || MENSCHEN_LICOES[0]; }
function msCurrent() { const n = Number(settings.msLesson); return n >= 1 && n <= MENSCHEN_LICOES.length ? n : 1; }
function msLessonCards(n) { const ll = String(n).padStart(2, "0"); return cards.filter(c => tag(c, "MS") === ll); }
/* O curso são dois livros: lições 1–12 no A2.1 (faixas kb-NN/ab-NN), 13–24 no A2.2 (faixas kb2-NN/ab2-NN); a numeração das páginas e das faixas recomeça. */
const MS_BOOK2_FROM = 13;
function msBook(n) { return n >= MS_BOOK2_FROM ? "A2.2" : "A2.1"; }
function msPages(l) {
  const b = msBook(l.n);
  return [l.kb ? "Kursbuch " + b + ", p. " + l.kb[0] + "–" + l.kb[1] : "", l.ab ? "Arbeitsbuch " + b + ", p. " + l.ab[0] + "–" + l.ab[1] : ""].filter(Boolean).join(" · ");
}
function msTrackNo(id) { return id.split("-")[1]; }
/* Faixas da lição: as descritas em menschen-data.js; sem descrição, as do Kursbuch cujo arquivo diz “LektionN”. */
function msTracks(l) {
  const info = (menschen.info && menschen.info.tracks) || {};
  if (l.faixas) return l.faixas.filter(([id]) => info[id]).map(([id, label]) => ({id, label, text: info[id].text}));
  const re = new RegExp("Lektion ?" + l.n + "(?![0-9])");
  return Object.entries(info).filter(([, t]) => re.test(t.name || "")).map(([id, t]) => ({id, label: "Kursbuch · faixa " + msTrackNo(id), text: t.text}));
}
async function msLoadInfo() {
  if (menschen.infoAsked) return;
  menschen.infoAsked = true;
  try {
    const r = await fetch("menschen/faixas");
    menschen.info = r.ok ? await r.json() : {tracks: {}};
  } catch (e) { menschen.info = {tracks: {}}; }
  if (currentView === "menschen" && !menschen.track && !menschen.passo) renderMenschen();
}

function renderMenschen() {
  const box = $("menschenRoot");
  if (!box) return;
  if (!menschen.view) menschen.view = msCurrent();
  msLoadInfo();
  if (menschen.passo && typeof msPassoView === "function") return msPassoView(box);
  if (menschen.track) return msTrackView(box);
  const l = msLessonData(menschen.view), cur = msCurrent();
  const stepBtn = x => h("button", {class: "ms-step" + (x.n === cur ? " current" : "") + (x.n < cur ? " done" : ""), type: "button", role: "tab",
    "aria-selected": String(x.n === l.n), title: "Menschen " + msBook(x.n) + ", Lektion " + x.n + ": " + x.tema, onclick: () => { menschen.view = x.n; menschen.wordOpen = null; renderMenschen(); }}, String(x.n));
  const strip = h("div", {class: "ms-strip", role: "tablist", "aria-label": "Lições"},
    ...["A2.1", "A2.2"].map(b => h("div", {class: "ms-strip-book", role: "presentation"}, h("span", {class: "ms-strip-label", text: b}),
      ...MENSCHEN_LICOES.filter(x => msBook(x.n) === b).map(stepBtn))));
  const isCur = l.n === cur;
  const head = h("div", {class: "panel ms-head"},
    h("p", {class: "ms-kicker", text: "Menschen " + msBook(l.n) + " · Lektion " + l.n + " · Modul " + l.modulo + " · " + l.tema}),
    h("h2", {class: "ms-title", lang: "de", text: l.titulo}),
    h("p", {class: "muted small-text", text: msPages(l)}),
    isCur ? h("span", {class: "ms-badge", text: "Sua lição agora"})
      : h("button", {class: "small", type: "button", onclick: () => msSetLesson(l.n)}, "Estou nesta lição"));
  const blocks = [msGoalsBlock(l), msCardsBlock(l), msGramBlock(l), msAudioBlock(l), msWordsBlock(l), msTalkBlock(l)].filter(Boolean);
  // Lição com aula preparada: a porta é a aula (passos na ordem do livro); o material solto fica em “Tudo da lição”.
  if (l.passos && typeof msAulaHome === "function") return fill(box, strip, head, ...msAulaHome(l, blocks));
  fill(box, strip, head, h("div", {class: "ms-grid"}, ...blocks));
}
function msSetLesson(n) {
  settings.msLesson = n;
  saveSettings();
  toast("Lição " + n + " marcada: as frases dela entram primeiro entre as novas.", "success");
  renderMenschen();
}
function msGoalsBlock(l) {
  if (!l.metas) return h("div", {class: "panel ms-block ms-wide"}, h("h3", {text: "Em preparação"}),
    h("p", {class: "muted", text: "Esta lição ainda não tem frases nem a lista de palavras. Por enquanto: a gramática e os áudios do livro."}));
  return h("div", {class: "panel ms-block"}, h("h3", {text: "Nesta lição você consegue"}),
    h("ul", {class: "ms-goals"}, ...l.metas.map(m => h("li", null, icon("check", 16), h("span", {text: m})))));
}
function msCardsBlock(l) {
  const list = msLessonCards(l.n);
  if (!list.length) return null;
  const seen = list.filter(c => cardProgress(c.id) && cardProgress(c.id).introducedAt).length;
  const solid = list.filter(levelMastered).length;
  const bar = h("div", {class: "ms-bar"}, h("span", {style: "width:" + Math.round(seen / list.length * 100) + "%"}));
  return h("div", {class: "panel ms-block"}, h("h3", {text: "Frases da lição"}),
    h("p", {class: "ms-count"}, h("b", {text: seen}), " de " + plural(list.length, "frase", "frases") + " já vistas"),
    bar,
    h("p", {class: "muted small-text", text: solid ? plural(solid, "frase firme", "frases firmes") + " (a última produção não foi “De novo”)." : "Frases do dia a dia com o vocabulário e a gramática da lição."}),
    h("button", {class: "primary", type: "button", onclick: () => msStudy(l.n)}, iconText("play", "Estudar estas frases")));
}
/* Treino só com as frases da lição (sem mexer nos filtros do Treino): primeiro as vencidas, depois até 8 novas na ordem
   da lição; se não houver nenhuma das duas, as 10 já vistas com menor chance de lembrar. */
const MS_NEW_PER_RUN = 8;
function msStudyQueue(n, now = Date.now()) {
  const list = msLessonCards(n), endOfToday = dayStart(dateAfter(1));
  const due = [], seen = [], fresh = [];
  for (const c of list) {
    const p = modeProgress(c.id, "production");
    if (p) (p.due < endOfToday ? due : seen).push(c);
    else if (!(cardProgress(c.id) && cardProgress(c.id).introducedAt)) fresh.push(c);
  }
  fresh.sort(sortNew);
  const ids = [...due, ...fresh.slice(0, MS_NEW_PER_RUN)].map(c => c.id);
  if (ids.length) return ids;
  return seen.sort((a, b) => retrievabilityNow(modeProgress(a.id, "production"), now) - retrievabilityNow(modeProgress(b.id, "production"), now)).slice(0, 10).map(c => c.id);
}
function msStudy(n) {
  showView("practice");
  setSessionMode("production");
  startSession({custom: msStudyQueue(n), label: "Menschen · Lektion " + n});
}
function msGramBlock(l) {
  const topics = (l.gram || []).filter(id => typeof GRAMMAR_BY_ID !== "undefined" && GRAMMAR_BY_ID.has(id));
  return h("div", {class: "panel ms-block"}, h("h3", {text: "Gramática"}),
    l.nota ? h("p", {class: "ms-note", text: l.nota}) : null,
    topics.length ? h("div", {class: "chips"}, ...topics.map(id => h("button", {class: "chip", type: "button", onclick: () => { showView("grammar"); renderGrammarTopic(id); }},
      GRAMMAR_BY_ID.get(id).title))) : null);
}
function msAudioBlock(l) {
  if (!menschen.info) return h("div", {class: "panel ms-block"}, h("h3", {text: "Áudios do livro"}), h("p", {class: "muted", text: "Procurando os áudios…"}));
  const tracks = msTracks(l);
  if (!tracks.length) return h("div", {class: "panel ms-block"}, h("h3", {text: "Áudios do livro"}),
    h("p", {class: "muted small-text", text: Object.keys(menschen.info.tracks || {}).length ? "Nenhum áudio desta lição foi encontrado." : "Os áudios ficam na pasta Menschen, ao lado do app (pastas “Kursbuch A2.1 Audios”, “Arbeitsbuch A2.1 Audios” e as do A2.2)."}));
  return h("div", {class: "panel ms-block"}, h("h3", {text: "Áudios do livro"}),
    h("p", {class: "muted small-text", text: "Ouça com o texto, esconda o texto ou faça ditado frase por frase."}),
    h("div", {class: "ms-tracks"}, ...tracks.map(t => h("button", {class: "ms-track", type: "button", disabled: !t.text, onclick: () => msOpenTrack(t)},
      h("span", {class: "ms-track-book", text: t.id.startsWith("kb") ? "KB" : "AB"}),
      h("span", {class: "ms-track-label", text: t.label}),
      h("span", {class: "muted small-text", text: t.text ? "" : "sem texto ainda"})))));
}
function msWordsBlock(l) {
  if (!l.palavras) return null;
  const known = msKnownWords();
  const rows = l.palavras.map(([de, extra, pt]) => {
    const m = de.match(/^(der|die|das)\s+(.+)$/), cls = m ? genderClass(m[1], m[2]) : "";
    const open = menschen.wordOpen === de;
    const studied = known(de);
    const row = h("button", {class: "ms-word" + (open ? " open" : ""), type: "button", "aria-expanded": String(open), onclick: () => { menschen.wordOpen = open ? null : de; renderMenschen(); }},
      h("span", {class: "ms-de" + (cls && settings.genderColors ? " gender " + cls : ""), lang: "de", text: de}),
      extra ? h("span", {class: "ms-extra", lang: "de", text: extra}) : null,
      h("span", {class: "ms-pt", text: pt}),
      studied ? h("span", {class: "ms-dot", title: "Já aparece nas frases que você estudou"}) : null);
    return open ? [row, msWordExamples(de)] : [row];
  });
  return h("div", {class: "panel ms-block ms-wide"}, h("h3", {text: "Palavras da lição"}),
    h("p", {class: "muted small-text", text: "Toque numa palavra para ver frases do app com ela. O ponto verde marca as que já apareceram nas frases que você estudou."}),
    h("div", {class: "ms-words"}, ...rows.flat()));
}
/* Núcleo da palavra para busca: sem artigo e, nos verbos com Perfekt na lista, o infinitivo. */
function msWordCore(de) { return normWord(de.replace(/^(der\/die|der|die|das)\s+/, "").split(/\s+/)[0]); }
function msWordRegex(de) {
  const core = msWordCore(de).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^\\p{L}])" + core.slice(0, Math.max(4, core.length - 2)), "iu");
}
function msKnownWords() {
  const seen = cards.filter(c => cardProgress(c.id) && cardProgress(c.id).introducedAt).map(c => c.frase).join(" \n ");
  return de => msWordCore(de).length > 2 && msWordRegex(de).test(seen);
}
function msWordExamples(de) {
  const re = msWordRegex(de);
  const found = cards.filter(c => tag(c, "Modus") === "Produktion" && re.test(c.frase) && !isHiddenCard(c))
    .sort((a, b) => (tag(b, "MS") ? 1 : 0) - (tag(a, "MS") ? 1 : 0) || a.frase.length - b.frase.length).slice(0, 3);
  return h("div", {class: "ms-examples"}, found.length ? found.map(c => h("p", null, h("span", {lang: "de", text: c.frase}), h("span", {class: "muted", text: c.traducao})))
    : h("p", {class: "muted small-text", text: "Ainda não há frases do app com esta palavra."}));
}
function msTalkBlock(l) {
  if (!l.conversa) return null;
  const ok = convAvailable();
  return h("div", {class: "panel ms-block"}, h("h3", {text: "Falar sobre o tema"}),
    h("p", {class: "muted small-text", text: "Conversa livre com a IA sobre o tema da lição, no seu nível, usando a gramática dela."}),
    h("button", {type: "button", disabled: !ok, onclick: () => msTalk(l)}, iconText("chat", "Conversar: " + l.conversa.pt)));
}
function msTalk(l) {
  const topic = {id: "menschen-" + l.n, group: "Menschen", level: "A2", pt: "Menschen · " + l.conversa.pt,
    de: l.conversa.de + ". Benutze oft die Grammatik dieser Lektion: " + (l.gram || []).map(id => GRAMMAR_BY_ID.has(id) ? GRAMMAR_BY_ID.get(id).title : id).join(", ")};
  showView("conversa");
  openConversaTopic(topic);
}

// ---------- Faixa de áudio com o texto ----------
/* Cena (uso "cena"): 1 ouvir sem ler → 2 ler com tradução e o significado das palavras → 3 ouvir de novo sem o texto →
   4 repetir frase por frase (com Whisper, grava e compara). Palavras soltas (uso "repetir") e faixas que já deixam a pausa
   (uso "pausas") começam em repetir e em ler. As anotações (tradução, quem fala, correção do Whisper, avisos) e o glossário
   vêm de Menschen/satz/notas (fora do Git); sem elas, a faixa mostra só o texto do Whisper. */
const MS_MODES = {
  cena: [["ouvir", "1 · Ouvir"], ["ler", "2 · Ler"], ["denovo", "3 · Ouvir de novo"], ["repetir", "4 · Repetir"], ["ditado", "Ditado"]],
  outra: [["ler", "Ler e ouvir"], ["repetir", "Repetir"], ["ditado", "Ditado"]]
};
const MS_MODE_HELP = {
  ouvir: "Ouça a cena inteira sem ler. Tente pegar só quem fala e o que acontece.",
  ler: "Leia ouvindo. Toque numa palavra para ver o que ela quer dizer e em PT para ver a tradução da frase.",
  denovo: "Ouça de novo, sem o texto. Agora você deve entender bem mais; toque numa frase só se precisar.",
  repetir: "Uma frase por vez: ouça e repita igual, no mesmo ritmo.",
  pausas: "O próprio áudio deixa uma pausa depois de cada parte: repita em voz alta junto.",
  ditado: "Ouça cada frase e escreva o que ouviu."
};
/* Junta a transcrição às anotações (pela frase do Whisper): t corrigido, q = quem fala, pt, cue = aviso gravado. */
function msPrepare(d) {
  // A mesma frase pode aparecer duas vezes (o título lido no começo e depois na cena): a 2ª nota vale para a 2ª vez.
  const notes = (d.notes && d.notes.s) || [], byDe = new Map(), seen = new Map();
  for (const x of notes) byDe.set(x.de, [...(byDe.get(x.de) || []), x]);
  d.sents = (d.sents || []).map(s => {
    const list = byDe.get(s.t) || [], k = seen.get(s.t) || 0;
    seen.set(s.t, k + 1);
    const n = list[Math.min(k, list.length - 1)] || {};
    return {...s, raw: s.t, t: n.t || s.t, q: n.q || "", pt: n.pt || "", cue: n.cue != null ? !!n.cue : msIsCue(s.t), skip: !!n.skip};
  }).filter(s => !s.skip); // skip = o Whisper inventou (ruído, música, “legenda”): some de todas as etapas
  d.gloss = d.glossary || {};
  d.annotated = notes.length > 0;
  return d;
}
async function msLoadTrack(id) {
  menschen.cache = menschen.cache || {};
  if (menschen.cache[id]) return menschen.cache[id];
  try {
    const r = await fetch("menschen/faixa/" + id);
    if (!r.ok) throw new Error("sem texto");
    return (menschen.cache[id] = msPrepare(await r.json()));
  } catch (e) { return {sents: [], error: true}; }
}
/* opts.embedded = dentro do passo da aula (desenha só em #msPlayer); opts.ctx = {sobre, quem} da cena. */
async function msOpenTrack(t, opts = {}) {
  msStop();
  const uso = t.uso || opts.uso || "cena";
  Object.assign(menschen, {track: {...t, uso}, data: null, playing: -1, dk: 0, rk: 0, rres: null, pop: null, showPt: new Set(), heard: false,
    ctx: opts.ctx || null, mode: uso === "repetir" ? "repetir" : uso === "pausas" ? "ler" : "ouvir"});
  if (opts.embedded) msRenderPlayer(); else { renderMenschen(); window.scrollTo({top: 0}); }
  const d = await msLoadTrack(t.id);
  if (!menschen.track || menschen.track.id !== t.id) return;
  menschen.data = d;
  if (!opts.embedded) renderMenschen(); else msRenderPlayer();
}
function msCloseTrack() { msStop(); menschen.track = null; menschen.data = null; renderMenschen(); }
function msAudio() {
  if (!menschen.audio) {
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("timeupdate", msOnTime);
    a.addEventListener("play", msSyncPlay);
    a.addEventListener("pause", msSyncPlay);
    a.addEventListener("ended", () => {
      menschen.until = null;
      msSyncPlay();
      if (menschen.mode === "ouvir" || menschen.mode === "denovo") { menschen.heard = true; msRenderPlayer(); }
    });
    menschen.audio = a;
  }
  const url = "menschen/audio/" + menschen.track.id;
  if (!menschen.audio.src.endsWith(url)) menschen.audio.src = url;
  return menschen.audio;
}
function msStop() {
  if (menschen.audio) menschen.audio.pause();
  menschen.until = null;
  menschen.onUntil = null;
  menschen.rtk = (menschen.rtk || 0) + 1;
  if (menschen.rclip) { menschen.rclip.stop(); menschen.rclip = null; }
  menschen.rphase = "";
  if (menschen.passo && menschen.passo.clip) { menschen.passo.clip.stop(); menschen.passo.clip = null; }
}
function msPlayErr() { setStatus("Não consegui tocar o áudio do livro.", "error"); }
/* Toca a faixa a partir da frase i; com `only`, para no fim dela e chama `then`. */
function msPlayFrom(i, only = false, then = null) {
  const s = menschen.data && menschen.data.sents[i];
  if (!s) return;
  stopAudio();
  const a = msAudio();
  a.playbackRate = menschen.mode === "repetir" && menschen.slow ? .75 : 1;
  a.currentTime = Math.max(0, s.s / 1000 - .15);
  menschen.until = only ? s.e / 1000 + .25 : null;
  menschen.onUntil = only ? then : null;
  a.play().catch(msPlayErr);
}
/* Botão Tocar: retoma de onde parou; no começo ou no fim, recomeça na 1ª frase que não é aviso. */
function msToggle(from = 0) {
  const a = msAudio();
  if (!a.paused) { a.pause(); return; }
  stopAudio();
  menschen.until = null;
  menschen.onUntil = null;
  a.playbackRate = 1;
  if (a.ended || a.currentTime < .2) msPlayFrom(from); else a.play().catch(msPlayErr);
}
function msOnTime() {
  const a = menschen.audio, d = menschen.data;
  if (!a || !d) return;
  if (menschen.until != null && a.currentTime >= menschen.until) {
    a.pause();
    const then = menschen.onUntil;
    menschen.until = null;
    menschen.onUntil = null;
    if (then) then();
  }
  const bar = $("msTimeBar");
  if (bar && a.duration) setWidth(bar, a.currentTime / a.duration * 100);
  const ms = a.currentTime * 1000;
  let i = -1;
  for (let k = 0; k < d.sents.length; k++) if (d.sents[k].s - 150 <= ms) i = k; else break;
  if (i !== menschen.playing) {
    menschen.playing = i;
    document.querySelectorAll("#msPlayer .ms-sent").forEach(el => el.classList.toggle("now", Number(el.dataset.i) === i));
    const el = document.querySelector("#msPlayer .ms-sent.now");
    if (el && !a.paused && ["ouvir", "ler", "denovo"].includes(menschen.mode)) el.scrollIntoView({block: "nearest", behavior: "smooth"});
  }
}
function msSyncPlay() {
  const btn = $("msPlay"), a = menschen.audio;
  if (btn && a) fill(btn, ...iconText(a.paused ? "play" : "pause", a.paused ? (menschen.mode === "ouvir" ? "Ouvir a cena" : "Tocar") : "Pausar"));
}
function msTrackSource(t, d) {
  return (t.id.startsWith("kb") ? "Kursbuch" : "Arbeitsbuch") + (/^(kb|ab)2/.test(t.id) ? " A2.2" : "") + " · faixa " + msTrackNo(t.id) +
    (d && d.annotated ? " · com tradução" : " · texto transcrito automaticamente (pode ter erros)");
}
/* A faixa aberta sozinha (de “Tudo da lição”): cabeçalho + o tocador. */
function msTrackView(box) {
  const t = menschen.track, l = msLessonData(menschen.view);
  fill(box, h("div", {class: "ms-player-head"},
    h("button", {class: "quiet small", type: "button", onclick: msCloseTrack}, iconText("back", "Lektion " + l.n)),
    h("h2", {class: "ms-track-title", text: t.label}),
    h("p", {class: "muted small-text", text: msTrackSource(t, menschen.data)})), h("div", {id: "msPlayer"}));
  msRenderPlayer();
}
function msSetMode(k) { msStop(); Object.assign(menschen, {mode: k, dk: 0, pop: null, rres: null}); msRenderPlayer(); }
function msRenderPlayer() {
  const box = $("msPlayer"), t = menschen.track;
  if (!box || !t) return;
  const d = menschen.data, modes = MS_MODES[t.uso === "cena" ? "cena" : "outra"];
  const seg = h("div", {class: "seg ms-seg", role: "group", "aria-label": "Etapa"}, ...modes.map(([k, label]) =>
    h("button", {type: "button", "aria-pressed": String(menschen.mode === k), onclick: () => msSetMode(k)}, label)));
  if (!d) return fill(box, seg, h("p", {class: "muted", text: "Carregando o texto…"}));
  if (d.error || !d.sents.length) return fill(box, seg, h("p", {class: "muted", text: "Esta faixa ainda não tem texto."}));
  const help = h("p", {class: "ms-help", text: MS_MODE_HELP[t.uso === "pausas" && menschen.mode === "ler" ? "pausas" : menschen.mode]});
  const body = {ouvir: msListenView, ler: msReadView, denovo: msReadView, repetir: msRepeatView, ditado: msDictation}[menschen.mode](d);
  fill(box, seg, help, body);
  msSyncPlay();
}
function msFirst(d) { return Math.max(0, d.sents.findIndex(s => !s.cue)); }
/* 1 · Ouvir: a situação, o botão grande e as falas borradas (dá para ver quem fala e quando, sem ler). */
function msListenView(d) {
  const ctx = menschen.ctx, first = msFirst(d);
  return h("div", {class: "ms-listen"},
    ctx && ctx.sobre ? h("div", {class: "ms-situ"}, h("b", {class: "label", text: "A situação"}), h("p", {text: ctx.sobre}),
      ctx.quem ? h("p", {class: "muted small-text", text: "Quem fala: " + ctx.quem}) : null) : null,
    h("div", {class: "ms-listen-ctrl"},
      h("button", {id: "msPlay", class: "primary", type: "button", onclick: () => msToggle(first)}, ...iconText("play", "Ouvir a cena")),
      h("div", {class: "ms-time", "aria-hidden": "true"}, h("span", {id: "msTimeBar"}))),
    menschen.heard ? h("div", {class: "ms-after"}, h("p", {text: "Terminou. Deu para pegar quem fala e o que acontece? Agora leia com a tradução."}),
      h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => msSetMode("ler")}, "2 · Ler com a tradução"),
        h("button", {class: "small", type: "button", onclick: () => { menschen.heard = false; msRenderPlayer(); msPlayFrom(first); }}, iconText("repeat", "Ouvir de novo")))) : null,
    h("ol", {class: "ms-sents hidden-text ms-ghost", "aria-hidden": "true"}, ...d.sents.map((s, i) => s.cue ? null : h("li", {class: "ms-sent" + (i === menschen.playing ? " now" : ""), dataset: {i}},
      h("span"), h("div", {class: "ms-line"}, s.q ? h("span", {class: "ms-who", text: s.q}) : null, h("span", {class: "ms-text", lang: "de", text: s.t})), h("span")))));
}
/* 2 · Ler e 3 · Ouvir de novo (texto borrado, toque para ver). */
function msReadView(d) {
  const hidden = menschen.mode === "denovo", first = msFirst(d);
  const controls = h("div", {class: "ms-controls"},
    h("button", {id: "msPlay", class: "primary", type: "button", onclick: () => msToggle(first)}, ...iconText("play", "Tocar")),
    h("button", {class: "small", type: "button", onclick: () => msPlayFrom(Math.max(first, menschen.playing - 1))}, iconText("skipBack", "Frase anterior")),
    h("button", {class: "small", type: "button", onclick: () => msPlayFrom(Math.max(first, menschen.playing), true)}, iconText("repeat", "Repetir a frase")),
    !hidden && d.annotated ? h("label", {class: "ms-check small-text"}, h("input", {type: "checkbox", checked: !!menschen.allPt,
      onchange: e => { menschen.allPt = e.target.checked; msRenderPlayer(); }}), " Todas as traduções") : null);
  const after = hidden && menschen.heard ? h("div", {class: "ms-after"}, h("p", {text: "Pronto. Agora repita a cena frase por frase, no mesmo ritmo."}),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => msSetMode("repetir")}, "4 · Repetir"))) : null;
  return h("div", null, controls, h("ol", {class: "ms-sents" + (hidden ? " hidden-text" : "")}, ...d.sents.map((s, i) => msSentRow(d, s, i, hidden))), after);
}
function msSentRow(d, s, i, hidden) {
  if (s.cue) return hidden ? null : h("li", {class: "ms-sent cue", dataset: {i}}, h("span"), h("span", {class: "ms-text", text: s.t}), h("span"));
  const showPt = !hidden && !!s.pt && (menschen.allPt || menschen.showPt.has(i));
  const text = hidden ? h("span", {class: "ms-text", lang: "de", tabindex: "0", title: "Clique para mostrar", onclick: e => e.currentTarget.classList.toggle("shown"), text: s.t})
    : h("span", {class: "ms-text", lang: "de"}, ...msWords(s.t, i));
  return h("li", {class: "ms-sent" + (i === menschen.playing ? " now" : ""), dataset: {i}},
    h("button", {class: "icon-btn quiet", type: "button", "aria-label": "Ouvir esta frase", title: "Ouvir esta frase", onclick: () => msPlayFrom(i, true)}, icon("volume", 16)),
    h("div", {class: "ms-line"}, s.q ? h("span", {class: "ms-who", text: s.q}) : null, text,
      showPt ? h("p", {class: "ms-pt-line", text: s.pt}) : null,
      !hidden && menschen.pop && menschen.pop.i === i ? msWordPop(d, menschen.pop.w) : null),
    h("div", {class: "ms-acts"},
      !hidden && s.pt ? h("button", {class: "quiet small ms-pt-btn", type: "button", "aria-pressed": String(showPt), title: "Tradução desta frase",
        onclick: () => { if (menschen.showPt.has(i)) menschen.showPt.delete(i); else menschen.showPt.add(i); msRenderPlayer(); }}, "PT") : null,
      h("button", {class: "quiet small ms-card-btn", type: "button", title: "Criar cartão com esta frase (rascunho em Minhas frases)", onclick: e => {
        e.currentTarget.disabled = true; addMineDrafts(s.t, convAvailable(), "menschen"); toast("Rascunho criado em Minhas frases: confira e salve lá.", "success");
      }}, icon("plus", 16))));
}
/* As palavras da frase viram botões: tocar mostra o significado (não toca o áudio; para ouvir, o alto-falante da linha). */
function msWords(text, i) {
  return text.split(/(\p{L}[\p{L}-]*)/u).filter(x => x !== "").map((part, k) => {
    if (!/^\p{L}/u.test(part)) return part;
    const on = menschen.pop && menschen.pop.i === i && menschen.pop.k === k;
    return h("span", {class: "ms-w" + (on ? " on" : ""), role: "button", tabindex: "0", onclick: e => {
      e.stopPropagation(); menschen.pop = on ? null : {i, k, w: part}; msRenderPlayer();
    }, onkeydown: e => { if (e.key === "Enter") e.currentTarget.click(); }, text: part});
  });
}
function msWordPop(d, w) {
  const g = d.gloss[w.toLocaleLowerCase("de")];
  return h("div", {class: "ms-pop"},
    h("b", {class: "ms-pop-w", lang: "de", text: w}),
    g ? [h("span", {class: "ms-pop-lema", lang: "de", text: g[0]}), h("span", {class: "ms-pop-pt", text: g[1]})]
      : h("span", {class: "muted small-text", text: "Ainda sem significado anotado para esta palavra."}),
    typeof fichaHear === "function" ? fichaHear(w) : null);
}
/* 4 · Repetir: ouve a frase, grava a sua vez (até ~2× a duração) e compara palavra por palavra. */
function msRepeatOrder(d) { return d.sents.map((s, k) => k).filter(k => !d.sents[k].cue); }
function msRepeatView(d) {
  const order = msRepeatOrder(d);
  if (!order.length) return h("p", {class: "muted", text: "Esta faixa não tem frases para repetir."});
  const pos = Math.min(menschen.rk, order.length - 1), i = order[pos], s = d.sents[i], r = menschen.rres, phase = menschen.rphase || "";
  return h("div", {class: "panel ms-repeat"},
    h("p", {class: "ms-kicker", text: "Frase " + (pos + 1) + " de " + order.length}),
    s.q ? h("span", {class: "ms-who", text: s.q}) : null,
    h("p", {class: "ms-rep-de", lang: "de", text: s.t}),
    s.pt ? h("p", {class: "muted small-text", text: s.pt}) : null,
    phase === "vez" ? h("div", {class: "gb-turn"}, h("p", {class: "gb-turn-title"}, icon("mic", 18), "Sua vez: repita agora"),
      h("div", {class: "gb-bar"}, h("span", {id: "msRepBar"})),
      h("button", {class: "small", type: "button", onclick: () => menschen.rclip && menschen.rclip.stop()}, "Pronto")) : null,
    phase === "conferindo" ? h("p", {class: "muted", text: "Conferindo o que você disse…"}) : null,
    phase === "falar" ? h("p", {class: "gb-turn-title"}, icon("speech", 18), "Agora repita em voz alta.") : null,
    r ? h("div", {class: "ms-rep-res " + (r.ok ? "ok" : "no")},
      h("p", {class: "aula-status", text: !r.heard ? "Não ouvi nada." : r.ok ? "Igual!" : "Quase: compare (verde = igual ao que você disse)."}),
      r.heard ? diffLine(s.t, r.heard).line : null) : null,
    h("div", {class: "row"},
      phase === "" ? h("button", {class: r ? "small" : "primary", type: "button", onclick: () => msRepeatGo(i)}, iconText(r ? "repeat" : "play", r ? "De novo" : "Ouvir e repetir")) : null,
      phase === "" || phase === "falar" ? h("button", {class: r || phase === "falar" ? "primary" : "small", type: "button", onclick: () => msRepeatNext(order)},
        pos + 1 < order.length ? "Próxima" : "Recomeçar", h("kbd", null, "Enter")) : null,
      h("button", {class: "quiet small", type: "button", "aria-pressed": String(!!menschen.slow), onclick: () => { menschen.slow = !menschen.slow; msRenderPlayer(); }},
        iconText("slow", menschen.slow ? "Devagar (ligado)" : "Devagar"))));
}
function msRepeatNext(order) {
  msStop();
  menschen.rk = (Math.min(menschen.rk, order.length - 1) + 1) % order.length;
  menschen.rres = null;
  msRepeatGo(order[menschen.rk]);
}
async function msRepeatGo(i) {
  const s = menschen.data.sents[i];
  const tk = (menschen.rtk = (menschen.rtk || 0) + 1);
  menschen.rres = null;
  menschen.rphase = "ouvindo";
  msRenderPlayer();
  msPlayFrom(i, true, async () => {
    if (tk !== menschen.rtk) return;
    const voice = typeof speechAvailable === "function" && speechAvailable();
    const win = Math.max(2500, (s.e - s.s) * 1.8 / (menschen.slow ? .75 : 1) + 1200);
    const clip = voice ? await startClip(win + 1500) : null;
    if (tk !== menschen.rtk) { if (clip) clip.stop(); return; }
    if (!clip) { menschen.rphase = "falar"; msRenderPlayer(); return; }
    menschen.rclip = clip;
    menschen.rphase = "vez";
    msRenderPlayer();
    const bar = $("msRepBar");
    if (bar && bar.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) bar.animate([{width: "100%"}, {width: "0%"}], {duration: win, easing: "linear", fill: "forwards"});
    const timer = setTimeout(() => clip.stop(), win);
    const blob = await clip.done;
    clearTimeout(timer);
    if (menschen.rclip === clip) menschen.rclip = null;
    if (tk !== menschen.rtk) return;
    menschen.rphase = "conferindo";
    msRenderPlayer();
    let text = "";
    try { text = await transcribeBlob(blob, false); } catch (e) { text = ""; }
    if (tk !== menschen.rtk) return;
    const dd = text ? diffLine(s.t, text) : null;
    menschen.rres = {heard: text, ok: !!dd && dd.pct >= .85};
    menschen.rphase = "";
    if (menschen.rres.ok && typeof uiSound === "function") uiSound("ok");
    msRenderPlayer();
  });
}
document.addEventListener("keydown", e => {
  if (currentView !== "menschen" || !menschen.track || menschen.mode !== "repetir" || e.target.closest("input, textarea, select")) return;
  if (e.key === "Enter" && menschen.data && (menschen.rphase === "" || menschen.rphase === "falar")) { e.preventDefault(); msRepeatNext(msRepeatOrder(menschen.data)); }
});
/* Avisos gravados no começo das faixas (“Lektion 1.”, “Aufgabe 3b.”): sem anotação, são reconhecidos por aqui. */
function msIsCue(t) { return /^(Lektion|Aufgabe|Modul|Übung|Teil|Track)\b[\s\d.,a-z]*[.!]?$/i.test(t.trim()); }
/* Ditado: uma frase por vez; ouvir (quantas vezes quiser), escrever e conferir com a mesma correção do ditado do Treino. */
function msDictation(d) {
  const order = msRepeatOrder(d);
  if (!order.length) return h("p", {class: "muted", text: "Esta faixa não tem frases para ditado."});
  const pos = Math.min(menschen.dk, order.length - 1), i = order[pos], s = d.sents[i];
  const input = h("textarea", {id: "msDkInput", lang: "de", rows: "2", spellcheck: "false", autocomplete: "off", placeholder: "Escreva o que ouviu"});
  const result = h("div", {id: "msDkResult"});
  const next = () => { menschen.dk = (pos + 1) % order.length; msRenderPlayer(); setTimeout(() => { msPlayFrom(order[menschen.dk], true); const el = $("msDkInput"); if (el) el.focus(); }, 50); };
  const check = () => {
    const typed = input.value.trim();
    if (!typed) { input.focus(); return; }
    input.readOnly = true;
    renderDiktatDiff(result, s.t, typed);
    result.append(h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: next}, pos + 1 < order.length ? "Próxima frase" : "Recomeçar"),
      h("button", {class: "quiet small", type: "button", onclick: () => msPlayFrom(i, true)}, iconText("volume", "Ouvir de novo")),
      s.pt ? h("span", {class: "muted small-text", text: s.pt}) : null));
  };
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.readOnly) next(); else check(); }
  });
  return h("div", {class: "panel ms-dictation"},
    h("p", {class: "ms-kicker", text: "Frase " + (pos + 1) + " de " + order.length}),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => msPlayFrom(i, true)}, iconText("volume", "Ouvir")),
      h("button", {class: "small", type: "button", onclick: next}, "Pular")),
    input, h("button", {type: "button", onclick: check}, "Conferir", h("kbd", null, "Enter")), result);
}
