"use strict";
/* Monólogo 4/3/2 (técnica de fluência): o mesmo relato três vezes, com cada vez menos tempo.
   Mede, pelo volume do microfone, pausas e tempo falando; o Whisper transcreve cada rodada (em segundo plano,
   enquanto a próxima já começa) para contar palavras por minuto; no fim, a IA local aponta os erros e dá uma dica.
   Histórico em progress.practice.f432. Carregado antes de app.js; usa funções de app.js, conversa.js e minhas.js. */

const F432_MODES = {curto: [120, 90, 60], classico: [240, 180, 120]};
const F432_PAUSE_MS = 1000;
const f432 = {topic: null, rounds: [], i: -1, rec: null, token: 0, questions: [], durations: null, feedback: null};

function f432Data() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.f432 || (progress.practice.f432 = {sessions: []});
}
function sanitizeF432(src) {
  const out = {sessions: []};
  if (!src || !Array.isArray(src.sessions)) return out;
  const num = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  out.sessions = src.sessions.filter(s => s && Number(s.at) > 0 && Array.isArray(s.rounds))
    .map(s => ({at: Number(s.at), topic: String(s.topic || "").slice(0, 40),
      rounds: s.rounds.slice(0, 3).map(r => ({secs: num(r.secs, 600), words: num(r.words, 5000), pauses: num(r.pauses, 500), longest: num(r.longest, 600000), speaking: num(r.speaking, 100)}))}))
    .sort((a, b) => a.at - b.at).slice(-200);
  return out;
}
function mergeF432(local, incoming) {
  const out = sanitizeF432(local), seen = new Set(out.sessions.map(s => s.at));
  for (const s of sanitizeF432(incoming).sessions) if (!seen.has(s.at)) out.sessions.push(s);
  out.sessions.sort((a, b) => a.at - b.at);
  out.sessions = out.sessions.slice(-200);
  return out;
}
function f432Wpm(r) { return r && r.secs ? Math.round(r.words / (r.secs / 60)) : 0; }
function f432Words(text) { return String(text || "").split(/\s+/).filter(w => /\p{L}/u.test(w)).length; }

// ---------- Tela inicial (dentro da Conversa) ----------
function f432SetupNode() {
  const topics = CONV_TOPICS.filter(t => !t.role && t.id !== "frei");
  const select = h("select", {"aria-label": "Tema do relato"}, ...topics.map(t => h("option", {value: t.id}, t.pt)));
  const mode = h("select", {"aria-label": "Duração das rodadas"}, h("option", {value: "curto"}, "2 · 1,5 · 1 min (recomendado no início)"), h("option", {value: "classico"}, "4 · 3 · 2 min (clássico)"));
  mode.value = F432_MODES[settings.f432Mode] ? settings.f432Mode : "curto";
  mode.addEventListener("change", () => { settings.f432Mode = mode.value; saveSettings(); });
  const hist = f432Data().sessions.slice(-8);
  return h("section", {class: "panel f432-setup"},
    h("h2", {text: "Monólogo 4/3/2"}),
    h("p", {class: "muted small-text", text: "Conte a mesma coisa três vezes, cada vez com menos tempo. Como o conteúdo já está pronto na cabeça, cada rodada sai mais solta: é um dos exercícios mais eficazes para ganhar fluência. O app mede palavras por minuto e pausas; no fim, a IA mostra os erros."}),
    h("div", {class: "row"}, select, mode, h("button", {class: "primary", type: "button", disabled: !speechAvailable(), onclick: () => f432Start(select.value)}, "Começar")),
    !speechAvailable() ? h("p", {class: "muted small-text", text: "Precisa do microfone e da conferência de fala (Whisper)."}) : null,
    hist.length ? h("div", {class: "f432-hist"}, h("span", {class: "muted small-text", text: "Última rodada de cada treino (palavras por minuto):"}),
      h("div", {class: "f432-spark"}, ...hist.map(s => {
        const last = s.rounds[s.rounds.length - 1], w = f432Wpm(last), bar = h("i");
        bar.style.height = Math.max(4, Math.min(100, w)) + "%";
        return h("span", {title: new Date(s.at).toLocaleDateString("pt-BR") + ": " + w + " palavras/min, " + (last ? last.pauses : 0) + " pausas"}, bar, h("small", {text: String(w)}));
      }))) : null);
}

