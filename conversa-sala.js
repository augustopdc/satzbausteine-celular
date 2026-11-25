/* Sala da Conversa como uma ligação (11/11/2026, pedido do usuário: visual com cara de app pago, “pode improvisar bastante,
   animações etc.”). Em cima, a presença dela (#convStage): avatar com a inicial em letra de livro e, desde 24/11/2026
   (visual de assinatura, etapa 1), um orbe fluido em <canvas> que responde ao espectro real da voz dela (graves abrem o
   orbe, médios deformam lóbulos lentos, agudos das fricativas fazem a borda vibrar), puxa um halo na cor de resposta com o
   seu microfone e respira devagar enquanto ela pensa. Em situação ao telefone com a “linha” ligada, o orbe se achata num
   visor de osciloscópio com a forma de onda dela (sala.morph 0 → 1 em ~260 ms). Cores por pessoa e por modo (salaPalette).
   Um laço de requestAnimationFrame lê o estado da conversa (conv, conv.live, conv.speaker, audioPlayer), desenha e só escreve
   variáveis CSS (--her, --me, --morph) e data-state. Com “reduzir movimento”: um quadro parado, conferido 4 vezes por segundo. */
const sala = {raf: 0, me: 0, her: 0, el: null, cv: null, t0: 0, morph: 0, last: 0, pal: null, freq: null, wbuf: null, staticKey: "", f: null};
const SALA_LABEL = {connecting: "Conectando…", speaking: "{n} fala", listening: "Ouvindo você", thinking: "{n} pensa…", turn: "Sua vez", muted: "Microfone desligado", done: "Conversa encerrada"};
const SALA_WAVE_N = 64;
const SALA_MORPH_MS = 260;

/* Assinatura cromática por pessoa e por modo: a = núcleo, b = meio, c = borda, reply = halo do seu microfone.
   Claro e escuro (no escuro, tons mais luminosos para não afundar no fundo). */
