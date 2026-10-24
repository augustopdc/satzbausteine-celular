/* Pronúncia, rodada 2 (24/10/2026): “Modelo × você”. Você ouve o modelo, fala, e o app toca os dois em seguida,
   desenha as duas ondas lado a lado e mede por REGRA (nada de IA) três coisas que fazem o paciente não entender:
   - sopro do p/t/k no começo (VOT: do estouro da consoante até a voz começar; alemão ~50–90 ms, português ~10–30 ms);
   - vogal a mais no fim (“Herd-i”): o modelo termina em som sem voz e você termina vibrando, com um trecho de voz a mais;
   - vogal longa × curta (grupo “Vogal longa × curta”): fatia da palavra ocupada pela vogal, comparada com a do modelo.
   As medidas são aproximadas (microfone, sala): servem para “vale ouvir de novo”, não para nota. A sua professora é a
   régua: em “Conferir com a professora” ela marca certo/errado e o limiar do sopro se ajusta às marcações dela.
   Gravações ficam só neste computador (IndexedDB “satz-gravacoes”: a primeira e a última de cada palavra). */

// ---------- Análise (pura: amostras mono a 16 kHz) ----------
const PV_SR = 16000, PV_HOP = 80, PV_WIN = 400; // 5 ms e 25 ms
function pvFrames(x) {
  const out = [];
  for (let s = 0; s + PV_WIN <= x.length; s += PV_HOP) {
    let e = 0;
    for (let i = s; i < s + PV_WIN; i++) e += x[i] * x[i];
    out.push({db: 10 * Math.log10(e / PV_WIN + 1e-12), r: pvPeriodicity(x, s)});
  }
  return out;
}
/* Autocorrelação normalizada entre 75 e 400 Hz: perto de 1 = voz vibrando (vogal, m, n, l); baixo = ruído (s, sopro, t). */
function pvPeriodicity(x, s) {
  let best = 0;
  for (let lag = 40; lag <= 213; lag++) {
    let xy = 0, xx = 0, yy = 0;
    for (let i = s; i < s + PV_WIN - lag; i++) { const a = x[i], b = x[i + lag]; xy += a * b; xx += a * a; yy += b * b; }
    const r = xx && yy ? xy / Math.sqrt(xx * yy) : 0;
    if (r > best) best = r;
  }
  return best;
}
/* Fala = quadros acima do ruído de fundo; voz = periódico e com energia. Trechos de voz de 40 ms ou mais. */
function pvAnalyze(x) {
  const f = pvFrames(x);
  if (!f.length) return null;
  const sorted = f.map(q => q.db).sort((a, b) => a - b), floor = sorted[Math.floor(sorted.length * .1)], peak = sorted[sorted.length - 1];
  const thr = Math.max(floor + 12, peak - 40);
  const speech = f.map(q => q.db > thr), start = speech.indexOf(true), end = speech.lastIndexOf(true);
  if (start < 0 || end - start < 8) return null;
  const voiced = f.map((q, k) => k >= start && k <= end && q.r > .6 && q.db > peak - 35);
  const segs = [];
  for (let k = start; k <= end; k++) {
    if (!voiced[k]) continue;
    const last = segs[segs.length - 1];
    if (last && k - last.b <= 3) last.b = k; else segs.push({a: k, b: k});
  }
  const real = segs.filter(s => s.b - s.a + 1 >= 8);
  const ms = n => n * PV_HOP / PV_SR * 1000;
  const firstVoice = real.length ? real[0].a : -1;
  let tail = 0;
  for (let k = end; k >= start && !voiced[k]; k--) tail++;
  // Vogal tônica: a maior sequência de quadros com voz a até 6 dB do pico de voz. Testado nos 8 pares de vogal longa ×
  // curta em 4 vozes: aponta a longa em 27 de 32 (84%), comparando a mesma voz. Por isso só informa, sem veredito.
  let vowel = null;
  if (real.length) {
    const vPeak = Math.max(...real.flatMap(s => f.slice(s.a, s.b + 1).map(q => q.db)));
    let best = 0, run = 0;
    for (let k = start; k <= end; k++) { if (voiced[k] && f[k].db > vPeak - 6) { run++; best = Math.max(best, run); } else run = 0; }
    vowel = {ms: ms(best), share: best / (end - start + 1)};
  }
  return {dur: ms(end - start + 1), segs: real.length, vot: firstVoice >= 0 ? ms(firstVoice - start) : null, tail: ms(tail), vowel,
    env: f.map(q => Math.max(0, Math.min(1, (q.db - floor) / Math.max(1, peak - floor)))), start, end};
}
const PV_VOT_DEFAULT = 40;
function pvVotLimit() { return Number(((progress.practice || {}).pronCal || {}).vot) || PV_VOT_DEFAULT; }
/* O que medir em cada palavra: sopro se começa com p/t/k (fora pf, ps, ts, tsch); fim se o modelo termina sem voz;
   vogal só no grupo de vogal longa × curta (lado a = longa, b = curta). */
