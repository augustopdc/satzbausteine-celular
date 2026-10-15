"use strict";
/* Fluência: ditado com análise de ortografia e rodadas de velocidade (tempo até começar a falar).
   Usa funções de app.js e pratica-oral.js; tudo aqui só é chamado em tempo de execução. */

// ---------- Ditado: análise de ortografia ----------
const SPELLING_CATS = {
  caps: {label: "Maiúscula/minúscula", hint: "Em alemão, todo substantivo começa com maiúscula (der Tisch, die Schmerzen), assim como o Sie formal e o início da frase."},
  umlaut: {label: "Trema (ä, ö, ü)", hint: "ä, ö e ü são letras próprias. Use os botões abaixo do campo; no ditado, “ae” no lugar de “ä” conta como erro."},
  ss: {label: "ß ou ss", hint: "Depois de vogal longa ou ditongo escreve-se ß (Straße, heißen); depois de vogal curta, ss (Wasser, muss)."},
  double: {label: "Letras dobradas", hint: "Consoante dobrada indica que a vogal antes dela é curta (kommen, Bett, Ball)."},
  ieei: {label: "ie × ei", hint: "ie soa como “i” longo (Liebe, Brief); ei soa como “ai” (mein, Bein)."},
  ending: {label: "Terminação", hint: "Muitas vezes é caso, plural ou conjugação: den/dem, -e/-en/-er, -st/-t. Ouça o fim da palavra devagar."},
  other: {label: "Outra grafia", hint: "Ouça de novo devagar e compare letra por letra."},
  missing: {label: "Palavra faltando", hint: "Palavras curtas e átonas (es, ja, doch, mal, den) somem na fala rápida. Ouça devagar e conte as palavras."}
};
/* Cada norma apaga um tipo de diferença; variantes alternativas são testadas e vale a que mais aproxima. */
const SPELLING_NORMS = [
  ["umlaut", [s => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue"), s => s.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")]],
  ["ss", [s => s.replace(/ß/g, "ss"), s => s.replace(/ß/g, "s")]],
  ["double", [s => s.replace(/(\p{L})\1/gu, "$1")]],
  ["ieei", [s => s.replace(/ie|ei/g, "§")]]
];
/* Finais que mudam com caso, número e conjugação (den/dem, meine/meinen, gehst/geht…). */
const INFLECTION_TAILS = new Set(["", "e", "n", "en", "em", "er", "es", "s", "st", "t", "et", "est", "m", "r"]);
function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
function bareWord(w) { return String(w || "").replace(/[^\p{L}\p{N}]/gu, ""); }
/* Tipos de erro de grafia entre a palavra esperada e a escrita (lista vazia = exata). */
function spellingIssues(expected, got) {
  let a = bareWord(expected), b = bareWord(got);
  if (a === b) return [];
  if (!b) return ["missing"];
  const cats = [];
  const upper = c => c !== c.toLocaleLowerCase("de");
  if (a[0] && b[0] && a[0].toLocaleLowerCase("de") === b[0].toLocaleLowerCase("de") && upper(a[0]) !== upper(b[0])) cats.push("caps");
  a = a.toLocaleLowerCase("de");
  b = b.toLocaleLowerCase("de");
  if (a === b) return cats.length ? cats : ["caps"];
  for (const [cat, variants] of SPELLING_NORMS) {
    const before = levenshtein(a, b);
    let best = null;
    for (const fn of variants) {
      const A = fn(a), B = fn(b), d = levenshtein(A, B);
      if (d < before && (!best || d < best.d)) best = {A, B, d};
    }
    if (best) { cats.push(cat); a = best.A; b = best.B; }
    if (a === b) return cats;
  }
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  const tails = [a.slice(prefix), b.slice(prefix)];
  cats.push(prefix >= 2 && tails.every(t => INFLECTION_TAILS.has(t)) ? "ending" : "other");
  return cats;
}
/* Revisão completa de um ditado: alinha as palavras e classifica cada erro. */
function diktatReview(expected, typed) {
  const ops = wordDiff(expected, typed).ops, merged = [];
  // Uma palavra que falta ao lado de uma que sobra é uma substituição (ex.: den × dem).
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i], next = ops[i + 1];
    if (next && ((op[0] === "ins" && next[0] === "del") || (op[0] === "del" && next[0] === "ins"))) {
      const [exp, got] = op[0] === "ins" ? [op[1], next[1]] : [next[1], op[1]];
      merged.push(["near", exp, got]);
      i++;
    } else merged.push(op);
  }
  const items = [], counts = {};
  let words = 0, exact = 0;
  for (const [type, word, got] of merged) {
    if (type === "del") { items.push({type: "extra", got: word}); continue; }
    words++;
    const cats = type === "ins" ? ["missing"] : spellingIssues(word, got);
    if (!cats.length) { exact++; items.push({type: "ok", word}); continue; }
    items.push({type: type === "ins" ? "missing" : "err", word, got, cats});
    for (const c of cats) counts[c] = (counts[c] || 0) + 1;
  }
  return {items, words, exact, counts};
}
function diktatData() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.diktat || (progress.practice.diktat = {words: 0, exact: 0, cats: {}});
}
function sanitizeDiktat(src) {
  const out = {words: 0, exact: 0, cats: {}};
  if (!src || typeof src !== "object") return out;
  out.words = Math.max(0, Math.round(Number(src.words) || 0));
  out.exact = Math.min(out.words, Math.max(0, Math.round(Number(src.exact) || 0)));
  for (const [c, n] of Object.entries(src.cats || {})) if (SPELLING_CATS[c] && Number.isFinite(Number(n))) out.cats[c] = Math.max(0, Math.round(Number(n)));
  return out;
}
function mergeDiktat(local, incoming) {
  const out = sanitizeDiktat(local);
  out.words = Math.max(out.words, incoming.words);
  out.exact = Math.max(out.exact, incoming.exact);
  for (const [c, n] of Object.entries(incoming.cats)) out.cats[c] = Math.max(out.cats[c] || 0, n);
  return out;
}
function recordDiktat(review) {
  const d = diktatData(), s = session.diktat || (session.diktat = {words: 0, exact: 0, cats: {}});
  for (const target of [d, s]) {
    target.words += review.words;
    target.exact += review.exact;
    for (const [c, n] of Object.entries(review.counts)) target.cats[c] = (target.cats[c] || 0) + n;
  }
  saveProgress();
}
function topSpelling(cats, n = 3) {
  return Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
}
/* Mostra o resultado do ditado no lugar da comparação comum. */
function renderDiktatDiff(box, expected, typed) {
  const r = diktatReview(expected, typed), perfect = r.exact === r.words && !r.items.some(i => i.type === "extra");
  recordDiktat(r);
  const line = h("p", {class: "diff-line", lang: "de"});
  r.items.forEach((it, k) => {
    if (k) line.append(" ");
    if (it.type === "ok") line.append(it.word);
    else if (it.type === "err") line.append(h("span", {class: "dk-err", title: "Você escreveu: " + it.got}, it.word));
    else if (it.type === "missing") line.append(h("ins", {title: "faltou"}, it.word));
    else line.append(h("del", {title: "não está na frase"}, it.got));
  });
  const errors = r.items.filter(it => it.type === "err" || it.type === "missing");
  const cats = [...new Set(errors.flatMap(e => e.cats))];
  fill(box,
    h("div", {class: "diff-head"}, h("span", {text: "Seu ditado"}), h("span", {class: "diff-score " + (perfect ? "ok" : "partial"), text: perfect ? "Sem erros" : r.exact + " de " + r.words + " palavras exatas"})),
    line,
    errors.length ? h("ul", {class: "dk-list"}, ...errors.slice(0, 8).map(e => h("li", null,
      h("b", {lang: "de", text: e.word}), e.type === "missing" ? " · faltou" : [" · você escreveu ", h("span", {lang: "de", class: "dk-got", text: e.got})],
      h("span", {class: "dk-cats", text: e.cats.map(c => SPELLING_CATS[c].label).join(" + ")})))) : null,
    ...cats.slice(0, 2).map(c => h("p", {class: "diff-note", text: SPELLING_CATS[c].hint})));
  box.hidden = false;
  return r;
}
function diktatSessionNode() {
  const s = session.diktat;
  if (!session.dictation || !s || !s.words) return null;
  const top = topSpelling(s.cats);
  return h("p", {class: "muted", text: "Ortografia: " + Math.round(s.exact / s.words * 100) + "% das palavras exatas"
    + (top.length ? " · " + top.map(([c, n]) => SPELLING_CATS[c].label + " " + n).join(" · ") : "") + "."});
}
function renderDiktatStats() {
  const d = sanitizeDiktat((progress.practice || {}).diktat), box = $("diktatStats");
  if (!d.words) { box.hidden = true; return; }
  const top = topSpelling(d.cats, 4);
  fill(box, h("h3", {text: "No ditado"}),
    h("p", {class: "muted small-text", text: d.words.toLocaleString("pt-BR") + " palavras ditadas · " + Math.round(d.exact / d.words * 100) + "% exatas."}),
    ...top.map(([c, n]) => h("p", {class: "dk-stat"}, h("b", {text: SPELLING_CATS[c].label + ": " + n}), " ", h("span", {class: "muted small-text", text: SPELLING_CATS[c].hint}))));
  box.hidden = false;
}
/* Botões ä ö ü ß para quem usa teclado brasileiro. */
function insertChar(ch) {
  const input = $("typingInput");
  if (input.readOnly) return;
  const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
  input.setRangeText(ch, start, end, "end");
  input.focus();
}
function bindUmlautKeys() {
  for (const b of all("#umlautKeys button")) {
    b.addEventListener("mousedown", e => e.preventDefault());
    b.addEventListener("click", () => insertChar(b.dataset.char));
  }
}

