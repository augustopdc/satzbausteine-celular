"use strict";
/* Treino falado com os áudios do livro de gramática do usuário (Grammatik aktiv, Cornelsen; só no PC). Cada faixa do livro é
   um drill: estímulo → pausa para você responder → resposta certa → pausa para repetir. O app toca o estímulo, abre a sua
   vez (com o microfone, grava e o Whisper confere palavra por palavra), toca a resposta e mostra o texto.
   “Mãos livres”: o mesmo sem microfone e sem tocar em nada, para o carro ou o intervalo do plantão.
   Áudio, transcrições e pares ficam em Gramática/ ao lado do app (fora do Git): satz://app/gramlivro/indice, /faixa/NNN e
   /audio/NNN (feitos por _dev/scripts/gramlivro-faixas.cjs). Aqui só o mapa capítulo do livro → tópicos do app. */
const GRAMLIVRO_TOPICS = {
  1: ["sie", "praesens"], 2: ["praesens"], 3: ["praesens", "konjunktiv"], 4: ["vokalwechsel"], 5: ["modal"], 6: ["modal"], 7: ["trennbar"],
  8: ["imperativ"], 9: ["wfragen"], 10: ["janeindoch"], 11: ["v2"], 12: ["v2", "trennbar"], 13: ["plural"], 14: ["genero"], 15: ["negacao"],
  16: ["akkusativ"], 17: ["dativ"], 18: ["possessiv"], 19: ["demonstr"], 20: ["perspron"], 21: ["zweiobjekt"], 22: ["dativ", "perspron"],
  23: ["praeteritum"], 24: ["perfekt"], 25: ["perfekt"], 26: ["perfekt"], 27: ["praeteritum"], 28: ["perfekt", "praeteritum"], 29: ["reflexiv"],
  30: ["uhrzeit", "zeitpraep"], 31: ["praepdat"], 32: ["praepakk"], 33: ["praep"], 34: ["praep"], 35: ["richtung"], 36: ["adjektiv"],
  37: ["adjektiv"], 38: ["komparativ"], 39: ["komparativ"], 40: ["konnektoren"], 41: ["deshalb"], 42: ["nebensatz"], 43: ["richtung"],
  44: ["partikeln"], 45: ["wortbildung"], 46: ["wortbildung"], 47: ["trennbar"], 48: ["genero"], 49: ["praetall"], 50: ["plusquam"],
  51: ["reflexiv"], 52: ["trennbar"], 53: ["daworter"], 54: ["daworter"], 55: ["konj2irreal"], 56: ["konj2irreal"], 57: ["passiv"],
  58: ["passiv"], 59: ["futur"], 60: ["werden3"], 61: ["lassen"], 62: ["verbpaare"], 63: ["genitiv"], 64: ["ndekl"], 65: ["adjsubst"],
  66: ["adjsubst"], 67: ["indirekt"], 68: ["zuinf"], 69: ["modal", "lassen"], 70: ["relativ"], 71: ["relativ"], 72: ["alswenn"],
  73: ["temporal"], 74: ["umzu"], 75: ["doppelkonj"], 76: ["doppelkonj", "komparativ"], 77: ["genpraep", "genitiv"], 78: ["zeitpraep"],
  79: ["adjektiv"], 80: ["partizip"]
};
const GB_OK = .85;
const gb = {index: null, asked: false, track: null, data: null, i: 0, phase: "", handsfree: false, showText: false, audio: null, until: null,
  timer: null, clip: null, heard: null, res: null, token: 0, onDone: null, box: null, topics: []};