function pvChecks(word, groupId, side) {
  const w = word.toLocaleLowerCase("de");
  return {vot: /^(p(?![fs])|t(?!s)|k)/.test(w), fim: /[bcdfgkpqstxzß]$/.test(w) || /(ch|ck|tz|nd|nt)$/.test(w), vogal: groupId === "laenge" ? (side === "a" ? "longa" : "curta") : null};
}
function pvCompare(word, groupId, side, model, me, vot = PV_VOT_DEFAULT) {
  const out = [], c = pvChecks(word, groupId, side), r = Math.round;
  if (!model || !me) return out;
  if (c.vot && me.vot != null) {
    const m = model.vot != null ? " (modelo " + r(model.vot) + " ms)" : "";
    if (me.vot >= vot) out.push({k: "vot", ok: true, label: "Com sopro: " + r(me.vot) + " ms" + m});
    else if (me.vot >= vot * .6) out.push({k: "vot", ok: null, label: "Sopro fraco: " + r(me.vot) + " ms" + m});
    else out.push({k: "vot", ok: false, label: "Sem sopro: soa como b, d ou g (" + r(me.vot) + " ms" + m + ")"});
  }
  // Fim: o modelo termina sem voz (t, s, k…). Comparado com o fim do modelo (não com um número fixo, porque um respiro
  // depois da vogal também conta como “sem voz”): bem menos tempo sem voz que o modelo + um trecho de voz a mais = saiu
  // uma vogal; quase nada sem voz = aviso. Medido nos áudios do Otto: Tablett 290 ms e Herd 205 ms sem voz no fim;
  // Tablette e Herde, 85–100 ms (o respiro do ElevenLabs).
  if (c.fim && model.tail >= 30) {
    const voicedEnd = me.tail < Math.min(40, model.tail * .3), extra = me.tail < model.tail * .5 && me.segs > model.segs;
    out.push({k: "fim", ok: extra ? false : voicedEnd ? null : true,
      label: extra ? "Parece que saiu uma vogal no fim" : voicedEnd ? "Terminou com a voz vibrando: confira se não saiu um “i” no fim" : "Terminou na consoante"});
  }
  // Vogal longa × curta: só informa (a medida não é firme o bastante para dizer certo ou errado).
  if (c.vogal && model.vowel && me.vowel)
    out.push({k: "vogal", ok: null, label: "Vogal " + c.vogal + ": a sua durou " + r(me.vowel.ms) + " ms; a do modelo, " + r(model.vowel.ms) + " ms"});
  return out;
}
/* Calibração com a professora: o limiar do sopro que mais concorda com as marcações dela (só palavras com p/t/k). */
function pvCalibrate(rows) {
  const use = rows.filter(x => x.vot != null && (x.prof === "certo" || x.prof === "errado"));
  if (use.length < 6) return null;
  let best = {vot: PV_VOT_DEFAULT, agree: -1};
  for (let t = 20; t <= 70; t += 5) {
    const agree = use.filter(x => (x.vot >= t) === (x.prof === "certo")).length;
    if (agree > best.agree || (agree === best.agree && Math.abs(t - PV_VOT_DEFAULT) < Math.abs(best.vot - PV_VOT_DEFAULT))) best = {vot: t, agree};
  }
  return {vot: best.vot, agree: best.agree, n: use.length};
}
function sanitizePronCal(src) {
  const vot = Math.round(Number(src && src.vot)), n = Math.round(Number(src && src.n));
  return vot >= 15 && vot <= 80 && n > 0 ? {vot, n, at: Number(src.at) || 0} : null;
}
function mergePronCal(local, incoming) {
  const a = sanitizePronCal(local), b = sanitizePronCal(incoming);
  return !a ? b : !b ? a : b.n > a.n || (b.n === a.n && b.at > a.at) ? b : a;
}