// ---------- Rodadas ----------
async function f432Start(topicId) {
  const topic = CONV_TOPICS.find(t => t.id === topicId);
  if (!topic) return;
  Object.assign(f432, {topic, rounds: [], i: -1, token: f432.token + 1, questions: [], feedback: null,
    durations: f432.durations || F432_MODES[settings.f432Mode] || F432_MODES.curto});
  $("convSetup").hidden = true;
  $("f432Room").hidden = false;
  f432Render();
  window.scrollTo({top: 0});
  const token = f432.token;
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: `Luiz (German level ${convLevel()}) will speak alone for a few minutes about the topic below. Give 5 short, simple guiding questions in German at his level (use "du"), each with a Brazilian Portuguese translation. Answer as JSON.`},
      {role: "user", content: "Topic: " + topic.de}], {kind: "hint", temperature: .5, maxTokens: 500, schema: {type: "object", properties: {dicas: {type: "array", maxItems: 5, items: {type: "object", properties: {de: {type: "string"}, pt: {type: "string"}}, required: ["de", "pt"]}}}, required: ["dicas"]}});
    const j = parseLooseJson(r.text);
    if (token === f432.token && j && Array.isArray(j.dicas)) { f432.questions = j.dicas.filter(d => d && d.de).map(d => ({de: convClean(d.de), pt: convClean(d.pt)})); f432Render(); }
  } catch (e) { /* sem perguntas-guia: segue só com o tema */ }
}
function f432Render() {
  const t = f432.topic, i = f432.i, running = f432.rec && !f432.rec.stopped;
  const roundBox = (r, k) => h("div", {class: "f432-round" + (k === i && running ? " live" : "")},
    h("b", {text: (k + 1) + "ª rodada · " + formatDuration(f432.durations[k])}),
    r ? h("span", {class: "small-text", text: r.pending ? "transcrevendo…" : f432Wpm(r) + " palavras/min · " + r.pauses + (r.pauses === 1 ? " pausa" : " pausas") + " · falando " + r.speaking + "% do tempo"}) : h("span", {class: "muted small-text", text: "—"}));
  const next = f432.rounds.length < 3 && !running;
  fill($("f432Room"),
    h("div", {class: "panel scene-head"},
      h("button", {class: "quiet small", type: "button", onclick: f432Close}, "← Voltar"),
      h("h2", {text: "Monólogo 4/3/2: " + t.pt}),
      h("p", {class: "muted", text: "Fale sobre o tema em alemão, sem parar para corrigir. Nas próximas rodadas, conte a mesma coisa, mais rápido."}),
      f432.questions.length ? h("ul", {class: "f432-q"}, ...f432.questions.map(q => h("li", null, h("span", {lang: "de", text: q.de}), h("small", {class: "muted", text: " " + q.pt})))) : null),
    !running && !next ? null : h("div", {class: "panel f432-live"},
      running ? h("div", {class: "timer", id: "f432Timer", text: "0:00"}) : null,
      running ? h("p", {class: "muted small-text", id: "f432Hint", text: "Gravando… Continue falando até o tempo acabar."}) : null,
      h("div", {class: "row center"},
        running ? h("button", {class: "primary lg", type: "button", onclick: () => f432.rec.stop()}, "Terminar a rodada") : null,
        next ? h("button", {class: "primary lg", type: "button", onclick: f432Round}, f432.rounds.length ? "Começar a " + (f432.rounds.length + 1) + "ª rodada" : "Começar a 1ª rodada") : null)),
    h("div", {class: "f432-rounds"}, ...[0, 1, 2].map(k => roundBox(f432.rounds[k], k))),
    h("div", {id: "f432Feedback"}));
  if (f432.feedback) f432RenderFeedback();
}
async function f432Round() {
  const k = f432.rounds.length, secs = f432.durations[k], token = f432.token;
  stopAudio();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); }
  catch (e) { setStatus("Acesso ao microfone negado ou indisponível.", "error"); return; }
  const ctx = new AudioContext(), analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize), mr = new MediaRecorder(stream), chunks = [];
  const stat = {noise: 0, n: 0, spoke: false, loudMs: 0, silentSince: 0, pauses: 0, longest: 0, t0: Date.now()};
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); resolveDone(new Blob(chunks, {type: mr.mimeType || "audio/webm"})); };
  let timer = null;
  const rec = {stopped: false, stop() { if (rec.stopped) return; rec.stopped = true; clearInterval(timer); if (mr.state === "recording") mr.stop(); }};
  f432.rec = rec;
  f432.i = k;
  mr.start();
  convBeep();
  f432Render();
  let last = Date.now();
  timer = setInterval(() => {
    const now = Date.now(), dt = now - last;
    last = now;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    if (now - stat.t0 < 300) { stat.noise += rms; stat.n++; }
    else {
      const loud = rms > Math.max(.012, stat.noise / Math.max(1, stat.n) * 3);
      if (loud) {
        if (stat.spoke && stat.silentSince && now - stat.silentSince >= F432_PAUSE_MS) { stat.pauses++; stat.longest = Math.max(stat.longest, now - stat.silentSince); }
        stat.spoke = true; stat.silentSince = 0; stat.loudMs += dt;
      } else if (stat.spoke && !stat.silentSince) stat.silentSince = now;
    }
    const left = Math.max(0, secs * 1000 - (now - stat.t0));
    const el = document.getElementById("f432Timer");
    if (el) el.textContent = Math.floor(left / 60000) + ":" + String(Math.floor(left / 1000) % 60).padStart(2, "0");
    if (!left) rec.stop();
  }, 50);
  const blob = await done;
  if (token !== f432.token) return;
  const elapsed = Math.max(1, (Date.now() - stat.t0) / 1000);
  const round = {secs: Math.round(elapsed), words: 0, text: "", pauses: stat.pauses, longest: stat.longest, speaking: Math.round(Math.min(100, stat.loudMs / (elapsed * 1000) * 100)), pending: true};
  f432.rounds[k] = round;
  f432.rec = null;
  f432Render();
  convBeep();
  try { round.text = await transcribeBlob(blob, true); } catch (e) { setStatus("Não foi possível transcrever a rodada: " + e.message, "error"); }
  if (token !== f432.token) return;
  round.words = f432Words(round.text);
  round.pending = false;
  f432Render();
  if (f432.rounds.length === 3 && f432.rounds.every(r => !r.pending)) f432Finish();
}
async function f432Finish() {
  const token = f432.token;
  const data = f432Data();
  data.sessions.push({at: Date.now(), topic: f432.topic.id, rounds: f432.rounds.map(r => ({secs: r.secs, words: r.words, pauses: r.pauses, longest: r.longest, speaking: r.speaking}))});
  data.sessions = data.sessions.slice(-200);
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  f432.feedback = {loading: true};
  f432RenderFeedback();
  let j = null;
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: `You are a German teacher for Luiz, a Brazilian learner (level ${convLevel()}). He told the same story three times, each time with less time (4/3/2 fluency technique). Below are the transcripts (transcribed speech: ignore capitalization and punctuation). Focus on round 3. ${CONV_ERROR_RULES} At most 5 errors and 3 style notes, only the most important; empty lists if there is nothing. Then: elogio (one short encouraging sentence in Brazilian Portuguese, mentioning a concrete improvement between the rounds if there is one), dica (one concrete tip in Brazilian Portuguese for the next time) and frases (up to 3 useful correct German sentences based on what he wanted to say). Answer as JSON.`},
      {role: "user", content: f432.rounds.map((r, k) => "Round " + (k + 1) + ": " + (r.text || "(nothing understood)")).join("\n\n")}],
      {kind: "summary", temperature: .2, maxTokens: 1200, schema: {...CONV_SUMMARY_SCHEMA, properties: {...CONV_SUMMARY_SCHEMA.properties, dica: {type: "string"}}}});
    j = parseLooseJson(r.text);
  } catch (e) { setStatus("Não consegui montar o retorno: " + cleanIpcError(e, "erro"), "error"); }
  if (token !== f432.token) return;
  f432.feedback = {...convFeedback(j), dica: j ? convClean(j.dica) : ""};
  const s = data.sessions[data.sessions.length - 1];
  if (s) { s.errors = f432.feedback.errors.length; saveProgress(); }
  f432RenderFeedback();
}
function f432LineWith(part) {
  const norm = x => String(x || "").toLowerCase().replace(/[.,!?;:"“”„]/g, "").replace(/\s+/g, " ").trim(), p = norm(part);
  for (const r of f432.rounds.slice().reverse()) {
    const sentences = String(r.text || "").split(/(?<=[.!?])\s+/);
    const hit = p && sentences.find(x => norm(x).includes(p));
    if (hit) return hit;
  }
  return "";
}
function f432RenderFeedback() {
  const box = document.getElementById("f432Feedback"), fb = f432.feedback;
  if (!box || !fb) return;
  if (fb.loading) { fill(box, h("p", {class: "panel muted", text: "Preparando o retorno das três rodadas…"})); return; }
  const w = f432.rounds.map(f432Wpm), p = f432.rounds.map(r => r.pauses);
  const trend = w[2] > w[0] ? "Você foi de " + w[0] + " para " + w[2] + " palavras por minuto" + (p[2] < p[0] ? " e de " + p[0] + " para " + p[2] + " pausas" : "") + "." : "";
  fill(box, h("section", {class: "panel summary"},
    h("h3", {text: "Retorno"}),
    trend ? h("p", {text: trend}) : null,
    fb.elogio ? h("p", {text: fb.elogio}) : null,
    fb.dica ? h("p", {class: "notice", text: "Dica para a próxima vez: " + fb.dica}) : null,
    h("h4", {text: fb.errors.length ? "Os erros mais importantes" : "Nenhum erro importante encontrado"}),
    fb.errors.length ? h("ul", {class: "conv-errors"}, ...fb.errors.map(e => h("li", null,
      h("p", null, h("s", {lang: "de", text: e.errado}), " → ", h("b", {lang: "de", text: e.certo}),
        h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a forma correta", onclick: () => convSpeak(e.certo)}, icon("volume", 16)),
        convCardButton({erro: {...e, frase: f432LineWith(e.errado)}})),
      h("p", {class: "muted small-text", text: e.explicacao})))) : null,
    ...convStyleList(fb.style || []),
    fb.frases.length ? h("h4", {text: "Frases para praticar"}) : null,
    fb.frases.length ? h("ul", {class: "conv-errors"}, ...fb.frases.map(f => h("li", null, h("p", null, h("span", {lang: "de", text: f}),
      h("button", {class: "icon-btn quiet", type: "button", title: "Ouvir", "aria-label": "Ouvir a frase", onclick: () => convSpeak(f)}, icon("volume", 16)), convCardButton({frase: f}))))) : null,
    h("details", null, h("summary", {text: "Ver o que o app entendeu em cada rodada"}),
      ...f432.rounds.map((r, k) => h("p", {class: "small-text"}, h("b", {text: (k + 1) + "ª: "}), h("span", {lang: "de", text: r.text || "(nada)"})))),
    h("p", {class: "muted small-text", text: "Palavras por minuto contam o que o app transcreveu; as pausas são silêncios de 1 s ou mais. As correções são automáticas: confira as dúvidas com o tutor."}),
    h("div", {class: "row"}, h("button", {class: "primary", type: "button", onclick: () => f432Start(f432.topic.id)}, "Repetir com este tema"), h("button", {type: "button", onclick: f432Close}, "Outro tema"))));
}
function f432Close() {
  if (f432.rec) f432.rec.stop();
  f432.token++;
  // Zera as durações para o próximo monólogo seguir o modo escolhido (curto ou clássico).
  f432.topic = null; f432.rounds = []; f432.rec = null; f432.feedback = null; f432.durations = null;
  $("f432Room").hidden = true;
  $("convSetup").hidden = false;
  renderConvSetup();
}
