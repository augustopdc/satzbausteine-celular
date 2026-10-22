"use strict";
/* Leitura (extras): dificuldade do capítulo/livro, diário de leitura com meta semanal e o ciclo ouvir → ler → ouvir.
   Carregado depois de leitura.js e leitura-pratica.js; usa o estado de app.js só quando chamado. */

// ---------- Dificuldade (cobertura lexical) ----------
/* Faixas pela proporção de palavras corridas conhecidas (Hu & Nation, 2000: ~98% para ler com folga; ~95% é o mínimo razoável). */
const RD_DIFF = [
  [.98, "Fácil para você", "dá para ler solto, quase sem consultar"],
  [.95, "Bom desafio", "o ponto ideal: com o áudio e uma consulta aqui e ali"],
  [.90, "Difícil", "use o áudio, a tradução e o vocabulário do capítulo"],
  [0, "Muito difícil", "melhor ouvir com a tradução ou deixar para depois"]];
function rdDiffLabel(cov) { return RD_DIFF.find(([min]) => cov >= min) || RD_DIFF[RD_DIFF.length - 1]; }
const rdTokens = text => [...String(text).matchAll(/\p{L}+/gu)].map(m => normWord(m[0])).filter(Boolean);
/* Formas que o app ensina até o nível seguinte ao seu, e as que você já estudou (frases do catálogo e próprias). */
function rdKnownForms() {
  const lvl = LEVELS.indexOf(typeof currentLevel === "function" ? currentLevel() || "A1" : "A1");
  const key = lvl + "|" + cards.length + "|" + Object.keys(progress.cards).length;
  if (reading.formsKey === key) return reading.forms;
  const level = new Set(), mine = new Set();
  for (const c of cards) {
    const forms = rdTokens(c.frase), own = studied(c);
    if (own) forms.forEach(f => mine.add(f));
    if (own || isMine(c) || LEVELS.indexOf(tag(c, "Niveau")) <= lvl + 1) forms.forEach(f => level.add(f));
  }
  reading.forms = {level, mine};
  reading.formsKey = key;
  return reading.forms;
}
/* Cobertura de um conjunto de frases: nomes próprios (pelo dicionário do livro) contam como conhecidos. */
function rdCoverage(sentences, forms, names = new Set()) {
  let total = 0, lvl = 0, own = 0;
  for (const s of sentences) for (const t of rdTokens(s.text || s)) {
    total++;
    const known = names.has(t);
    if (known || forms.level.has(t)) lvl++;
    if (known || forms.mine.has(t)) own++;
  }
  return {words: total, level: total ? lvl / total : 0, mine: total ? own / total : 0};
}
function rdNames(book) {
  const w = (book.notes && book.notes.w) || {}, out = new Set();
  for (const [form, e] of Object.entries(w)) if (Array.isArray(e) && /pr[óo]pri|eigenname/i.test(e[1] || "")) out.add(normWord(form));
  return out;
}
/* Dificuldade de cada capítulo do livro aberto (guardada até mudar o nível ou o que você estudou). */
function rdBookDifficulty() {
  const book = reading.book, forms = rdKnownForms(), key = reading.formsKey + "|" + book.id;
  if (reading.diff && reading.diff.key === key) return reading.diff;
  const names = rdNames(book);
  const chapters = book.chapters.map((_, ci) => rdCoverage(reading.order.filter(s => s.ch === ci), forms, names));
  const all = rdCoverage(reading.order, forms, names);
  reading.diff = {key, chapters, all};
  const s = readingState();
  s.diff = {...(s.diff || {}), [book.id]: {level: all.level, mine: all.mine, at: Date.now()}};
  safeWrite(KEY_READING, s);
  return reading.diff;
}
const rdPct = x => Math.round(x * 100) + "%";
function rdChapterSuffix(ci) { const d = rdBookDifficulty().chapters[ci]; return d && d.words ? " · " + rdPct(d.level) : ""; }
/* compact: só a etiqueta (com a porcentagem), e a explicação vai no título; sem compact, a etiqueta e a frase por extenso. */
function rdDifficultyNode(compact) {
  const d = rdBookDifficulty(), c = d.chapters[reading.ch];
  if (!c || !c.words) return null;
  const [, label, hint] = rdDiffLabel(c.level);
  const easier = d.chapters.map((x, i) => [i, x.level]).filter(([i, l]) => i !== reading.ch && l > c.level + .01).sort((a, b) => b[1] - a[1])[0];
  const why = "Proporção das palavras do capítulo que aparecem nas frases do app até o nível " + (LEVELS[LEVELS.indexOf(currentLevel()) + 1] || currentLevel()) + ". Para ler com folga, o ideal é perto de 98%.";
  const detail = rdPct(c.level) + " das palavras o app já ensina até o seu nível · " + rdPct(c.mine) + " você já estudou · " + hint
    + (easier && c.level < .95 ? " · o capítulo " + (easier[0] + 1) + " é mais fácil (" + rdPct(easier[1]) + ")" : "");
  // Informação neutra (e que sobe com o tempo) em vez de um aviso vermelho: quanto das palavras você já estudou.
  // No comecinho (menos de 10% estudadas) vale mais dizer quanto o app já ensina até o seu nível do que “0%”.
  const known = c.mine >= .1 ? "Você conhece " + rdPct(c.mine) + " das palavras" : rdPct(c.level) + " das palavras estão nas frases do app";
  if (compact) return h("span", {class: "rd-diff", tabindex: "0", title: label + ": " + detail + ". " + why}, h("span", {class: "tag rd-diff-n", text: known}));
  return h("div", {class: "rd-diff", title: why}, h("span", {class: "tag rd-diff-n", text: known + " deste capítulo"}), h("span", {class: "muted small-text", text: label + ": " + detail}));
}
function rdBookCardDifficulty(b) {
  const d = (readingState().diff || {})[b.id];
  if (!d) return null;
  return h("p", {class: "muted small-text", text: "Dificuldade: " + rdDiffLabel(d.level)[1].toLowerCase() + " (" + rdPct(d.level) + " das palavras o app ensina até o seu nível)"});
}

