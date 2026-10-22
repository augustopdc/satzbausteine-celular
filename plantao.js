"use strict";
/* Modo plantão: escala (plantão / pós-plantão / folga), carga de cada dia, acúmulo distribuído depois do plantão,
   plano e sequência contando só os dias de estudo. A escala fica em progress.schedule (entra no backup e na sincronização).
   Usa funções de app.js, que é carregado depois: tudo aqui só é chamado em tempo de execução. */

const SHIFT_TYPES = ["normal", "plantao", "pos", "folga"];
const SHIFT_LABELS = {normal: "Dia comum", plantao: "Plantão", pos: "Pós-plantão", folga: "Folga"};
const SHIFT_SHORT = {normal: "", plantao: "P", pos: "PP", folga: "F"};
const SHIFT_PRESETS = {
  "24x72": {label: "24 × 72 · plantão, pós e 2 folgas", cycle: ["plantao", "pos", "folga", "folga"]},
  "24x48": {label: "24 × 48 · plantão, pós e folga", cycle: ["plantao", "pos", "folga"]},
  "12x36": {label: "12 × 36 · plantão e folga", cycle: ["plantao", "folga"]}
};
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const RECOVERY_DAYS = 3;   // o acúmulo do plantão é distribuído em até 3 dias
const FOLGA_BONUS = 1.5;   // folga: 50% a mais de frases novas
const RECOVERY_NEW = .5;   // dia comum logo depois do plantão: metade das novas
const BUDGET_OPTIONS = [10, 20, 30, 45];
const NEW_CARD_COST = 3;   // uma frase nova (apresentar, lacuna, frase inteira) custa ~3 avaliações

function defaultSchedule() {
  return {mode: "none", preset: "", weekly: new Array(7).fill("normal"), cycleStart: "", overrides: {}, budgets: {}, weeklyShifts: 0,
    minutes: 10, autoPos: false, updatedAt: 0};
}
function sanitizeSchedule(source) {
  const s = defaultSchedule();
  if (!source || typeof source !== "object") return s;
  if (["none", "weekly", "cycle"].includes(source.mode)) s.mode = source.mode;
  if (Array.isArray(source.weekly) && source.weekly.length === 7) s.weekly = source.weekly.map(t => SHIFT_TYPES.includes(t) ? t : "normal");
  if (SHIFT_PRESETS[source.preset]) s.preset = source.preset;
  if (/^\d{4}-\d{2}-\d{2}$/.test(source.cycleStart || "")) s.cycleStart = source.cycleStart;
  if (s.mode === "cycle" && (!s.preset || !s.cycleStart)) s.mode = "none";
  if (source.overrides && typeof source.overrides === "object") {
    for (const [day, t] of Object.entries(source.overrides)) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && SHIFT_TYPES.includes(t)) s.overrides[day] = t;
  }
  if (source.budgets && typeof source.budgets === "object") {
    for (const [day, m] of Object.entries(source.budgets)) {
      const v = Math.round(Number(m));
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(v) && (v === 0 || (v >= 5 && v <= 240))) s.budgets[day] = v;
    }
  }
  if (Number.isFinite(Number(source.weeklyShifts))) s.weeklyShifts = Math.min(7, Math.max(0, Math.round(Number(source.weeklyShifts) * 2) / 2));
  if (Number.isFinite(Number(source.minutes))) s.minutes = Math.min(30, Math.max(5, Math.round(Number(source.minutes))));
  if (typeof source.autoPos === "boolean") s.autoPos = source.autoPos;
  s.updatedAt = Number(source.updatedAt) || 0;
  return s;
}
function schedule() { return progress.schedule || (progress.schedule = defaultSchedule()); }
function scheduleActive() { const s = schedule(); return s.mode !== "none" || s.weeklyShifts > 0 || Object.keys(s.overrides).length > 0; }
function touchSchedule() {
  schedule().updatedAt = Date.now();
  saveProgress();
}
function shiftKey(key, days) { const d = new Date(key + "T12:00:00"); d.setDate(d.getDate() + days); return dateKey(d); }