const SALA_PALETTE = {
  gerda: {light: ["#9a6418", "#c98a2e", "#e8c372"], dark: ["#c88a34", "#e0a64a", "#f2d08a"]},
  clinic: {light: ["#0d6b59", "#12806a", "#2a9fb8"], dark: ["#2fae8f", "#3fc7a4", "#5fd0e6"]},
  lotte: {light: ["#a8792a", "#d6a94a", "#c9735a"], dark: ["#d0a24e", "#e6c070", "#e08f74"]},
  kalle: {light: ["#8f4a26", "#b8653a", "#d9482b"], dark: ["#c3743f", "#dc8a54", "#f06a48"]},
  wendt: {light: ["#1f5e4a", "#3e7a63", "#7fa38c"], dark: ["#4f9a7d", "#6fb394", "#a3c7b0"]},
  krimi: {light: ["#2b3d54", "#3d5470", "#9aa6b4"], dark: ["#6d86a6", "#8aa0bd", "#c3ccd6"]},
  accent: {light: ["#0a5f55", "#0b6e63", "#4fae9c"], dark: ["#3fb39e", "#5ccdb8", "#9be3d4"]}
};
const SALA_REPLY = {light: "#c97a12", dark: "#f2b55a"};
function salaPaletteKey(topic) {
  if (!topic) return "accent";
  if (topic.krimi) return "krimi";
  if (topic.innere || topic.patient) return "clinic";
  const id = topic.persona && topic.persona.id;
  if (id === "tarek") return "clinic";
  if (id && SALA_PALETTE[id]) return id;
  return "accent";
}
/* Puro (testado): a paleta de um tema. */
function salaPalette(topic, dark = false) {
  const key = salaPaletteKey(topic), mode = dark ? "dark" : "light", [a, b, c] = SALA_PALETTE[key][mode];
  return {key, a, b, c, reply: SALA_REPLY[mode], ink: "#fcfcfa"};
}
function salaDark() {
  if (typeof document === "undefined" || !document.documentElement) return false;
  const t = document.documentElement.dataset && document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function salaEl() {
  if (sala.el && sala.el.isConnected) return sala.el;
  const chat = $("convChat");
  if (!chat) return null;
  sala.cv = h("canvas", {class: "cv-canvas", width: "160", height: "160", "aria-hidden": "true"});
  sala.el = h("section", {id: "convStage", class: "cv-stage", "data-state": "turn", "aria-live": "polite"},
    h("div", {class: "cv-orb", "aria-hidden": "true"}, sala.cv, h("span", {class: "cv-avatar"}, h("span", {class: "cv-initial"}))),
    h("div", {class: "cv-stage-text"}, h("p", {class: "cv-who"}), h("p", {class: "cv-state"})),
    h("div", {class: "cv-stage-act"}));
  chat.before(sala.el);
  return sala.el;
}
/* Cores do tema (núcleo do avatar e orbe); refeito ao abrir e quando o tema claro/escuro muda. */
function salaApplyPalette(topic = conv.topic) {
  const el = sala.el;
  if (!el) return;
  const dark = salaDark();
  sala.pal = salaPalette(topic, dark);
  sala.pal.dark = dark;
  el.dataset.palette = sala.pal.key;
  el.style.setProperty("--orb-a", sala.pal.a);
  el.style.setProperty("--orb-b", sala.pal.b);
  el.style.setProperty("--orb-c", sala.pal.c);
  el.style.setProperty("--orb-reply", sala.pal.reply);
  sala.staticKey = "";
}
/* Ao abrir uma conversa: nome, cidade (pessoas) e o laço da animação. */
function salaOpen(topic) {
  const el = salaEl();
  if (!el) return;
  const name = convName(topic), p = topic && topic.persona;
  el.querySelector(".cv-initial").textContent = (name.replace(/^Dra?\.\s*/, "")[0] || "?").toUpperCase();
  fill(el.querySelector(".cv-who"), h("b", {text: name}), p && p.city ? h("span", {class: "cv-city", text: p.city}) : topic && topic.krimi && typeof krimiSuspect === "function" ? h("span", {class: "cv-city", text: krimiSuspect(topic.krimi, topic.sid).papelPt})
    : topic && topic.rolePt && topic.rolePt !== name ? h("span", {class: "cv-city", text: topic.rolePt}) : null);
  // Ao telefone: um botão liga e desliga a “linha” na voz dela (conversa.js, convPhoneToggle).
  fill(el.querySelector(".cv-stage-act"), topic && topic.phone ? h("button", {class: "quiet small cv-phone", type: "button", "aria-pressed": String(convPhoneOn(topic)),
    title: "Som de ligação na voz (toque para ligar ou desligar)", onclick: convPhoneToggle}, icon("phone", 16), h("span", {text: "Linha de telefone"})) : null);
  el.hidden = false;
  salaApplyPalette(topic);
  sala.me = 0; sala.her = 0; sala.t0 = performance.now(); sala.last = 0;
  // A linha já ligada abre direto no visor (sem morph na entrada).
  sala.morph = convPhoneOn(topic) ? 1 : 0;
  el.dataset.line = sala.morph ? "on" : "off";
  el.style.setProperty("--morph", String(sala.morph));
  salaSetState(salaState()); // já na abertura (janela escondida não roda o laço)
  salaDraw(performance.now(), salaSynth(0, false), salaState());
  if (!sala.raf) sala.raf = requestAnimationFrame(salaTick);
}
/* Nível do microfone (0–1), vindo da escuta (convListen) ou do ao vivo (liveMic). */
function salaMic(rms) { sala.me = Math.max(sala.me, Math.min(1, rms * 9)); }
function salaState() {
  if (conv.finished) return "done";
  const L = conv.live;
  if (L) {
    if (!L.ready) return "connecting";
    if (L.player.playing()) return "speaking";
    if (L.muted) return "muted";
    if (L.meText || sala.me > .12) return "listening";
    if (L.awaiting) return "thinking";
    return "turn";
  }
  const sp = conv.speaker, ap = typeof audioPlayer !== "undefined" ? audioPlayer : null;
  if ((sp && !sp.finished && sp.playing) || (ap && !ap.paused && !ap.ended && ap.currentTime > 0)) return "speaking";
  if (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking) return "speaking";
  if (conv.clip) return "listening";
  if (conv.busy) return "thinking";
  return "turn";
}
function salaSetState(state) {
  const el = sala.el;
  if (!el) return;
  el.dataset.state = state;
  el.querySelector(".cv-state").textContent = SALA_LABEL[state].replace("{n}", convName());
}

// ---------- Áudio → bandas ----------
const salaClamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
/* Puro (testado): média dos bins de frequência em três faixas (graves das vogais, médios, agudos das fricativas), 0–1. */
function salaBands(freq, sampleRate = 48000, fftSize = 256) {
  const binHz = sampleRate / fftSize, avg = (lo, hi) => {
    const a = Math.max(1, Math.floor(lo / binHz)), b = Math.min(freq.length - 1, Math.ceil(hi / binHz));
    let s = 0, n = 0;
    for (let i = a; i <= b; i++) { s += freq[i]; n++; }
    return n ? s / n / 255 : 0;
  };
  return {low: salaClamp(avg(80, 420) * 1.5), mid: salaClamp(avg(420, 2000) * 1.8), high: salaClamp(avg(2000, 8000) * 2.6)};
}
/* Puro (testado): sem espectro real (voz do sistema, sem Web Audio), um envelope de fala com vários harmônicos defasados
   (sílabas ~4,3 Hz moduladas por frases mais lentas), nunca um seno só; calada, tudo zero. */
function salaSynth(now, speaking) {
  const wave = new Array(SALA_WAVE_N).fill(0);
  if (!speaking) return {rms: 0, low: 0, mid: 0, high: 0, wave};
  const t = now / 1000, TAU = Math.PI * 2;
  const syl = Math.max(0, Math.sin(t * TAU * 4.3 + .7 * Math.sin(t * TAU * .9)));
  const phrase = .62 + .38 * Math.sin(t * TAU * .37 + 1.1) * Math.sin(t * TAU * .23);
  const env = Math.pow(syl, .6) * phrase;
  const low = salaClamp(.3 + .5 * env), mid = salaClamp(.2 + .45 * env * (.55 + .45 * Math.sin(t * TAU * 1.7 + .4)));
  const high = salaClamp(.08 + .4 * env * Math.pow(Math.max(0, Math.sin(t * TAU * 7.1 + 1.3)), 3));
  for (let i = 0; i < SALA_WAVE_N; i++) {
    const x = i / SALA_WAVE_N * TAU;
    wave[i] = env * (.55 * Math.sin(x * 3 + t * 21) + .28 * Math.sin(x * 7 - t * 33 + 1) + .14 * Math.sin(x * 13 + t * 47) * high);
  }
  return {rms: salaClamp(.15 + .55 * env), low, mid, high, wave};
}
/* Um quadro de áudio da voz dela: espectro real do Ao vivo (livePlayer.spectrum) ou da voz tocada pelo app (conv.analyser,
   convAudioTap); voz que não passou pelo analisador (voz do sistema) cai no envelope sintético. */
function salaAudioFrame(now, state) {
  if (state !== "speaking") return salaSynth(now, false);
  const L = conv.live, ap = typeof audioPlayer !== "undefined" ? audioPlayer : null;
  let read = null;
  if (L && L.player && typeof L.player.spectrum === "function") read = (fb, wb) => L.player.spectrum(fb, wb);
  else if (conv.analyser && ap && ap._tapped && !ap.paused) read = (fb, wb) => { conv.analyser.getByteFrequencyData(fb); conv.analyser.getFloatTimeDomainData(wb); return {sampleRate: conv.analyser.context.sampleRate, fftSize: conv.analyser.fftSize}; };
  if (!read || typeof Uint8Array === "undefined") return salaSynth(now, true);
  try {
    const size = L && L.player.spectrum ? 512 : (conv.analyser ? conv.analyser.fftSize : 256);
    if (!sala.freq || sala.freq.length !== size / 2) sala.freq = new Uint8Array(size / 2);
    if (!sala.wbuf || sala.wbuf.length !== size) sala.wbuf = new Float32Array(size);
    const info = read(sala.freq, sala.wbuf) || {sampleRate: 48000, fftSize: size};
    const b = salaBands(sala.freq, info.sampleRate, info.fftSize), wave = new Array(SALA_WAVE_N);
    let s = 0;
    for (let i = 0; i < SALA_WAVE_N; i++) { const v = sala.wbuf[Math.floor(i * sala.wbuf.length / SALA_WAVE_N)] || 0; s += v * v; wave[i] = Math.max(-1, Math.min(1, v * 3.2)); }
    const rms = salaClamp(Math.sqrt(s / SALA_WAVE_N) * 6);
    // Analisador ainda vazio (o áudio acabou de começar): o envelope cobre até o som chegar.
    if (rms < .002 && b.low < .01) return salaSynth(now, true);
    return {rms, ...b, wave};
  } catch (e) { return salaSynth(now, true); }
}

// ---------- Desenho ----------
function salaRgba(hex, a) {
  const n = parseInt(String(hex).slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
}
const salaEase = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
/* Curva fechada suave por pontos (quadráticas pelos pontos médios). */
function salaBlob(g, pts) {
  const n = pts.length;
  g.beginPath();
  let p0 = pts[n - 1], p1 = pts[0];
  g.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  g.closePath();
}
function salaDraw(now, f, state) {
  const cv = sala.cv;
  if (!cv || typeof cv.getContext !== "function") return;
  const g = cv.getContext("2d");
  if (!g) return;
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const w = cv.clientWidth || 96, H = cv.clientHeight || 96, W = Math.round(w * dpr), HH = Math.round(H * dpr);
  if (cv.width !== W || cv.height !== HH) { cv.width = W; cv.height = HH; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, H);
  const P = sala.pal || salaPalette(conv.topic, salaDark()), m = salaEase(sala.morph), t = now / 1000;
  const cx = w / 2, cy = H / 2, R = Math.max(12, (H - 38) / 2), halfW = w / 2 - 16;
  const active = state === "speaking", listening = state === "listening", thinking = state === "thinking" || state === "connecting";
  const quiet = state === "muted" || state === "done";
  // Orbe: três camadas fluidas (some enquanto vira visor).
  if (m < .999) {
    const breathe = thinking ? .5 + .5 * Math.sin(t * Math.PI * 2 / 2.4) : 0;
    const idle = active ? 0 : (quiet ? 0 : .35 + .25 * Math.sin(t * 1.3));
    for (let L = 2; L >= 0; L--) {
      const base = R + 2.5 + L * 5.2 + f.low * (3 + L * 3.2) + breathe * (1.5 + L) + idle * (L === 0 ? .8 : 0);
      const aMid = f.mid * (2.2 + L * 1.7), aHigh = f.high * (L === 2 ? 2.2 : .6 + L * .5);
      const ph = t * (.55 + L * .21), pts = [];
      for (let i = 0; i < 56; i++) {
        const th = i / 56 * Math.PI * 2;
        const r = base + aMid * (Math.sin(2 * th + ph * 1.3 + L) * .6 + Math.sin(3 * th - ph + L * 2) * .4)
          + aHigh * (Math.sin(5 * th + t * 9.5 + L) * .55 + Math.sin(7 * th - t * 12.7) * .45);
        const rx = r * (1 - m) + halfW * m, ry = r * (1 - m * .96);
        pts.push([cx + Math.cos(th) * rx, cy + Math.sin(th) * ry]);
      }
      const alpha = (quiet ? .35 : 1) * (1 - m) * [.55, .32, .18][L] * (active || listening ? 1 : thinking ? .55 + .35 * breathe : .55);
      const grd = g.createRadialGradient(cx, cy, R * .55, cx, cy, base + 10);
      grd.addColorStop(0, salaRgba(P.a, alpha));
      grd.addColorStop(.7, salaRgba(L === 2 ? P.c : P.b, alpha * .9));
      grd.addColorStop(1, salaRgba(P.c, 0));
      salaBlob(g, pts);
      g.fillStyle = grd;
      g.fill();
    }
    // Você falando (ou por cima dela): halo na cor de resposta.
    if ((listening || (active && sala.me > .08)) && sala.me > .01) {
      g.beginPath();
      g.ellipse(cx, cy, (R + 4 + sala.me * 12) * (1 - m) + halfW * m, (R + 4 + sala.me * 12) * (1 - m * .96), 0, 0, Math.PI * 2);
      g.strokeStyle = salaRgba(P.reply, (.25 + sala.me * .6) * (1 - m));
      g.lineWidth = 2 + sala.me * 2.5;
      g.stroke();
    }
    // Pensando: três pontos em órbita lenta.
    if (thinking) {
      for (let k = 0; k < 3; k++) {
        const ang = t * 1.6 - k * .38, rr = R + 9;
        g.beginPath();
        g.arc(cx + Math.cos(ang) * rr * (1 - m), cy + Math.sin(ang) * rr * (1 - m), 2.3 - k * .5, 0, Math.PI * 2);
        g.fillStyle = salaRgba(P.b, (.75 - k * .22) * (1 - m));
        g.fill();
      }
    }
  }
  // Visor da linha de telefone: moldura fina, marcadores nas pontas e a forma de onda dela.
  if (m > .001) {
    const x0 = cx - halfW, x1 = cx + halfW, vh = Math.min(H - 20, R * 1.5), y0 = cy - vh / 2;
    g.globalAlpha = m;
    g.beginPath();
    if (g.roundRect) g.roundRect(x0, y0, x1 - x0, vh, 9); else g.rect(x0, y0, x1 - x0, vh);
    g.fillStyle = salaRgba(P.c, P.dark ? .1 : .08);
    g.fill();
    g.strokeStyle = salaRgba(P.b, .32);
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = salaRgba(P.b, .45);
    for (const x of [x0 + 7, x1 - 7]) { g.beginPath(); g.moveTo(x, cy - 5); g.lineTo(x, cy + 5); g.stroke(); }
    g.strokeStyle = salaRgba(P.b, .14);
    g.beginPath(); g.moveTo(x0 + 12, cy); g.lineTo(x1 - 12, cy); g.stroke();
    const amp = vh * .4, xs = x0 + 12, span = x1 - x0 - 24, wave = f.wave;
    const trace = () => {
      g.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const u = i / (wave.length - 1), taper = Math.sin(u * Math.PI), y = cy + wave[i] * amp * taper;
        if (i) g.lineTo(xs + u * span, y); else g.moveTo(xs, y);
      }
    };
    trace(); g.strokeStyle = salaRgba(P.c, .3); g.lineWidth = 4; g.lineJoin = "round"; g.stroke();
    trace(); g.strokeStyle = salaRgba(P.dark ? P.c : P.a, .95); g.lineWidth = 1.6; g.stroke();
    if (listening && sala.me > .02) { g.beginPath(); g.arc(x1 - 7, y0 + 7, 2.5 + sala.me * 2, 0, Math.PI * 2); g.fillStyle = salaRgba(P.reply, .5 + sala.me * .5); g.fill(); }
    g.globalAlpha = 1;
  }
}

function salaTick(now) {
  sala.raf = 0;
  const el = sala.el;
  if (!el || !el.isConnected || !conv.topic) return;
  // Sala escondida (outra tela): espera em marcha lenta e volta sozinha quando a conversa reaparecer.
  if ($("convRoom").hidden || document.hidden) { sala.raf = 1; setTimeout(() => { sala.raf = requestAnimationFrame(salaTick); }, 500); return; }
  const state = salaState(), lineOn = convPhoneOn(conv.topic), target = lineOn ? 1 : 0;
  if (el.dataset.line !== (lineOn ? "on" : "off")) el.dataset.line = lineOn ? "on" : "off";
  const dark = salaDark();
  if (!sala.pal || sala.pal.dark !== dark) salaApplyPalette();
  // “Reduzir movimento”: um quadro parado (orbe ou linha reta), redesenhado só quando o estado muda; 4 vezes por segundo.
  if (reducedMotion()) {
    sala.morph = target;
    el.style.setProperty("--her", "0"); el.style.setProperty("--me", "0"); el.style.setProperty("--morph", String(target));
    if (el.dataset.state !== state) salaSetState(state);
    const key = state + "|" + target + "|" + (sala.pal && sala.pal.key) + "|" + dark + "|" + (sala.cv && sala.cv.clientWidth);
    if (key !== sala.staticKey) { sala.staticKey = key; sala.me = 0; salaDraw(now, salaSynth(0, false), state); }
    sala.raf = 1; setTimeout(() => { sala.raf = requestAnimationFrame(salaTick); }, 250);
    return;
  }
  const dt = sala.last ? Math.min(100, now - sala.last) : 16;
  sala.last = now;
  if (sala.morph !== target) sala.morph = target > sala.morph ? Math.min(1, sala.morph + dt / SALA_MORPH_MS) : Math.max(0, sala.morph - dt / SALA_MORPH_MS);
  const f = salaAudioFrame(now, state);
  // Suaviza: sobe rápido, desce devagar (a boca abre de uma vez e fecha aos poucos).
  const prev = sala.f || salaSynth(0, false), mix = (a, b) => a + (b - a) * (b > a ? .55 : .14);
  sala.f = {rms: mix(prev.rms, f.rms), low: mix(prev.low, f.low), mid: mix(prev.mid, f.mid), high: mix(prev.high, f.high), wave: f.wave};
  sala.her = sala.f.rms;
  sala.me *= .9;
  el.style.setProperty("--her", sala.her.toFixed(3));
  el.style.setProperty("--me", sala.me.toFixed(3));
  el.style.setProperty("--glow", sala.f.low.toFixed(3));
  el.style.setProperty("--morph", salaEase(sala.morph).toFixed(3));
  if (el.dataset.state !== state) salaSetState(state);
  salaDraw(now, sala.f, state);
  sala.raf = requestAnimationFrame(salaTick);
}