// ---------- Diário de leitura ----------
const RD_TICK = 5000, RD_IDLE = 90000, RD_DAY_MIN = 5 * 60000;
function readingLog() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.reading || (progress.practice.reading = {days: {}});
}
function sanitizeReadingLog(src) {
  const out = {days: {}};
  if (!src || typeof src !== "object" || !src.days || typeof src.days !== "object") return out;
  for (const [day, d] of Object.entries(src.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !d || typeof d !== "object") continue;
    const ms = Math.max(0, Math.min(24 * 3600000, Math.round(Number(d.ms) || 0))), cycles = Math.max(0, Math.round(Number(d.cycles) || 0));
    if (ms || cycles) out.days[day] = {ms, cycles, ...(d.c ? {c: 1} : {})};
  }
  return out;
}
/* Cada dia fica com o maior tempo e o maior número de ciclos dos dois lados (cada aparelho conta o seu). */
function mergeReadingLog(local, incoming) {
  const out = sanitizeReadingLog(local);
  for (const [day, d] of Object.entries(sanitizeReadingLog(incoming).days)) {
    const o = out.days[day] || {ms: 0, cycles: 0};
    out.days[day] = {ms: Math.max(o.ms, d.ms), cycles: Math.max(o.cycles, d.cycles), ...(o.c || d.c ? {c: 1} : {})};
  }
  return out;
}
/* Semana de segunda a domingo (como no calendário alemão). */
function rdWeekDays(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()), dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return Array.from({length: 7}, (_, i) => dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)));
}
function rdWeek(now = new Date()) {
  const days = rdWeekDays(now), log = readingLog().days;
  const per = days.map(k => ({day: k, ms: (log[k] || {}).ms || 0}));
  return {per, ms: per.reduce((n, x) => n + x.ms, 0), active: per.filter(x => x.ms >= 60000).length, goal: Number(settings.readingGoal) || 60};
}
/* Soma tempo só com o livro aberto, o app à vista e você ativo (ou o áudio tocando). */
function rdTick() {
  if (currentView !== "reading" || !reading.book || document.visibilityState !== "visible") return;
  const playing = reading.audio && !reading.audio.paused;
  if (!playing && Date.now() - (reading.lastAct || 0) > RD_IDLE) return;
  const day = dateKey(), log = readingLog(), d = log.days[day] || (log.days[day] = {ms: 0, cycles: 0});
  d.ms += RD_TICK;
  // Cinco minutos de leitura no dia contam como estudo (sequência de dias).
  if (!d.c && d.ms >= RD_DAY_MIN) { d.c = 1; progress.days[day] = Number(progress.days[day] || 0) + 1; saveProgress(); return; }
  if (d.ms % 60000 < RD_TICK) saveProgress();
}
/* Diário: total da semana em destaque, barra grossa e uma coluna por dia (altura = minutos); hoje fica marcado na cor do app. */
function rdDiaryNode() {
  const w = rdWeek(), min = Math.round(w.ms / 60000), pct = Math.min(100, w.ms / (w.goal * 60000) * 100);
  const bar = h("span"); setWidth(bar, pct);
  const goal = h("select", {"aria-label": "Meta semanal de leitura"}, ...[15, 30, 60, 90, 120, 180].map(m => new Option(m + " min por semana", String(m))));
  goal.value = String(w.goal);
  goal.addEventListener("change", () => { settings.readingGoal = Number(goal.value); saveSettings(); renderLibrary(); });
  const names = ["S", "T", "Q", "Q", "S", "S", "D"], today = dateKey();
  // A coluna cheia vale a meta do dia (meta da semana ÷ 7) ou o maior dia, o que for maior.
  const top = Math.max(w.goal / 7, ...w.per.map(x => x.ms / 60000), 1);
  const days = w.active === 1 ? "1 dia" : w.active + " dias";
  return h("section", {class: "panel rd-diary"},
    h("div", {class: "rd-diary-head"}, h("h2", {text: "Diário de leitura"}), goal),
    h("p", {class: "rd-diary-total"}, h("b", {text: String(min)}), h("span", {text: " de " + w.goal + " min nesta semana"})),
    h("div", {class: "track rd-diary-track" + (pct >= 100 ? " done" : "")}, bar),
    h("p", {class: "small-text rd-diary-sub", text: pct >= 100 ? "Meta cumprida. Você leu em " + days + "." : w.active ? "Você leu em " + days + ". Faltam " + Math.max(1, w.goal - min) + " min." : "Ainda sem leitura nesta semana."}),
    h("div", {class: "rd-week"}, ...w.per.map((x, i) => {
      const m = Math.round(x.ms / 60000), col = h("i");
      if (m) col.style.height = Math.max(8, Math.min(100, m / top * 100)) + "%";
      return h("div", {class: "rd-week-day" + (x.day === today ? " today" : x.day > today ? " future" : "") + (x.ms >= 60000 ? " on" : ""), title: x.day + ": " + m + " min"},
        h("span", {class: "rd-week-col"}, col), h("b", {text: names[i]}), h("small", {text: m ? m + " min" : ""}));
    })),
    h("p", {class: "muted small-text rd-diary-note", text: "Conta o tempo com o livro aberto e você lendo ou ouvindo; pausas longas não contam. Cinco minutos no dia já valem para a sequência de estudo, e o resumo vai no Pacote para a aula."}));
}
function rdDiarySummary(days, now = Date.now()) {
  const since = now - days * DAY_MS, log = readingLog().days;
  const list = Object.entries(log).filter(([d]) => dayStart(d) >= dayStart(dateKey(new Date(since))));
  return {ms: list.reduce((n, [, d]) => n + d.ms, 0), days: list.filter(([, d]) => d.ms >= 60000).length, cycles: list.reduce((n, [, d]) => n + (d.cycles || 0), 0)};
}