// ---------- Tipo de cada dia ----------
/* Tipo pela escala (padrão semanal ou ciclo) sem as marcações manuais. */
function patternDayType(key) {
  const s = schedule();
  if (s.mode === "weekly") return s.weekly[new Date(key + "T12:00:00").getDay()] || "normal";
  if (s.mode === "cycle" && SHIFT_PRESETS[s.preset] && s.cycleStart) {
    const cycle = SHIFT_PRESETS[s.preset].cycle, n = cycle.length;
    return cycle[((calendarDays(dayStart(s.cycleStart), dayStart(key)) % n) + n) % n];
  }
  return "normal";
}
function baseDayType(key) { return schedule().overrides[key] || patternDayType(key); }
/* Tipo sem a marcação manual deste dia: um dia comum logo depois de um plantão vira pós-plantão (se a opção estiver ligada). */
function naturalDayType(key) {
  const t = patternDayType(key);
  if (t === "normal" && schedule().autoPos && baseDayType(shiftKey(key, -1)) === "plantao") return "pos";
  return t;
}
/* Tipo final: a marcação manual vale mais que a escala. */
function dayType(key = dateKey()) { return schedule().overrides[key] || naturalDayType(key); }
function markDay(key, type) {
  const s = schedule();
  if (type === naturalDayType(key)) delete s.overrides[key]; else s.overrides[key] = type;
  touchSchedule();
}
function isRestDay(key) { const t = dayType(key); return t === "plantao" || t === "pos"; }
/* Dias desde o último plantão (1 a 3), ou 0 se não houve plantão recente. */
function daysSinceShift(key = dateKey()) {
  for (let k = 1; k <= RECOVERY_DAYS; k++) if (dayType(shiftKey(key, -k)) === "plantao") return k;
  return 0;
}

// ---------- Carga do dia ----------
function dayPlan(key = dateKey()) {
  const type = dayType(key), s = schedule(), base = Math.max(0, Number(settings.newLimit) || 0);
  const recovery = type === "pos" ? Math.max(1, daysSinceShift(key)) : type === "normal" ? daysSinceShift(key) : 0;
  let newLimit = base;
  if (type === "plantao" || type === "pos") newLimit = 0;
  else if (type === "folga") newLimit = Math.ceil(base * FOLGA_BONUS);
  else if (recovery) newLimit = Math.ceil(base * RECOVERY_NEW);
  return {type, newLimit, recovery, minutes: s.minutes};
}
/* Peso de um dia no plano: quantos "dias comuns" de frases novas ele vale.
   Sem escala fixa, um dia futuro não marcado desconta a média de plantões por semana. */