// ---------- Rodada de velocidade ----------
const SPEED_SIZE = 15, SPEED_FAST_MS = 3000, SPEED_TIMEOUT_MS = 10000, SPEED_SILENCE_MS = 900, SPEED_MIN_CARDS = 5;
const speed = {active: false, list: [], i: 0, results: [], phase: "idle", shownAt: 0, onset: null, firstLoud: 0, lastLoud: 0, loudRun: 0,
  stream: null, ctx: null, analyser: null, buf: null, threshold: .02, ticker: null};
function speedData() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.speed || (progress.practice.speed = {rounds: [], lat: {}});
}
function sanitizeSpeed(src) {
  const out = {rounds: [], lat: {}};
  if (!src || typeof src !== "object") return out;
  if (Array.isArray(src.rounds)) {
    out.rounds = src.rounds.filter(r => r && Number.isFinite(Number(r.at)) && Number(r.n) > 0)
      .map(r => ({at: Number(r.at), n: Math.round(Number(r.n)), score: Math.max(0, Number(r.score) || 0), median: Number.isFinite(Number(r.median)) && r.median !== null ? Math.max(0, Number(r.median)) : null}))
      .sort((a, b) => a.at - b.at).slice(-200);
  }
  for (const [id, ms] of Object.entries(src.lat || {})) if (/^(K[123]-\d{4,}|M-[a-z0-9]{6,20})$/.test(id) && Number.isFinite(Number(ms))) out.lat[id] = Math.min(SPEED_TIMEOUT_MS, Math.max(0, Math.round(Number(ms))));
  return out;
}
function mergeSpeed(local, incoming) {
  const out = sanitizeSpeed(local), seen = new Set(out.rounds.map(r => r.at));
  for (const r of incoming.rounds) if (!seen.has(r.at)) out.rounds.push(r);
  out.rounds.sort((a, b) => a.at - b.at);
  out.rounds = out.rounds.slice(-200);
  for (const [id, ms] of Object.entries(incoming.lat)) if (!(id in out.lat)) out.lat[id] = ms;
  return out;
}
/* Acertou rápido = 1 ponto; acertou devagar (ou sem voz detectada) = meio; errou = 0. */
function speedPoints(ok, ms) {
  if (!ok) return 0;
  return ms != null && ms <= SPEED_FAST_MS ? 1 : .5;
}
function speedEligible() {
  return cards.filter(c => {
    if (tag(c, "Modus") !== "Produktion" || !matches(c, filters.session)) return false;
    const p = modeProgress(c.id, "production");
    return !!(p && p.lastGrade && p.lastGrade !== "again");
  });
}
/* Metade da rodada: as frases mais lentas já medidas; o resto: primeiro as nunca medidas. */
function pickSpeedCards(pool, lat, n = SPEED_SIZE) {
  const slow = pool.filter(c => lat[c.id] > SPEED_FAST_MS).sort((a, b) => lat[b.id] - lat[a.id]).slice(0, Math.ceil(n / 2));
  const chosen = new Set(slow.map(c => c.id));
  const rest = shuffled(pool.filter(c => !chosen.has(c.id))).sort((a, b) => (a.id in lat) - (b.id in lat));
  return shuffled([...slow, ...rest.slice(0, n - slow.length)]);
}
function formatMs(ms) { return (ms / 1000).toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + " s"; }
function median(list) {
  if (!list.length) return null;
  const s = list.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function micLevel() {
  speed.analyser.getFloatTimeDomainData(speed.buf);
  let sum = 0;
  for (const v of speed.buf) sum += v * v;
  return Math.sqrt(sum / speed.buf.length);
}
function releaseMic() {
  clearInterval(speed.ticker);
  speed.ticker = null;
  if (speed.stream) speed.stream.getTracks().forEach(t => t.stop());
  if (speed.ctx) speed.ctx.close().catch(() => {});
  Object.assign(speed, {stream: null, ctx: null, analyser: null, active: false, phase: "idle"});
}
async function startSpeedRound(list) {
  if (speed.active) return;
  if (!canRecord()) { setStatus("A rodada de velocidade precisa do microfone, que não está disponível neste computador.", "error"); return; }
  if (!list) {
    const pool = speedEligible();
    if (pool.length < SPEED_MIN_CARDS) { setStatus("A rodada de velocidade usa frases que você já acertou no treino de produção. Você tem " + pool.length + "; são necessárias " + SPEED_MIN_CARDS + ".", "error"); return; }
    list = pickSpeedCards(pool, speedData().lat);
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); }
  catch (e) { setStatus("Acesso ao microfone negado ou indisponível. Verifique o microfone nas configurações de privacidade do Windows.", "error"); return; }
  stopContinuous();
  const ctx = new AudioContext(), analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  await ctx.resume().catch(() => {});
  Object.assign(speed, {active: true, list, i: 0, results: [], stream, ctx, analyser, buf: new Float32Array(analyser.fftSize), phase: "calibrating"});
  $("practiceSetup").hidden = true;
  $("sessionDone").hidden = true;
  $("speedPlayer").hidden = false;
  window.scrollTo({top: 0});
  fill($("speedStage"), h("p", {class: "speed-status", text: "Calibrando o microfone… fique em silêncio um instante."}));
  const samples = [];
  for (let t = 0; t < 24 && speed.active; t++) { samples.push(micLevel()); await wait(30); }
  if (!speed.active) return;
  const ambient = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
  speed.threshold = Math.min(.08, Math.max(.012, ambient * 3.5));
  showSpeedCard();
}
function showSpeedCard() {
  stopAudio();
  const card = speed.list[speed.i];
  Object.assign(speed, {phase: "waiting", onset: null, loudRun: 0, lastLoud: 0, shownAt: performance.now()});
  $("speedCounter").textContent = (speed.i + 1) + " de " + speed.list.length;
  setWidth($("speedBar"), speed.i / speed.list.length * 100);
  const meter = h("span");
  fill($("speedStage"),
    h("div", {class: "prompt speed-prompt"}, ...situationNodes(card)),
    h("div", {class: "speed-clock"}, h("b", {id: "speedTimer", text: "0,0 s"}), h("div", {class: "track speed-meter", title: "Nível do microfone"}, meter)),
    h("p", {id: "speedStatus", class: "speed-status", text: "Diga a frase em voz alta assim que souber. O cronômetro para quando você começa a falar."}),
    h("div", {class: "row center"}, h("button", {class: "primary lg", type: "button", onclick: revealSpeed}, "Revelar ", h("kbd", null, "Espaço"))));
  speed.meter = meter;
  clearInterval(speed.ticker);
  speed.ticker = setInterval(speedTick, 30);
}
function speedTick() {
  if (!speed.active || (speed.phase !== "waiting" && speed.phase !== "speaking")) return;
  const now = performance.now(), t = now - speed.shownAt, level = micLevel();
  setWidth(speed.meter, level / speed.threshold * 40);
  if (level > speed.threshold) { if (!speed.loudRun) speed.firstLoud = now; speed.loudRun++; speed.lastLoud = now; }
  else speed.loudRun = 0;
  if (speed.phase === "waiting") {
    $("speedTimer").textContent = formatMs(t);
    if (t > 250 && speed.loudRun >= 3) {
      speed.onset = Math.max(0, speed.firstLoud - speed.shownAt);
      speed.phase = "speaking";
      $("speedTimer").textContent = formatMs(speed.onset);
      $("speedTimer").className = speed.onset <= SPEED_FAST_MS ? "fast" : "slow";
      $("speedStatus").textContent = "Começou a falar. Termine a frase; a resposta aparece quando você parar.";
    } else if (t > SPEED_TIMEOUT_MS) revealSpeed();
  } else if (now - speed.lastLoud > SPEED_SILENCE_MS) revealSpeed();
}
function revealSpeed() {
  if (!speed.active || (speed.phase !== "waiting" && speed.phase !== "speaking")) return;
  clearInterval(speed.ticker);
  speed.phase = "revealed";
  const card = speed.list[speed.i], ms = speed.onset;
  const verdict = ms == null ? "Não detectei sua voz" : ms <= SPEED_FAST_MS ? "Rápido" : ms <= 6000 ? "Saiu, mas devagar" : "Lento";
  fill($("speedStage"),
    h("div", {class: "prompt speed-prompt muted"}, ...situationNodes(card)),
    h("div", {class: "speed-result " + (ms != null && ms <= SPEED_FAST_MS ? "fast" : "slow")}, h("b", {text: ms == null ? "—" : formatMs(ms)}), h("span", {text: verdict})),
    h("div", {class: "answer-row"}, h("p", {class: "answer", lang: "de"}, ...answerNodes(card)),
      h("button", {class: "icon-btn", type: "button", title: "Ouvir (R)", "aria-label": "Ouvir a frase", onclick: () => speakCard(card)}, icon("volume"))),
    h("p", {class: "translation", text: card.traducao}),
    h("p", {class: "muted small-text", text: "Saiu certo? Vale a frase do catálogo ou outra formulação natural. Rápido (até " + formatMs(SPEED_FAST_MS) + ") = 1 ponto; devagar = meio ponto."}),
    h("div", {class: "row center"},
      h("button", {class: "lg g-again", type: "button", onclick: () => gradeSpeed(false)}, "Errei ", h("kbd", null, "1")),
      h("button", {class: "lg g-good", type: "button", onclick: () => gradeSpeed(true)}, "Saiu certo ", h("kbd", null, "3"))));
  speakCard(card);
}
function gradeSpeed(ok) {
  if (!speed.active || speed.phase !== "revealed") return;
  const card = speed.list[speed.i], ms = speed.onset;
  speed.results.push({id: card.id, ms, ok, pts: speedPoints(ok, ms)});
  speedData().lat[card.id] = ok && ms != null ? Math.round(ms) : SPEED_TIMEOUT_MS;
  speed.i++;
  if (speed.i < speed.list.length) showSpeedCard(); else finishSpeedRound();
}
function finishSpeedRound() {
  const results = speed.results.slice();
  releaseMic();
  stopAudio();
  const d = speedData(), n = results.length, score = results.reduce((a, r) => a + r.pts, 0);
  const med = median(results.filter(r => r.ok && r.ms != null).map(r => r.ms));
  const prev = d.rounds.filter(r => r.median != null).slice(-1)[0];
  d.rounds.push({at: Date.now(), n, score, median: med == null ? null : Math.round(med)});
  d.rounds = d.rounds.slice(-200);
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  const slow = results.filter(r => r.pts < 1).map(r => byId.get(r.id)).filter(Boolean);
  const history = d.rounds.filter(r => r.median != null).slice(-6).map(r => formatMs(r.median));
  setWidth($("speedBar"), 100);
  fill($("speedStage"),
    h("div", {class: "summary"},
      h("div", {class: "summary-icon"}, icon("flame", 30)),
      h("h2", {text: score.toLocaleString("pt-BR") + " de " + n + " pontos"}),
      h("div", {class: "summary-stats"},
        h("div", null, h("b", {text: med == null ? "—" : formatMs(med)}), h("span", {text: "tempo mediano até falar"})),
        h("div", null, h("b", {text: results.filter(r => r.pts === 1).length}), h("span", {text: "rápidas e certas"})),
        h("div", null, h("b", {text: slow.length}), h("span", {text: "lentas ou erradas"}))),
      h("p", {class: "muted", text: med != null && prev ? (med < prev.median ? "Mais rápido que na rodada anterior (" + formatMs(prev.median) + ")." : "Na rodada anterior: " + formatMs(prev.median) + ". Repetir as lentas ajuda a automatizar.")
        : "A meta é começar a falar em até " + formatMs(SPEED_FAST_MS) + ", sem montar a frase em português antes."}),
      history.length > 1 ? h("p", {class: "muted small-text", text: "Últimas rodadas: " + history.join(" · ")}) : null,
      h("div", {class: "row center"},
        slow.length ? h("button", {class: "primary", type: "button", onclick: () => startSpeedRound(shuffled(slow))}, "Repetir só as lentas (" + slow.length + ")") : null,
        h("button", {class: slow.length ? "" : "primary", type: "button", onclick: () => startSpeedRound()}, "Outra rodada"),
        h("button", {class: "quiet", type: "button", onclick: stopSpeedRound}, "Fechar"))));
  speed.phase = "done";
  renderHome();
}
function stopSpeedRound() {
  releaseMic();
  stopAudio();
  speed.phase = "idle";
  $("speedPlayer").hidden = true;
  $("practiceSetup").hidden = false;
  if (currentView === "practice") renderPracticeSetup();
}
function speedKey(e) {
  const key = e.key.toLowerCase();
  if (e.key === "Escape") { e.preventDefault(); if (speed.active && speed.results.length) finishSpeedRound(); else stopSpeedRound(); return; }
  if (speed.phase === "waiting" || speed.phase === "speaking") {
    if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); revealSpeed(); }
  } else if (speed.phase === "revealed") {
    if (e.key === "1") { e.preventDefault(); gradeSpeed(false); }
    else if (e.key === "3" || e.code === "Space" || e.key === "Enter") { e.preventDefault(); gradeSpeed(true); }
    else if (key === "r") { e.preventDefault(); speakCard(speed.list[speed.i]); }
  }
}
function speedOpen() { return !$("speedPlayer").hidden; }