// ---------- Ouvir → ler → ouvir ----------
const RD_CYCLE_TEXT = {
  1: ["Passo 1 de 3 · Ouça sem ler", "Ouça o capítulo inteiro sem o texto. Entenda o que puder; não pare para traduzir."],
  2: ["Passo 2 de 3 · Leia com apoio", "Agora leia com calma: toque nas palavras, veja a tradução e ouça as frases difíceis."],
  3: ["Passo 3 de 3 · Ouça de novo", "Ouça outra vez sem o texto e repare em quanto mais você entende agora."]};
function rdCycleStart() {
  if (!hasSync()) { setStatus("Sincronize o áudio do livro para usar o ouvir → ler → ouvir.", "info"); return; }
  reading.cycle = {ch: reading.ch, step: 1};
  rdCyclePlay();
}
function rdCyclePlay() {
  const [first] = chapterRange(reading.ch);
  reading.sel = first; reading.word = ""; reading.pick = [];
  renderBook();
  window.scrollTo({top: 0});
  toggleFollow();
}
function rdCycleNext() {
  const c = reading.cycle;
  if (!c) return;
  stopReadingAudio();
  if (c.step === 1) { c.step = 2; renderBook(); window.scrollTo({top: 0}); return; }
  if (c.step === 2) { c.step = 3; rdCyclePlay(); return; }
  c.step = 4; renderBook();
}
function rdCycleStop() { reading.cycle = null; stopReadingAudio(); renderBook(); }
/* Fim do capítulo durante uma escuta do ciclo (o áudio não passa para o capítulo seguinte). */
function rdCycleChapterEnd() {
  const c = reading.cycle;
  if (!c) return;
  if (c.step === 1) { toast("Primeira escuta concluída. Agora leia o capítulo com apoio.", "success"); rdCycleNext(); }
  else if (c.step === 3) rdCycleNext();
}
function rdCycleFinish(answer) {
  const log = readingLog(), day = dateKey(), d = log.days[day] || (log.days[day] = {ms: 0, cycles: 0});
  d.cycles = (d.cycles || 0) + 1;
  saveProgress();
  reading.cycle = null;
  markChapterRead();
  setStatus({mais: "Ótimo: é assim que a escuta melhora. Esse capítulo foi marcado como lido.", pouco: "Já é progresso. Repita o ciclo daqui a alguns dias: a diferença aparece.", igual: "Normal no começo. Escolha um capítulo mais fácil ou repita este com a tradução por perto."}[answer] || "Ciclo concluído.", "success");
  renderBook();
}
function rdCycleBanner() {
  const c = reading.cycle;
  // Sem ciclo, o botão de começar fica na linha de etiquetas do capítulo (rdChapterChips, em leitura.js).
  if (!c) return null;
  if (c.step === 4) return h("div", {class: "panel rd-cycle done"},
    h("b", {text: "Ciclo concluído · capítulo " + (c.ch + 1)}),
    h("p", {text: "Na segunda escuta, você entendeu…"}),
    h("div", {class: "row"}, h("button", {class: "primary small", type: "button", onclick: () => rdCycleFinish("mais")}, "Bem mais"),
      h("button", {class: "small", type: "button", onclick: () => rdCycleFinish("pouco")}, "Um pouco mais"),
      h("button", {class: "small", type: "button", onclick: () => rdCycleFinish("igual")}, "Igual")));
  const [title, text] = RD_CYCLE_TEXT[c.step], listening = c.step !== 2, on = reading.follow && reading.audio && !reading.audio.paused;
  return h("div", {class: "panel rd-cycle"},
    h("b", {text: title}), h("p", {class: "muted small-text", text: text}),
    h("div", {class: "row"},
      listening ? h("button", {class: "small", type: "button", onclick: () => { toggleFollow(); renderBook(); }}, iconText(on ? "pause" : "play", on ? "Pausar" : "Continuar")) : null,
      h("button", {class: "primary small", type: "button", onclick: rdCycleNext}, c.step === 1 ? "Ir para a leitura →" : c.step === 2 ? "Ouvir de novo sem texto →" : "Terminar"),
      h("button", {class: "quiet small", type: "button", onclick: rdCycleStop}, "Sair do ciclo")));
}
function rdCycleHides() { return !!(reading.cycle && (reading.cycle.step === 1 || reading.cycle.step === 3)); }

// ---------- Ligação com a tela ----------
document.addEventListener("click", () => { if (currentView === "reading") reading.lastAct = Date.now(); }, true);
document.addEventListener("keydown", () => { if (currentView === "reading") reading.lastAct = Date.now(); }, true);
document.addEventListener("scroll", () => { if (currentView === "reading") reading.lastAct = Date.now(); }, {passive: true, capture: true});
{ const t = setInterval(rdTick, RD_TICK); if (t && t.unref) t.unref(); }