function studyWeight(key) {
  const p = dayPlan(key), s = schedule();
  if (p.type === "plantao" || p.type === "pos") return 0;
  if (p.type === "folga") return FOLGA_BONUS;
  if (p.recovery) return RECOVERY_NEW;
  if (s.mode === "none" && s.weeklyShifts > 0 && key > dateKey() && !s.overrides[key]) return expectedWeight();
  return 1;
}
function expectedWeight() {
  const s = schedule();
  return Math.max(0, 1 - s.weeklyShifts * (s.autoPos ? 2 : 1) / 7);
}
function studyWeightUntil(endKey, startKey = dateKey()) {
  let total = 0;
  for (let key = startKey, i = 0; key < endKey && i < 7300; key = shiftKey(key, 1), i++) total += studyWeight(key);
  return total;
}
/* Dias de calendário até terminar `amount` frases novas, com `limit` por dia comum. */
function daysToFinish(amount, limit) {
  if (!amount) return 0;
  if (!limit) return Infinity;
  let done = 0, key = dateKey();
  for (let i = 0; i < 7300; i++, key = shiftKey(key, 1)) { done += limit * studyWeight(key); if (done >= amount) return i + 1; }
  return Infinity;
}
/* Média de revisões que vencem por dia na próxima semana (a carga “normal”). */
function typicalLoad() {
  const next = forecastCounts(8).slice(1);
  return Math.ceil(next.reduce((a, b) => a + b, 0) / next.length);
}
function extraReviewsToday() { return session.extraReviewsDay === dateKey() ? session.extraReviews || 0 : 0; }
/* Tempo de estudo de hoje em minutos (0 = sem limite). Plantão sem escolha usa os minutos da escala. */
function budgetToday(plan = dayPlan()) {
  const chosen = schedule().budgets[dateKey()];
  if (chosen !== undefined) return chosen;
  return plan.type === "plantao" ? plan.minutes : 0;
}
function secondsLeftToday(budget) {
  const used = (((progress.dayStats || {})[dateKey()] || {}).ms || 0) / 1000;
  return Math.max(0, budget * 60 - used);
}
/* Quantas frases novas cabem no tempo que sobra depois das revisões (Infinity sem limite de tempo). */
function freshRoomToday(plan, reviewsPlanned) {
  const budget = budgetToday(plan);
  if (!budget) return Infinity;
  const room = secondsLeftToday(budget) - reviewsPlanned * averageSeconds();
  return Math.max(0, Math.floor(room / (NEW_CARD_COST * averageSeconds())));
}
function setTodayBudget(minutes) {
  const s = schedule(), today = dateKey(), natural = dayPlan().type === "plantao" ? s.minutes : 0;
  if (minutes === natural) delete s.budgets[today]; else s.budgets[today] = minutes;
  for (const day of Object.keys(s.budgets)) if (day < shiftKey(today, -14)) delete s.budgets[day];
  touchSchedule();
  renderHome();
  if (currentView === "practice" && !session.active) renderPracticeSetup();
}
/* Teto de revisões para o dia inteiro (produção + escuta), já contando as feitas hoje. */
function reviewCapToday(plan = dayPlan(), dueTotal) {
  const done = Number((progress.reviewDays || {})[dateKey()] || 0), budget = budgetToday(plan);
  let cap = Infinity;
  if (budget) cap = done + Math.floor(secondsLeftToday(budget) / averageSeconds());
  else if (plan.recovery && plan.type !== "folga") {
    const due = dueTotal ?? countDue("production") + countDue("listening");
    cap = Math.max(Math.ceil((due + done) / (RECOVERY_DAYS + 1 - plan.recovery)), typicalLoad());
  }
  if (settings.reviewLimit !== "" && settings.reviewLimit != null) cap = Math.min(cap, Number(settings.reviewLimit));
  return cap + extraReviewsToday();
}
function reviewsLeftToday(plan, dueTotal) {
  return Math.max(0, reviewCapToday(plan, dueTotal) - Number((progress.reviewDays || {})[dateKey()] || 0));
}
/* Resumo de hoje para o início, o treino e o lembrete. */
function todayLoad() {
  const plan = dayPlan(), rawProd = countDue("production"), rawListen = countDue("listening");
  let left = reviewsLeftToday(plan, rawProd + rawListen);
  const dueProd = Math.min(rawProd, left);
  left -= dueProd;
  const dueListen = Math.min(rawListen, left);
  const fresh = Math.min(newAvailableToday(plan), freshRoomToday(plan, dueProd + dueListen));
  return {plan, budget: budgetToday(plan), dueProd, dueListen, fresh, held: rawProd + rawListen - dueProd - dueListen};
}
/* Limite de novas do dia já considerando o tempo: nunca passa do limite do tipo de dia. */
function freshLimitToday(plan = dayPlan()) {
  const reviews = Math.min(reviewsLeftToday(plan), countDue("production") + countDue("listening"));
  return Math.min(plan.newLimit, introducedToday() + freshRoomToday(plan, reviews));
}
/* Probabilidade de lembrar agora (FSRS); menor = mais urgente. */
function retrievabilityNow(record, now = Date.now()) {
  if (!record || !(record.stability > 0) || !Number.isFinite(record.lastReviewed)) return 0;
  return FSRS.retrievability(Math.max(0, (now - record.lastReviewed) / DAY_MS), record.stability);
}