function gbAvailable() { return !!window.satzDesktop; }
/* Lê de novo se a última leitura tem mais de 1 minuto: enquanto o processamento roda, faixas novas vão aparecendo. */
async function gbLoadIndex() {
  if (!gbAvailable() || (gb.asked && Date.now() - (gb.loadedAt || 0) < 60000)) return gb.index;
  gb.asked = true;
  gb.loadedAt = Date.now();
  try { const r = await fetch("gramlivro/indice"); gb.index = r.ok ? await r.json() : []; } catch (e) { gb.index = []; }
  if (!Array.isArray(gb.index)) gb.index = [];
  return gb.index;
}
function gbTopicsOf(kapitel) { return GRAMLIVRO_TOPICS[kapitel] || []; }
function gbTracksFor(topicId) { return (gb.index || []).filter(x => x.n > 0 && gbTopicsOf(x.kapitel).includes(topicId)); }
function gbLabel(x, withN = true) { return "Cap. " + x.kapitel + (x.titulo ? " · " + x.titulo : "") + (x.uebung > 1 ? " · Übung " + x.uebung : "") + (withN ? " · " + plural(x.n, "frase", "frases") : ""); }
function gbMeta(id) { return (gb.index || []).find(x => x.id === id) || null; }

/* Bloco na página do tópico: as faixas do livro deste tópico (carrega o índice na primeira vez). */
function gbTopicBlock(topicId) {
  const box = h("section", {class: "gb-block"});
  const paint = () => {
    const list = gbTracksFor(topicId);
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    fill(box, h("h3", {class: "titled"}, h("span", {text: "Treino falado com o livro"})),
      h("p", {class: "muted small-text", text: "Grammatik aktiv: o áudio diz uma frase, você responde em voz alta na pausa e ouve a resposta certa."}),
      h("div", {class: "gb-tracks"}, ...list.map(x => h("button", {class: "gb-track", type: "button", onclick: () => gbOpen(x.id, {back: () => renderGrammarTopic(topicId)})},
        icon("mic", 16), h("span", {text: gbLabel(x)})))));
  };
  box.hidden = true;
  if (gb.index) paint(); else gbLoadIndex().then(paint);
  return box;
}

// ---------- Áudio ----------
function gbAudio() {
  if (!gb.audio) {
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("timeupdate", () => { if (gb.until != null && a.currentTime >= gb.until) { a.pause(); gb.until = null; const f = gb.ended; gb.ended = null; if (f) f(); } });
    a.addEventListener("ended", () => { gb.until = null; const f = gb.ended; gb.ended = null; if (f) f(); });
    gb.audio = a;
  }
  const url = "gramlivro/audio/" + gb.track;
  if (!gb.audio.src.endsWith(url)) gb.audio.src = url;
  return gb.audio;
}
/* Toca um trecho {s, e} (ms) e chama `then` quando ele acaba. */
function gbPlay(seg, then) {
  stopAudio();
  const a = gbAudio(), tk = gb.token;
  a.currentTime = Math.max(0, seg.s / 1000 - .05);
  gb.until = seg.e / 1000 + .15;
  gb.ended = () => { if (tk === gb.token && then) then(); };
  a.play().catch(() => setStatus("Não consegui tocar o áudio do livro.", "error"));
}
function gbStop() {
  gb.token++;
  clearTimeout(gb.timer);
  if (gb.audio) gb.audio.pause();
  gb.until = null; gb.ended = null;
  if (gb.clip) { try { gb.clip.stop(); } catch (e) { /* já parou */ } gb.clip = null; }
}