// ---------- Áudio ----------
async function pvDecode(buf) {
  const ctx = new AudioContext();
  let audio;
  try { audio = await ctx.decodeAudioData(buf); } finally { ctx.close(); }
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * PV_SR)), PV_SR), src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}
/* Grava até você parar de falar: mede o ruído por 250 ms, começa quando o volume passa de 3× o ruído e para depois de
   0,7 s de silêncio (ou 4 s no total). Sem cancelamento de eco nem ganho automático, para não deformar o som. */
async function pvRecord(onState) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}}); }
  catch (e) { setStatus("Acesso ao microfone negado ou indisponível. Verifique o microfone nas configurações de privacidade do Windows.", "error"); return null; }
  const ctx = new AudioContext(), an = ctx.createAnalyser(), buf = new Float32Array(1024);
  an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const mr = new MediaRecorder(stream), chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(r => { mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); ctx.close(); r(new Blob(chunks, {type: mr.mimeType || "audio/webm"})); }; });
  mr.start();
  const t0 = performance.now();
  let noise = 0, nN = 0, spoke = false, lastLoud = 0;
  const level = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); };
  await new Promise(resolve => {
    const tick = () => {
      const now = performance.now() - t0, v = level();
      if (now < 250) { noise += v; nN++; }
      else {
        const loud = v > Math.max(.004, 3 * noise / Math.max(1, nN));
        if (loud) { if (!spoke && onState) onState("fala"); spoke = true; lastLoud = now; }
        if ((spoke && now - lastLoud > 700) || now > 4000) { resolve(); return; }
      }
      setTimeout(tick, 30);
    };
    tick();
  });
  if (mr.state === "recording") mr.stop();
  const blob = await done;
  return spoke ? blob : null;
}
function pvPlay(src) {
  return new Promise(resolve => {
    stopAudio();
    const a = new Audio(src);
    audioPlayer = a;
    const end = () => resolve();
    a.onended = end; a.onerror = end; a.onpause = end;
    a.play().catch(end);
    setTimeout(end, 6000);
  });
}