// ---------- Interface: hoje (início) ----------
function setTodayType(type) {
  if (!SHIFT_TYPES.includes(type)) return;
  markDay(dateKey(), type);
  renderHome();
  if (currentView === "plan") renderPlan();
}
function shiftChips(current, onPick) {
  return SHIFT_TYPES.map(t => h("button", {class: "chip shift-chip sc-" + t, type: "button", "aria-pressed": String(current === t), onclick: () => onPick(t)}, SHIFT_LABELS[t]));
}
function shiftNote(load) {
  const {plan, held, budget} = load, later = held ? " " + held + (held === 1 ? " revisão fica" : " revisões ficam") + " para os próximos dias." : "";
  const parts = [];
  if (plan.type === "plantao") parts.push("Plantão: só as revisões mais urgentes e nenhuma frase nova.");
  else if (plan.type === "pos") parts.push("Pós-plantão: o acúmulo é dividido em até " + RECOVERY_DAYS + " dias e não entram frases novas. Descanse.");
  else if (plan.type === "folga") parts.push("Folga: " + Math.round((FOLGA_BONUS - 1) * 100) + "% a mais de frases novas. Bom dia para uma cena e um Modo Prova.");
  else if (plan.recovery) parts.push("Depois do plantão: revisões atrasadas distribuídas e metade das frases novas.");
  if (budget) {
    const left = Math.round(secondsLeftToday(budget) / 60);
    parts.push("Sessão sob medida para " + budget + " min" + (left < budget ? " (restam " + left + ")" : "") + ": revisões mais urgentes primeiro"
      + (plan.newLimit ? "; frases novas só se sobrar tempo." : "."));
  }
  return parts.length ? parts.join(" ") + later : "";
}
let dayPopBound = false;
function renderShiftToday(load) {
  fill($("heroShift"), h("span", {class: "shift-label", text: "Hoje:"}), ...shiftChips(load.plan.type, setTodayType));
  const options = [...new Set([...BUDGET_OPTIONS, load.plan.type === "plantao" ? load.plan.minutes : 10])].sort((a, b) => a - b);
  if (schedule().budgets[dateKey()] && !options.includes(load.budget)) options.push(load.budget);
  fill($("heroBudget"), h("span", {class: "shift-label", text: "Tempo:"}),
    ...options.map(m => h("button", {class: "chip shift-chip", type: "button", "aria-pressed": String(load.budget === m), onclick: () => setTodayBudget(m)}, m + " min")),
    h("button", {class: "chip shift-chip", type: "button", "aria-pressed": String(!load.budget), onclick: () => setTodayBudget(0)}, "Sem limite"));
  // Na tela Hoje, tipo de dia e tempo ficam num botão só (“Dia comum, sem limite”) que abre as opções.
  const btn = $("dayBtn"), pop = $("dayPop");
  if (btn) {
    fill(btn, icon(load.plan.type === "plantao" || load.plan.type === "pos" ? "moon" : "sun", 16),
      h("span", {text: SHIFT_LABELS[load.plan.type] + ", " + (load.budget ? load.budget + " min" : "sem limite")}), icon("chevron", 14));
    btn.onclick = e => { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute("aria-expanded", String(!pop.hidden)); };
    if (!dayPopBound) {
      dayPopBound = true;
      document.addEventListener("click", e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); } });
    }
  }
  const note = shiftNote(load);
  $("heroShiftNote").textContent = note;
  $("heroShiftNote").hidden = !note;
  $("heroShiftNote").className = "shift-note sn-" + load.plan.type;
  $("heroFolga").hidden = load.plan.type !== "folga";
}

