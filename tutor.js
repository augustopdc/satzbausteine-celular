"use strict";
/* Pacote para a aula: junta o material dos últimos dias numa folha para o tutor (copiar ou imprimir/PDF).
   Frases que travaram (histórico de revisões), erros das conversas e dos monólogos 4/3/2, evolução da fluência,
   frases próprias criadas, onde mais erra, uma cena para o tutor fazer o outro papel e, opcionalmente, pontos
   para revisar sugeridos pela IA local. Carregado antes de app.js; usa funções de app.js e dos outros módulos. */

const tutor = {days: 7, data: null, points: null, checks: {}};

/* Conferência com o tutor: cada cartão da IA recebe “ok” (certo), “fix” (corrigido, com a frase nova) ou “drop” (descartar).
   Tudo é aplicado de uma vez; o que ficou sem marcação continua esperando. Devolve quantos de cada. */
function tutorApplyChecks(checks) {
  const bare = s => String(s || "").toLowerCase().replace(/[.,!?;:"“”„]/g, "").replace(/\s+/g, " ").trim();
  const done = {ok: 0, fix: 0, drop: 0};
  for (const [id, c] of Object.entries(checks || {})) {
    const m = mineData().items[id];
    if (!m || m.deleted || !minePending(m) || !c) continue;
    if (c.v === "drop") { deleteMineItem(id); done.drop++; continue; }
    const fix = String(c.fix || "").replace(/\s+/g, " ").trim(), note = String(c.note || "").replace(/\s+/g, " ").trim();
    if (c.v === "fix" && fix && bare(fix) !== bare(m.frase)) {
      const next = {...m, frase: fix, check: "tutor"};
      // O “certo” do erro costuma ser a própria frase: acompanha a correção do tutor.
      if (m.erro) next.erro = {...m.erro, certo: bare(m.erro.certo) === bare(m.frase) ? fix : m.erro.certo, explicacao: note || m.erro.explicacao};
      else if (note) next.foco = note;
      saveMineItem(id, next);
      done.fix++;
    } else if (c.v === "ok" || c.v === "fix") { setMineCheck(id, "tutor"); done.ok++; }
  }
  return done;
}

/* Dados do pacote (função pura sobre o estado; o histórico de revisões vem por parâmetro). */
function tutorPackData(days, revlog, now = Date.now()) {
  const since = now - days * DAY_MS;
  const misses = new Map();
  for (const r of revlog || []) if (r.ts >= since && Number(r.g) === 1) misses.set(r.cardId, (misses.get(r.cardId) || 0) + 1);
  const stuck = [...misses.entries()].map(([id, n]) => ({card: byId.get(id), n})).filter(x => x.card)
    .sort((a, b) => b.n - a.n || a.card.id.localeCompare(b.card.id)).slice(0, 12);
  const convSessions = (((progress.practice || {}).conversa || {}).sessions || []).filter(s => s.at >= since);
  const convErrors = [], seen = new Set();
  for (const s of convSessions.slice().reverse()) for (const e of s.errors || []) {
    const k = (e.errado + "→" + e.certo).toLowerCase();
    if (!seen.has(k)) { seen.add(k); convErrors.push({...e, topic: s.topic}); }
  }
  const f432 = (((progress.practice || {}).f432 || {}).sessions || []).filter(s => s.at >= since);
  const items = Object.entries(((progress.mine || {}).items) || {});
  const mine = items.filter(([, m]) => !m.deleted && m.check !== "conferir" && m.at >= since).map(([id, m]) => ({id, ...m}));
  // Cartões da IA esperando conferência entram todos, de qualquer data: a aula é o lugar de validá-los.
  const toCheck = items.filter(([, m]) => !m.deleted && m.check === "conferir").map(([id, m]) => ({id, ...m})).sort((a, b) => b.at - a.at).slice(0, 20);
  const reasons = Object.entries(progress.errorStats || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => ({label: (ERROR_REASONS.find(r => r.id === k) || {}).label || k, n}));
  const level = typeof currentLevel === "function" ? currentLevel() : "A1";
  const scenes = SCENES.filter(s => s.level === level || LEVELS.indexOf(s.level) === LEVELS.indexOf(level) + 1);
  const scenePick = scenes.map(s => ({s, st: sceneStats(s.id)})).sort((a, b) => (a.st ? a.st.best : -1) - (b.st ? b.st.best : -1))[0];
  const studyDays = Object.keys(progress.days || {}).filter(d => dayStart(d) >= dayStart(dateKey(new Date(since)))).length;
  const read = typeof rdDiarySummary === "function" ? rdDiarySummary(days, now) : null;
  return {days, since, level, stuck, convSessions: convSessions.length, convErrors: convErrors.slice(0, 12), f432, mine, toCheck, reasons, reading: read && read.ms >= 60000 ? read : null,
    scene: scenePick ? scenePick.s : null, studyDays, reviews: (revlog || []).filter(r => r.ts >= since).length};
}
function tutorReadingLine(r) {
  return "Leitura em alemão: " + Math.round(r.ms / 60000) + " min em " + r.days + (r.days === 1 ? " dia" : " dias") + (r.cycles ? " · " + r.cycles + (r.cycles === 1 ? " ciclo" : " ciclos") + " ouvir → ler → ouvir" : "") + ".";
}
function tutorCounts(d) {
  const n = (v, one, many) => v + " " + (v === 1 ? one : many);
  return [n(d.studyDays, "dia de estudo", "dias de estudo"), n(d.reviews, "revisão", "revisões"), n(d.convSessions, "conversa com a IA", "conversas com a IA")].join(", ");
}
function tutorText(d, points) {
  const lines = ["Satzbausteine · pacote para a aula", "Período: " + formatDate(dateKey(new Date(d.since))) + " a " + formatDate(dateKey()) + " · nível atual " + d.level,
    tutorCounts(d) + ".", ""];
  if (d.stuck.length) { lines.push("Frases que mais travaram no treino:"); d.stuck.forEach(x => lines.push("- " + x.card.frase + " (" + x.card.traducao + ") · errei " + x.n + "×")); lines.push(""); }
  if (d.convErrors.length) { lines.push("Erros nas conversas (corrigidos pela IA; conferir):"); d.convErrors.forEach(e => lines.push("- " + e.errado + " → " + e.certo + (e.explicacao ? " · " + e.explicacao : ""))); lines.push(""); }
  if (d.f432.length) { lines.push("Monólogos 4/3/2 (palavras por minuto na 1ª → 3ª rodada):"); d.f432.forEach(s => lines.push("- " + formatDate(dateKey(new Date(s.at))) + ": " + s.rounds.map(f432Wpm).join(" → ") + " palavras/min, " + s.rounds.map(r => r.pauses).join(" → ") + " pausas")); lines.push(""); }
  if (d.toCheck.length) {
    lines.push("Cartões criados pela IA para conferir (marque cada um: certo, corrigir com a frase certa ou descartar):");
    d.toCheck.forEach((m, i) => lines.push((i + 1) + ". " + m.frase + " (" + m.traducao + ")" + (m.erro ? " · eu disse: " + m.erro.errado : "") + "\n   ( ) certo   ( ) corrigir: ____________   ( ) descartar"));
    lines.push("");
  }
  if (d.mine.length) { lines.push("Frases que eu criei (conferir se estão naturais):"); d.mine.forEach(m => lines.push("- " + m.frase + " (" + m.traducao + ")" + (m.erro ? " · meu erro: " + m.erro.errado : ""))); lines.push(""); }
  if (d.reading) { lines.push(tutorReadingLine(d.reading)); lines.push(""); }
  if (d.reasons.length) { lines.push("Onde mais erro no treino: " + d.reasons.map(r => r.label + " (" + r.n + ")").join(", ") + "."); lines.push(""); }
  if (d.scene) { lines.push("Cena para praticar juntos: " + d.scene.title + " — " + d.scene.setting + " O tutor faz o papel de " + d.scene.other.name + "."); lines.push(""); }
  if (points && points.length) { lines.push("Pontos para revisar na aula:"); points.forEach(p => { lines.push("- " + p.ponto); (p.exemplos || []).forEach(x => lines.push("    · " + x)); }); }
  return lines.join("\n").trim();
}
async function tutorBuild() {
  let revlog = [];
  try { revlog = await readRevlog(); } catch (e) { reportError("pacote", e.message); }
  tutor.data = tutorPackData(tutor.days, revlog);
  tutor.points = null;
  tutorRender();
}
async function tutorSuggest() {
  const d = tutor.data;
  if (!d || !convAvailable()) return;
  tutor.points = {loading: true};
  tutorRender();
  const material = [...d.convErrors.map(e => e.errado + " → " + e.certo), ...d.stuck.map(x => "Travou: " + x.card.frase), ...d.mine.filter(m => m.erro).map(m => m.erro.errado + " → " + m.erro.certo)].slice(0, 30).join("\n");
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: `You help Luiz, a Brazilian learner of German (level ${d.level}), prepare his private lesson. From his recent mistakes and difficult sentences below, pick up to 4 grammar or vocabulary points worth reviewing with the tutor, most important first. For each: ponto (short title in Brazilian Portuguese, e.g. "Perfekt com sein (verbos de movimento)") and exemplos (2 short correct German practice sentences at his level). Answer as JSON.`},
      {role: "user", content: material || "(no mistakes recorded)"}], {kind: "tutor", temperature: .3, maxTokens: 700,
      schema: {type: "object", properties: {pontos: {type: "array", maxItems: 4, items: {type: "object", properties: {ponto: {type: "string"}, exemplos: {type: "array", maxItems: 2, items: {type: "string"}}}, required: ["ponto", "exemplos"]}}}, required: ["pontos"]}});
    const j = parseLooseJson(r.text);
    tutor.points = j && Array.isArray(j.pontos) ? j.pontos.filter(p => p && p.ponto).map(p => ({ponto: convClean(p.ponto), exemplos: (p.exemplos || []).map(convClean).filter(Boolean)})) : [];
  } catch (e) { tutor.points = null; setStatus("Não consegui sugerir os pontos: " + cleanIpcError(e, "erro"), "error"); }
  tutorRender();
}
function tutorRender() {
  const box = $("tutorPack");
  if (!box) return;
  const d = tutor.data;
  const days = h("select", {"aria-label": "Período"}, h("option", {value: "7"}, "Últimos 7 dias"), h("option", {value: "14"}, "Últimos 14 dias"), h("option", {value: "30"}, "Últimos 30 dias"));
  days.value = String(tutor.days);
  days.addEventListener("change", () => { tutor.days = Number(days.value); tutorBuild(); });
  const list = (title, items) => items.length ? h("div", null, h("h3", {text: title}), h("ul", {class: "tutor-list"}, ...items)) : null;
  const pts = tutor.points;
  fill(box,
    h("div", {class: "row between no-print"}, h("h2", {text: "Pacote para a aula"}), days),
    !d ? h("div", {class: "no-print"}, h("p", {class: "muted small-text", text: "Junta numa folha o que vale levar ao tutor: frases que travaram, erros das conversas, evolução da fluência, frases que você criou e uma cena para praticarem juntos."}),
      h("button", {class: "primary", type: "button", onclick: tutorBuild}, "Montar pacote")) : null,
    d ? h("div", {class: "tutor-sheet", id: "tutorSheet"},
      h("p", {class: "muted small-text", text: "Período: " + formatDate(dateKey(new Date(d.since))) + " a " + formatDate(dateKey()) + " · nível atual " + d.level + " · " + tutorCounts(d)}),
      list("Frases que mais travaram no treino", d.stuck.map(x => h("li", null, h("b", {lang: "de", text: x.card.frase}), h("span", {class: "muted", text: " — " + x.card.traducao + " · errei " + x.n + "×"})))),
      list("Erros nas conversas (corrigidos pela IA; conferir)", d.convErrors.map(e => h("li", null, h("s", {lang: "de", text: e.errado}), " → ", h("b", {lang: "de", text: e.certo}), e.explicacao ? h("span", {class: "muted", text: " · " + e.explicacao}) : null))),
      list("Monólogos 4/3/2 (palavras por minuto, 1ª → 3ª rodada)", d.f432.map(s => h("li", null, formatDate(dateKey(new Date(s.at))) + ": " + s.rounds.map(f432Wpm).join(" → ") + " palavras/min · " + s.rounds.map(r => r.pauses).join(" → ") + " pausas"))),
      tutorCheckBlock(d.toCheck),
      list("Frases que eu criei (conferir se estão naturais)", d.mine.map(m => h("li", null, h("b", {lang: "de", text: m.frase}), h("span", {class: "muted", text: " — " + m.traducao}), m.erro ? h("span", {class: "muted", text: " · meu erro: " + m.erro.errado}) : null))),
      d.reading ? h("p", {text: tutorReadingLine(d.reading)}) : null,
      d.reasons.length ? h("p", null, h("b", {text: "Onde mais erro no treino: "}), d.reasons.map(r => r.label + " (" + r.n + ")").join(", ") + ".") : null,
      d.scene ? h("p", null, h("b", {text: "Cena para praticar juntos: "}), d.scene.title + " — " + d.scene.setting + " O tutor faz o papel de " + d.scene.other.name + ".") : null,
      pts && pts.loading ? h("p", {class: "muted", text: "A IA está escolhendo os pontos…"}) : null,
      pts && pts.length ? list("Pontos para revisar na aula", pts.map(p => h("li", null, h("b", {text: p.ponto}), ...p.exemplos.map(x => h("span", {class: "tutor-ex", lang: "de", text: x}))))) : null,
      !d.stuck.length && !d.convErrors.length && !d.mine.length && !d.toCheck.length && !d.f432.length ? h("p", {class: "muted", text: "Pouco material neste período. Treine, converse ou faça um monólogo e monte o pacote de novo."}) : null) : null,
    d ? h("div", {class: "row no-print"},
      h("button", {class: "primary", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(tutorText(tutor.data, Array.isArray(tutor.points) ? tutor.points : null)); toast("Pacote copiado. Cole na mensagem para o tutor.", "success"); }
        catch (e) { setStatus("Não consegui copiar.", "error"); }
      }}, "Copiar texto"),
      h("button", {type: "button", onclick: tutorPrint}, "Imprimir ou salvar PDF"),
      convAvailable() && !(pts && pts.loading) ? h("button", {class: "quiet", type: "button", onclick: tutorSuggest}, pts ? "Sugerir outros pontos (IA)" : "Sugerir pontos para a aula (IA)") : null,
      h("button", {class: "quiet", type: "button", onclick: tutorBuild}, "Atualizar")) : null);
}
/* Bloco de conferência: na tela, botões por cartão e “Aplicar”; no papel, caixinhas para o tutor marcar à mão. */
function tutorCheckBlock(items) {
  if (!items.length) return null;
  const marked = Object.keys(tutor.checks).filter(id => items.some(m => m.id === id) && tutor.checks[id].v).length;
  const choice = (id, v, label) => h("button", {type: "button", class: "chip", "aria-pressed": String((tutor.checks[id] || {}).v === v),
    onclick: () => {
      const c = tutor.checks[id] || {};
      tutor.checks[id] = c.v === v ? {} : {...c, v, fix: c.fix != null ? c.fix : items.find(m => m.id === id).frase};
      tutorRender();
      if (v === "fix" && tutor.checks[id].v === "fix") { const f = document.getElementById("tutorFix-" + id); if (f) { f.focus(); f.select(); } }
    }}, label);
  return h("div", null,
    h("h3", {text: "Cartões da IA para conferir com o tutor (" + items.length + ")"}),
    h("p", {class: "muted small-text no-print", text: "Na aula, marque cada um com o tutor e aplique tudo de uma vez. Os sem marcação continuam esperando."}),
    h("ol", {class: "tutor-list tutor-check"}, ...items.map(m => {
      const c = tutor.checks[m.id] || {};
      return h("li", null,
        h("b", {lang: "de", text: m.frase}), h("span", {class: "muted", text: " — " + m.traducao}), m.erro ? h("span", {class: "muted", text: " · eu disse: " + m.erro.errado}) : null,
        h("span", {class: "print-only tutor-boxes", text: "☐ certo   ☐ corrigir: ______________________   ☐ descartar"}),
        h("div", {class: "chips no-print"}, choice(m.id, "ok", "Certo"), choice(m.id, "fix", "Corrigir"), choice(m.id, "drop", "Descartar")),
        c.v === "fix" ? h("div", {class: "tutor-fix no-print"},
          h("input", {id: "tutorFix-" + m.id, type: "text", lang: "de", spellcheck: "false", "aria-label": "Frase corrigida pelo tutor", value: c.fix || "",
            oninput: e => { tutor.checks[m.id].fix = e.target.value; }}),
          h("input", {type: "text", placeholder: "Explicação do tutor (opcional)", "aria-label": "Explicação do tutor", value: c.note || "",
            oninput: e => { tutor.checks[m.id].note = e.target.value; }})) : null);
    })),
    h("div", {class: "row no-print"}, h("button", {type: "button", class: "primary", disabled: !marked, onclick: () => {
      const r = tutorApplyChecks(tutor.checks);
      tutor.checks = {};
      const parts = [r.ok && r.ok + " certo" + (r.ok > 1 ? "s" : ""), r.fix && r.fix + " corrigido" + (r.fix > 1 ? "s" : ""), r.drop && r.drop + " descartado" + (r.drop > 1 ? "s" : "")].filter(Boolean);
      toast(parts.length ? "Conferência aplicada: " + parts.join(", ") + "." + (r.fix ? " Confira a tradução dos corrigidos em Minhas frases." : "") : "Nada para aplicar.", "success");
      tutorBuild();
    }}, marked ? "Aplicar conferência (" + marked + ")" : "Aplicar conferência")));
}
function tutorPrint() {
  document.body.classList.add("print-pack");
  const done = () => { document.body.classList.remove("print-pack"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 60000);
}