// ---------- Gravações (só neste computador) ----------
function pvDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("satz-gravacoes", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("words", {keyPath: "key"});
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function pvStore(mode, value) {
  try {
    const db = await pvDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("words", mode === "get" || mode === "all" ? "readonly" : "readwrite"), st = tx.objectStore("words");
      const req = mode === "get" ? st.get(value) : mode === "all" ? st.getAll() : st.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return mode === "all" ? [] : null; }
}

// ---------- Tela ----------
function pvModelVoice() { return typeof PRON_MODEL_VOICE !== "undefined" ? PRON_MODEL_VOICE : "katja"; }
const pv = {busy: false, model: new Map()};
function pvWave(env, cls, scale) {
  const c = h("canvas", {class: "pv-wave " + cls, width: 600, height: 56, "aria-hidden": "true"});
  requestAnimationFrame(() => {
    const g = c.getContext("2d"), css = getComputedStyle(document.documentElement);
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = css.getPropertyValue(cls === "me" ? "--warn" : "--accent").trim() || "#0b6e63";
    const n = env.length, w = Math.max(1, c.width * Math.min(1, n / scale) / Math.max(1, n));
    env.forEach((v, k) => { const hgt = Math.max(1, v * (c.height - 4)); g.fillRect(k * w, (c.height - hgt) / 2, Math.max(1, w - .5), hgt); });
  });
  return c;
}
async function pvModel(g, pair, side) {
  const url = pronUrl(g.id, pair, side, pvModelVoice()), key = url;
  if (!pv.model.has(key)) {
    const buf = await (await fetch(url)).arrayBuffer();
    pv.model.set(key, pvAnalyze(await pvDecode(buf)));
  }
  return pv.model.get(key);
}
/* Fluxo: modelo → você fala → modelo e você em seguida, com as ondas e as medidas. */
async function pvTry(groupId, pair, side) {
  if (pv.busy) return;
  const g = PRON.find(x => x.id === groupId), word = g.pairs[pair][side === "a" ? 0 : 1], box = $("pvPanel");
  if (!box) return;
  pv.busy = true;
  box.hidden = false;
  const say = (t, cls = "") => fill(box, h("p", {class: "pv-step " + cls}, t, " ", h("b", {lang: "de", text: word})));
  try {
    say("Ouça o modelo:");
    await pvPlay(pronUrl(g.id, pair, side, pvModelVoice()));
    say("Agora você. Fale:", "rec");
    const blob = await pvRecord(st => { if (st === "fala") say("Gravando:", "rec on"); });
    if (!blob) { fill(box, h("p", {class: "muted", text: "Não ouvi nada. Fale mais perto do microfone e tente de novo."}), pvAgain(groupId, pair, side)); return; }
    say("Medindo…");
    const [model, me] = await Promise.all([pvModel(g, pair, side), blob.arrayBuffer().then(pvDecode).then(pvAnalyze)]);
    const checks = pvCompare(word, g.id, side, model, me, pvVotLimit());
    const key = g.id + "|" + word, old = await pvStore("get", key), now = Date.now();
    const meas = {vot: me ? me.vot : null, checks: checks.map(c => ({k: c.k, ok: c.ok}))};
    const rec = {key, word, group: g.id, pair, side, first: old ? old.first : {blob, at: now, ...meas}, last: {blob, at: now, ...meas}, prof: null};
    await pvStore("put", rec);
    const myUrl = URL.createObjectURL(blob), firstUrl = old ? URL.createObjectURL(old.first.blob) : null;
    const scale = Math.max(model ? model.env.length : 1, me ? me.env.length : 1);
    fill(box,
      h("p", {class: "pv-step"}, "Modelo × você: ", h("b", {lang: "de", text: word})),
      h("div", {class: "pv-waves"},
        h("div", {class: "pv-track"}, h("span", {class: "pv-who", text: "Modelo"}), model ? pvWave(model.env, "model", scale) : null),
        h("div", {class: "pv-track"}, h("span", {class: "pv-who", text: "Você"}), me ? pvWave(me.env, "me", scale) : h("span", {class: "muted small-text", text: "Gravação curta demais para medir."}))),
      checks.length ? h("ul", {class: "pv-checks"}, ...checks.map(c => h("li", {class: c.ok === true ? "ok" : c.ok === false ? "no" : "meh"},
        h("span", {class: "pv-dot", "aria-hidden": "true"}), c.label))) : h("p", {class: "muted small-text", text: "Nesta palavra não há o que medir por regra: compare de ouvido."}),
      h("div", {class: "row"},
        h("button", {class: "small", type: "button", onclick: () => pvPlay(pronUrl(g.id, pair, side, pvModelVoice()))}, icon("volume", 16), "Modelo"),
        h("button", {class: "small", type: "button", onclick: () => pvPlay(myUrl)}, icon("volume", 16), "Você"),
        h("button", {class: "small", type: "button", onclick: async () => { await pvPlay(pronUrl(g.id, pair, side, pvModelVoice())); await pvPlay(myUrl); }}, "Os dois"),
        firstUrl && old.first.at < now - 60000 ? h("button", {class: "small", type: "button", onclick: async () => { await pvPlay(firstUrl); await pvPlay(myUrl); }}, "Antes × agora") : null,
        pvAgain(groupId, pair, side)),
      h("p", {class: "muted small-text", text: "Medida aproximada: use como pista para ouvir de novo. Quem decide é o seu ouvido e a sua professora."}));
    await pvPlay(pronUrl(g.id, pair, side, pvModelVoice()));
    await pvPlay(myUrl);
  } finally { pv.busy = false; }
}
function pvAgain(groupId, pair, side) {
  return h("button", {class: "primary small", type: "button", onclick: () => pvTry(groupId, pair, side)}, icon("mic", 16), "Gravar de novo");
}
/* Conferir com a professora: as últimas gravações, o que o app mediu e o que ela disse. */
async function pvTeacher() {
  const rows = (await pvStore("all")).sort((a, b) => b.last.at - a.last.at).slice(0, 30);
  $("pronList").hidden = true;
  $("pronPlayer").hidden = false;
  const appOk = r => !r.last.checks.some(c => c.ok === false);
  const labeled = rows.filter(r => r.prof), agree = labeled.filter(r => appOk(r) === (r.prof === "certo")).length;
  const cal = pvCalibrate(rows.map(r => ({vot: pvChecks(r.word, r.group, r.side).vot ? r.last.vot : null, prof: r.prof})));
  const mark = async (r, v) => { r.prof = r.prof === v ? null : v; await pvStore("put", r); pvTeacher(); };
  fill($("pronPlayer"),
    h("button", {class: "quiet small", type: "button", onclick: () => { stopAudio(); renderPron(); }}, "← Todos os sons"),
    h("h2", {text: "Conferir com a professora"}),
    h("p", {class: "lede", text: "Na aula, toque cada gravação e peça para ela dizer se a palavra saiu certa. O app compara com o que ele mediu e ajusta o limiar do sopro do p/t/k às marcações dela."}),
    labeled.length ? h("p", {class: "pv-agree"}, h("b", {text: "O app concordou com ela em " + agree + " de " + labeled.length}),
      cal ? " · limiar do sopro: " + cal.vot + " ms (" + cal.agree + " de " + cal.n + " palavras com p/t/k)" : " · marque pelo menos 6 palavras com p/t/k para ajustar o sopro") : null,
    cal && cal.vot !== pvVotLimit() ? h("button", {class: "primary small", type: "button", onclick: () => {
      progress.practice.pronCal = {vot: cal.vot, n: cal.n, at: Date.now()}; saveProgress(); setStatus("Limiar do sopro ajustado para " + cal.vot + " ms.", "success"); pvTeacher(); }}, "Usar " + cal.vot + " ms") : null,
    rows.length ? h("div", {class: "pv-list"}, ...rows.map(r => h("div", {class: "pv-item"},
      h("button", {class: "pair-word", type: "button", onclick: () => pvPlay(URL.createObjectURL(r.last.blob))}, icon("volume", 16), h("b", {lang: "de", text: r.word})),
      h("span", {class: "pv-app small-text " + (appOk(r) ? "ok" : "no"), text: appOk(r) ? "App: certo" : "App: " + r.last.checks.filter(c => c.ok === false).map(c => ({vot: "sem sopro", fim: "vogal no fim", vogal: "duração"})[c.k]).join(", ")}),
      h("div", {class: "pv-prof"},
        h("button", {class: "small", type: "button", "aria-pressed": String(r.prof === "certo"), onclick: () => mark(r, "certo")}, "Ela: certo"),
        h("button", {class: "small", type: "button", "aria-pressed": String(r.prof === "errado"), onclick: () => mark(r, "errado")}, "Ela: errado")))))
      : h("p", {class: "muted", text: "Ainda não há gravações. Em “Ouvir e repetir”, toque no microfone ao lado de uma palavra."}));
}
/* Na tela inicial da Pronúncia: atalho para a conferência, quando já existem gravações. */
async function pvHomeExtra(box) {
  const rows = await pvStore("all");
  if (!rows.length || !document.contains(box)) return;
  box.append(h("section", {class: "pron-zone pv-home"},
    h("div", {class: "pv-home-row"}, h("div", null, h("h2", {class: "label", text: "Suas gravações"}),
      h("p", {class: "muted small-text", text: rows.length + (rows.length === 1 ? " palavra gravada" : " palavras gravadas") + " · leve para a aula e confira com a professora."})),
      h("button", {class: "small", type: "button", onclick: pvTeacher}, "Conferir com a professora"))));
}