// ---------- Faixa aberta ----------
async function gbOpen(id, {back, box, topics, items, onDone} = {}) {
  gbStop();
  Object.assign(gb, {track: id, data: null, i: 0, phase: "", heard: null, res: null, back: back || null, onDone: onDone || null, box: box || null});
  if (!gb.box) { $("grammarList").hidden = true; $("grammarTrain").hidden = true; $("grammarDetail").hidden = false; }
  gbRender();
  try { const r = await fetch("gramlivro/faixa/" + id); gb.data = r.ok ? await r.json() : null; } catch (e) { gb.data = null; }
  if (gb.data) {
    // Faixas “Übung 2…” não dizem o capítulo: vale o do índice (herdado da faixa anterior).
    const meta = gbMeta(id);
    if (meta) gb.data = {...gb.data, kapitel: meta.kapitel, titulo: meta.titulo, uebung: meta.uebung};
    gb.topics = topics || gbTopicsOf(gb.data.kapitel);
    if (items) gb.data = {...gb.data, itens: items(gb.data.itens)};
  }
  gbRender();
}
function gbClose() { gbStop(); gb.track = null; const b = gb.back; gb.back = null; if (b) b(); else renderGrammar(); }
function gbRoot() { return gb.box || $("grammarDetail"); }
function gbRender() {
  const box = gbRoot();
  if (!box) return;
  const d = gb.data;
  const head = gb.box ? null : h("div", {class: "aula-head"}, h("button", {class: "quiet small", type: "button", onclick: gbClose}, "← Voltar"),
    d ? h("b", {text: gbLabel(d, false)}) : null);
  if (!d) return fill(box, head, h("p", {class: "muted", text: "Carregando a faixa…"}));
  if (!d.itens.length) return fill(box, head, h("p", {class: "muted", text: "Esta faixa não tem frases para treinar."}));
  if (gb.i >= d.itens.length) return fill(box, head, gbEnd());
  const it = d.itens[gb.i], voice = typeof speechAvailable === "function" && speechAvailable();
  const modes = gb.box ? null : h("div", {class: "seg fx-seg", role: "group"},
    h("button", {type: "button", "aria-pressed": String(!gb.handsfree), onclick: () => { gb.handsfree = false; gbStop(); gb.phase = ""; gbRender(); }}, voice ? "Responder falando" : "Responder"),
    h("button", {type: "button", "aria-pressed": String(gb.handsfree), onclick: () => { gb.handsfree = true; gbStop(); gb.phase = ""; gbRender(); }}, "Mãos livres"));
  const progress = h("p", {class: "gb-count muted small-text", text: "Frase " + (gb.i + 1) + " de " + d.itens.length});
  const showStim = gb.showText || gb.phase === "resposta" || gb.phase === "fim";
  const card = h("div", {class: "panel gb-card gb-" + (gb.phase || "pronto")},
    h("div", {class: "gb-line"}, h("span", {class: "gb-tag", text: "Estímulo"}),
      h("p", {class: "gb-de" + (showStim ? "" : " gb-hidden"), lang: "de", text: it.p.t})),
    gb.phase === "vez" ? h("div", {class: "gb-turn"}, h("p", {class: "gb-turn-title"}, icon(gb.clip ? "mic" : "speech", 18), gb.clip ? "Gravando: responda agora" : "Sua vez: responda em voz alta"),
      h("div", {class: "gb-bar"}, h("span", {id: "gbBar"})),
      gb.clip ? h("button", {class: "small", type: "button", onclick: () => gb.clip && gb.clip.stop()}, "Pronto") : null) : null,
    gb.phase === "conferindo" ? h("p", {class: "muted", text: "Conferindo o que você disse…"}) : null,
    gb.phase === "resposta" || gb.phase === "fim" ? h("div", {class: "gb-line gb-answer"}, h("span", {class: "gb-tag", text: "Resposta"}),
      gb.heard ? diffLine(it.r.t, gb.heard).line : h("p", {class: "gb-de", lang: "de", text: it.r.t})) : null,
    gb.res ? h("p", {class: "gb-verdict " + (gb.res.ok ? "ok" : "no"), text: gb.res.ok ? "Certo!" : gb.res.heard ? "Você disse: " + gb.res.heard : "Não ouvi nada."}) : null);
  const ctrls = h("div", {class: "row"},
    !gb.phase ? h("button", {class: "primary", type: "button", onclick: gbStart}, iconText("play", gb.i ? "Continuar" : "Começar")) : null,
    gb.phase === "fim" && !gb.handsfree ? h("button", {class: "primary", type: "button", onclick: gbNext}, "Próxima", h("kbd", null, "Enter")) : null,
    gb.phase === "fim" && !gb.handsfree && !voice ? [h("button", {class: "small", type: "button", onclick: () => gbSelf(true)}, "Acertei"), h("button", {class: "small", type: "button", onclick: () => gbSelf(false)}, "Errei")] : null,
    gb.phase === "fim" ? h("button", {class: "small", type: "button", onclick: () => { gb.phase = ""; gb.heard = null; gb.res = null; gbStart(); }}, iconText("repeat", "Repetir")) : null,
    gb.phase && gb.handsfree ? h("button", {class: "small", type: "button", onclick: () => { gbStop(); gb.phase = ""; gbRender(); }}, iconText("pause", "Pausar")) : null,
    h("label", {class: "gb-check small-text"}, h("input", {type: "checkbox", checked: gb.showText, onchange: e => { gb.showText = e.target.checked; gbRender(); }}), " Mostrar o estímulo escrito"));
  fill(box, head, modes, progress, card, ctrls);
}
/* Um item: estímulo → sua vez (grava, se der) → resposta → (mãos livres: pausa para repetir e segue). */
function gbStart() {
  const it = gb.data.itens[gb.i];
  gb.heard = null; gb.res = null; gb.phase = "ouvir";
  gbRender();
  gbPlay(it.p, () => gbTurn(it));
}
async function gbTurn(it) {
  const tk = gb.token, win = Math.max(3500, (it.r.e - it.r.s) * 2.2 + 1500);
  gb.phase = "vez";
  const voice = !gb.handsfree && typeof speechAvailable === "function" && speechAvailable();
  if (voice) {
    const clip = await startClip(win + 1500);
    if (tk !== gb.token) { if (clip) clip.stop(); return; }
    gb.clip = clip;
  }
  gbRender();
  const bar = $("gbBar");
  if (bar && bar.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) bar.animate([{width: "100%"}, {width: "0%"}], {duration: win, easing: "linear", fill: "forwards"});
  if (gb.clip) {
    gb.timer = setTimeout(() => gb.clip && gb.clip.stop(), win + 800);
    const blob = await gb.clip.done;
    clearTimeout(gb.timer);
    gb.clip = null;
    if (tk !== gb.token) return;
    gb.phase = "conferindo"; gbRender();
    let text = "";
    try { text = await transcribeBlob(blob, false); } catch (e) { text = ""; }
    if (tk !== gb.token) return;
    const d = text ? diffLine(it.r.t, text) : null, ok = !!d && d.pct >= GB_OK;
    gb.heard = text || null;
    gb.res = {ok, heard: text};
    if (gb.topics.length && typeof gramRecord === "function") { gramRecord(gb.topics, ok); saveProgress(); }
    if (ok && typeof uiSound === "function") uiSound("ok");
    gbAnswer(it);
  } else gb.timer = setTimeout(() => { if (tk === gb.token) gbAnswer(it); }, win);
}
function gbAnswer(it) {
  gb.phase = "resposta"; gbRender();
  gbPlay(it.r, () => {
    gb.phase = "fim"; gbRender();
    if (gb.handsfree) { const tk = gb.token; gb.timer = setTimeout(() => { if (tk === gb.token) { gbNext(); if (gb.phase === "" && gb.i < gb.data.itens.length) gbStart(); } }, (it.r.e - it.r.s) + 2200); }
  });
}
function gbSelf(ok) { if (gb.topics.length && typeof gramRecord === "function") { gramRecord(gb.topics, ok); saveProgress(); } gbNext(); }
function gbNext() {
  gbStop();
  gb.i++; gb.phase = ""; gb.heard = null; gb.res = null;
  if (gb.i >= gb.data.itens.length && gb.onDone) { const f = gb.onDone; gb.onDone = null; f(); return; }
  gbRender();
}
function gbEnd() {
  return h("div", {class: "aula-step"}, h("h2", {text: "Faixa concluída"}),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => { gb.i = 0; gbRender(); }}, "De novo"),
      h("button", {type: "button", onclick: gbClose}, "Voltar")));
}
document.addEventListener("keydown", e => {
  if (!gb.track || currentView !== "grammar" || e.target.closest("input, textarea")) return;
  if (e.key === "Enter" && gb.phase === "fim" && !gb.handsfree) { e.preventDefault(); gbNext(); }
  if (e.key === "Escape" && !gb.box) { e.preventDefault(); gbClose(); }
});