// ---------- Interface: escala (Meu plano) ----------
const CALENDAR_WEEKS = 6;
function cycleCalendarDay(key) {
  markDay(key, SHIFT_TYPES[(SHIFT_TYPES.indexOf(dayType(key)) + 1) % SHIFT_TYPES.length]);
  renderPlan();
  renderHome();
}
function renderShiftCalendar() {
  const s = schedule(), today = dateKey(), start = new Date(today + "T12:00:00");
  start.setDate(start.getDate() - start.getDay());
  const cells = WEEKDAYS.map(d => h("span", {class: "cal-head", text: d}));
  for (let i = 0; i < CALENDAR_WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dateKey(d), type = dayType(key), manual = !!s.overrides[key];
    const label = d.toLocaleDateString("pt-BR", {weekday: "long", day: "numeric", month: "long"}) + ": " + SHIFT_LABELS[type] + (manual ? " (marcado à mão)" : "") + ". Clique para trocar.";
    cells.push(h("button", {class: "cal-day ct-" + type + (key === today ? " today" : "") + (key < today ? " past" : "") + (manual ? " manual" : ""),
      type: "button", title: label, "aria-label": label, onclick: () => cycleCalendarDay(key)},
      h("b", {text: d.getDate() === 1 ? d.getDate() + " " + d.toLocaleDateString("pt-BR", {month: "short"}).replace(".", "") : d.getDate()}),
      h("small", {text: SHIFT_SHORT[type]})));
  }
  $("shiftCalendar").replaceChildren(...cells);
}
function renderSchedule() {
  const s = schedule();
  $("shiftMode").value = s.mode === "cycle" ? s.preset : s.mode;
  $("shiftAvgRow").hidden = s.mode !== "none";
  $("shiftAvg").value = s.weeklyShifts;
  $("shiftCycleRow").hidden = s.mode !== "cycle";
  $("shiftCycleStart").value = s.cycleStart || "";
  $("shiftWeekly").hidden = s.mode !== "weekly";
  if (s.mode === "weekly") {
    fill($("shiftWeekly"), ...WEEKDAYS.map((day, i) => {
      const id = "shiftWeek" + i;
      const select = h("select", {id}, ...SHIFT_TYPES.map(t => new Option(SHIFT_LABELS[t], t)));
      select.value = s.weekly[i];
      select.addEventListener("change", () => { s.weekly[i] = select.value; touchSchedule(); renderPlan(); renderHome(); });
      return h("div", {class: "field"}, h("label", {for: id, text: day}), select);
    }));
  }
  $("shiftMinutes").value = s.minutes;
  $("shiftAutoPos").checked = !!s.autoPos;
  $("shiftClear").hidden = !Object.keys(s.overrides).length;
  renderShiftCalendar();
  const plan = planSettings(), end = plan.b2, counts = {normal: 0, plantao: 0, pos: 0, folga: 0};
  for (let key = dateKey(), i = 0; key < end && i < 7300; key = shiftKey(key, 1), i++) counts[dayType(key)]++;
  const total = Object.values(counts).reduce((a, b) => a + b, 0), equivalent = Math.round(studyWeightUntil(end));
  $("shiftSummary").textContent = s.mode === "none" && s.weeklyShifts > 0 && total
    ? "Sem escala fixa: nos dias não marcados, o plano supõe em média " + String(s.weeklyShifts).replace(".", ",") + (s.weeklyShifts <= 1 ? " plantão" : " plantões") + " por semana"
      + (s.autoPos ? ", cada um seguido de pós-plantão" : "") + ". Até o certificado B2, os " + total + " dias equivalem a " + equivalent + " dias comuns de frases novas."
    : scheduleActive() && total
    ? "Até o certificado B2: " + counts.plantao + " plantões, " + counts.pos + " pós-plantões, " + counts.folga + " folgas e " + counts.normal + " dias comuns. "
      + "O plano conta só os dias em que entram frases novas: equivalem a " + equivalent + " dias comuns."
    : "Sem escala: todos os dias têm a mesma carga. Informe a média de plantões por semana, escolha um padrão ou clique nos dias do calendário.";
}
function bindScheduleEvents() {
  $("shiftMode").addEventListener("change", e => {
    const s = schedule(), v = e.target.value;
    if (SHIFT_PRESETS[v]) { s.mode = "cycle"; s.preset = v; if (!s.cycleStart) s.cycleStart = dateKey(); }
    else s.mode = v;
    touchSchedule(); renderPlan(); renderHome();
  });
  $("shiftCycleStart").addEventListener("change", e => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
    schedule().cycleStart = e.target.value;
    touchSchedule(); renderPlan(); renderHome();
  });
  $("shiftMinutes").addEventListener("change", e => {
    schedule().minutes = Math.min(30, Math.max(5, Math.round(Number(e.target.value) || 10)));
    touchSchedule(); renderPlan(); renderHome();
  });
  $("shiftAvg").addEventListener("change", e => {
    schedule().weeklyShifts = Math.min(7, Math.max(0, Math.round((Number(String(e.target.value).replace(",", ".")) || 0) * 2) / 2));
    touchSchedule(); renderPlan(); renderHome();
  });
  $("shiftAutoPos").addEventListener("change", e => { schedule().autoPos = e.target.checked; touchSchedule(); renderPlan(); renderHome(); });
  $("shiftClear").addEventListener("click", () => { schedule().overrides = {}; touchSchedule(); renderPlan(); renderHome(); setStatus("Marcações manuais removidas; vale só a escala.", "success"); });
}
