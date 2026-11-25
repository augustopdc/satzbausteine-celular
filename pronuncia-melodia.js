/* Pronúncia, rodada 3 (24/10/2026): melodia das frases do consultório, passo a passo de trás para frente e acento das
   palavras médicas. Medidas por regra (nada de IA), a 16 kHz como em pronuncia-voz.js:
   - melodia: altura da voz quadro a quadro (autocorrelação), em semitons em relação à SUA mediana, para a diferença
     entre voz grave e aguda não atrapalhar; o fim “sobe” ou “cai” comparando o último trecho com a mediana;
   - acento: sem medida. Testado nos áudios do modelo (26 palavras × 3 vozes), separar as sílabas pela energia acertou
     a forte em 17 de 78: não serve. Fica ouvir, ver os blocos e gravar para comparar de ouvido (modelo e você em seguida).
   Melodia testada nos áudios do modelo (24 frases × 3 vozes): 60 de 72 com o fim esperado; quase todos os “erros” foram
   perguntas com W ditas subindo, o que é natural (soa simpático). Por isso a regra: sim/não tem de subir; afirmação e
   pedido não podem subir (viram pergunta); pergunta com W pode cair ou subir. Dados em pronuncia-melodia-data.js. */

// ---------- Análise (pura) ----------
function melFrames(x) {
  const out = [];
  for (let s = 0; s + PV_WIN <= x.length; s += PV_HOP) {
    let e = 0;
    for (let i = s; i < s + PV_WIN; i++) e += x[i] * x[i];
    let best = 0, lag = 0;
    for (let l = 40; l <= 213; l++) {
      let xy = 0, xx = 0, yy = 0;
      for (let i = s; i < s + PV_WIN - l; i++) { const a = x[i], b = x[i + l]; xy += a * b; xx += a * a; yy += b * b; }
      const r = xx && yy ? xy / Math.sqrt(xx * yy) : 0;
      if (r > best) { best = r; lag = l; }
    }
    out.push({db: 10 * Math.log10(e / PV_WIN + 1e-12), r: best, f0: lag ? PV_SR / lag : 0});
  }
  return out;
}
const melMedian = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function melSpan(f) {
  const sorted = f.map(q => q.db).sort((a, b) => a - b), floor = sorted[Math.floor(sorted.length * .1)], peak = sorted[sorted.length - 1];
  const thr = Math.max(floor + 12, peak - 40), sp = f.map(q => q.db > thr);
  return {start: sp.indexOf(true), end: sp.lastIndexOf(true), peak, floor};
}
/* Curva da melodia: pontos {t: 0..1 no tempo da fala, st: semitons da sua mediana} e a direção do fim. */
function melContour(x) {
  const f = melFrames(x), {start, end, peak} = melSpan(f);
  if (start < 0 || end - start < 20) return null;
  let pts = [];
  for (let k = start; k <= end; k++) if (f[k].r > .6 && f[k].db > peak - 30 && f[k].f0 >= 70 && f[k].f0 <= 420) pts.push({k, f0: f[k].f0});
  if (pts.length < 10) return null;
  const med = melMedian(pts.map(p => p.f0));
  pts = pts.map(p => ({k: p.k, st: 12 * Math.log2(p.f0 / med)})).filter(p => Math.abs(p.st) < 10);  // fora: saltos de oitava
  // Suaviza com a mediana de 5 pontos.
  const sm = pts.map((p, i) => ({t: (p.k - start) / Math.max(1, end - start), st: melMedian(pts.slice(Math.max(0, i - 2), i + 3).map(q => q.st))}));
  const tailN = Math.max(3, Math.round(sm.length * .15)), tail = sm.slice(-tailN).reduce((a, p) => a + p.st, 0) / tailN;
  const body = melMedian(sm.slice(0, -tailN).map(p => p.st));
  const d = tail - body;
  return {pts: sm, end: d >= 1.5 ? "sobe" : d <= -1 ? "cai" : "plano", delta: d, dur: (end - start + 1) * PV_HOP / PV_SR * 1000};
}
const MEL_END_TEXT = {sobe: "sobe no fim", cai: "cai no fim", plano: "fica reta no fim"};
function melCompare(tipo, model, me) {
  const out = [];
  if (!me) return out;
  const mod = model ? " · a do modelo " + MEL_END_TEXT[model.end] : "";
  let ok, hint = "";
  if (tipo === "jn") { ok = me.end === "sobe" ? true : me.end === "plano" ? null : false; if (!ok) hint = " · na pergunta de sim ou não ela sobe, senão vira afirmação"; }
  else if (tipo === "w") { ok = true; hint = me.end === "sobe" ? " · subir aqui soa simpático; caindo, mais neutro" : ""; }
  else { ok = me.end === "sobe" ? false : true; if (!ok) hint = " · subindo, soa como pergunta"; }
  out.push({k: "fim", ok, label: "Sua melodia " + MEL_END_TEXT[me.end] + mod + hint});
  if (model) {
    const ratio = me.dur / model.dur;
    out.push({k: "ritmo", ok: ratio <= 1.6 ? true : null, label: "Você levou " + (me.dur / 1000).toFixed(1).replace(".", ",") + " s; o modelo, " + (model.dur / 1000).toFixed(1).replace(".", ",") + " s"
      + (ratio > 1.6 ? " · tente juntar as palavras, sem pausas" : "")});
  }
  return out;
}

// ---------- Tela ----------
const mel = {voice: 0};
const melUrl = (id, voice = "otto") => "audio-pronuncia/" + id + "-" + voice + ".mp3";
function melNextVoice() { const v = MEL_VOICES[mel.voice % MEL_VOICES.length]; mel.voice++; return v[0]; }
async function melDecodeUrl(url) { return pvDecode(await (await fetch(url)).arrayBuffer()); }
/* Curva editorial (24/11/2026, visual de assinatura, rodada 2): canvas em Retina (até 2×), grade de −6, 0 e +6 semitons,
   faixa-alvo no terço final (sobe na pergunta de sim ou não; repousa embaixo na afirmação e no pedido; na pergunta com W
   as duas valem, então não há faixa), curvas suavizadas por pontos médios, área leve sob o modelo, a sua tracejada em
   --warn com o ponto final marcado. Uma agulha (.mel-needle) acompanha o áudio que toca (pvPlay com {needle}). */
const MEL_ST = 9; // ±9 semitons ocupam a altura
/* Puro (testado): geometria da curva num quadro W × H (pontos, faixa-alvo e linhas da grade). */
function melGeom(model, me, tipo, W = 640, H = 150, pad = 8) {
  const X = t => pad + t * (W - 2 * pad), Y = st => H / 2 - Math.max(-MEL_ST, Math.min(MEL_ST, st)) * (H / 2 - pad) / MEL_ST;
  // Buracos (pausa > 8% da fala) partem a curva em trechos, para não ligar duas palavras com uma reta.
  const runs = cv => {
    if (!cv || !cv.pts || !cv.pts.length) return [];
    const out = [[]];
    cv.pts.forEach((p, i) => { if (i && cv.pts[i - 1].t < p.t - .08) out.push([]); out[out.length - 1].push({x: X(p.t), y: Y(p.st)}); });
    return out.filter(r => r.length);
  };
  const dir = tipo === "jn" ? "up" : tipo === "w" || !tipo ? null : "down";
  const target = dir ? {x0: X(.72), x1: X(1), y0: dir === "up" ? pad : H / 2, y1: dir === "up" ? H / 2 : H - pad, dir} : null;
  return {model: runs(model), me: runs(me), target, grid: [-6, 0, 6].map(st => ({st, y: Y(st)})), W, H};
}
/* Puro (testado): caminho suave por pontos médios (M, Q…, L) de uma lista de pontos. */
function melSmooth(pts) {
  if (!pts.length) return [];
  if (pts.length < 3) return [["M", pts[0].x, pts[0].y], ...pts.slice(1).map(p => ["L", p.x, p.y])];
  const out = [["M", pts[0].x, pts[0].y]];
  for (let i = 1; i < pts.length - 1; i++) out.push(["Q", pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2]);
  const z = pts[pts.length - 1];
  out.push(["L", z.x, z.y]);
  return out;
}
function melTrace(g, path) { g.beginPath(); for (const s of path) { if (s[0] === "M") g.moveTo(s[1], s[2]); else if (s[0] === "L") g.lineTo(s[1], s[2]); else g.quadraticCurveTo(s[1], s[2], s[3], s[4]); } }
function melCurve(model, me, tipo) {
  const c = h("canvas", {class: "mel-curve", width: 640, height: 150, "aria-hidden": "true"});
  const wrap = h("div", {class: "mel-curve-wrap"}, c, h("span", {class: "mel-needle", "aria-hidden": "true"}));
  const draw = () => {
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth || 640, H = c.clientHeight || 150;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const geo = melGeom(model, me, tipo, W, H), accent = v("--accent") || "#0b6e63", warn = v("--warn") || "#9a5705";
    if (geo.target) {
      g.fillStyle = accent; g.globalAlpha = .08;
      g.fillRect(geo.target.x0, geo.target.y0, geo.target.x1 - geo.target.x0, geo.target.y1 - geo.target.y0);
      g.globalAlpha = 1;
    }
    g.lineWidth = 1;
    for (const l of geo.grid) { g.strokeStyle = v("--line") || "#ddd"; g.setLineDash(l.st ? [2, 4] : []); g.beginPath(); g.moveTo(0, l.y); g.lineTo(W, l.y); g.stroke(); }
    g.setLineDash([]);
    // Área leve sob o modelo (até a linha do zero), depois a linha.
    for (const run of geo.model) {
      if (run.length < 2) continue;
      const path = melSmooth(run);
      melTrace(g, path); g.lineTo(run[run.length - 1].x, H / 2); g.lineTo(run[0].x, H / 2); g.closePath();
      g.fillStyle = accent; g.globalAlpha = .1; g.fill(); g.globalAlpha = 1;
      melTrace(g, path); g.strokeStyle = accent; g.lineWidth = 3; g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
    }
    /* A sua curva vai tracejada, além da cor: dá para distinguir sem depender dela. */
    g.setLineDash([7, 5]);
    for (const run of geo.me) { melTrace(g, melSmooth(run)); g.strokeStyle = warn; g.lineWidth = 2.5; g.stroke(); }
    g.setLineDash([]);
    const last = geo.me.length ? geo.me[geo.me.length - 1].slice(-1)[0] : null;
    if (last) { g.beginPath(); g.arc(last.x, last.y, 4.5, 0, Math.PI * 2); g.fillStyle = warn; g.fill(); g.lineWidth = 2; g.strokeStyle = v("--surface") || "#fff"; g.stroke(); }
  };
  requestAnimationFrame(draw);
  return wrap;
}
/* Tela das frases: agrupadas pelo tipo de melodia, com ouvir, passo a passo e gravar. */
function melRenderFrases() {
  $("pronList").hidden = true;
  $("pronPlayer").hidden = false;
  stopAudio();
  fill($("pronPlayer"),
    h("button", {class: "quiet small", type: "button", onclick: () => { stopAudio(); renderPron(); }}, "← Todos os sons"),
    h("h2", {text: "Melodia das frases do consultório"}),
    h("p", {class: "lede", text: "Em alemão, a melodia diz se é pergunta de sim ou não (sobe) ou pergunta com W, pedido e explicação (caem). Ouça, faça o passo a passo e grave para ver a sua curva sobre a do modelo."}),
    h("div", {id: "melPanel", class: "pv-panel", hidden: true, "aria-live": "polite"}),
    ...Object.entries(MEL_TIPOS).map(([tipo, [title, sub, dir]]) => h("section", {class: "mel-group"},
      h("div", {class: "mel-group-head"}, h("span", {class: "mel-dir d-" + dir, "aria-hidden": "true"}), h("div", null, h("h3", {text: title}), h("p", {class: "muted small-text", text: sub}))),
      ...MEL_FRASES.filter(f => f.tipo === tipo).map(f => h("div", {class: "mel-item", dataset: {frase: f.id}},
        h("div", {class: "mel-text"}, h("b", {lang: "de", text: f.de}), h("span", {class: "muted small-text", text: f.pt})),
        h("div", {class: "mel-acts"},
          h("button", {class: "small", type: "button", onclick: () => playClip(melUrl(f.id, melNextVoice()), f.de)}, icon("volume", 16), "Ouvir"),
          melChunks(f).length ? h("button", {class: "small", type: "button", onclick: () => melChain(f, 0)}, "Passo a passo") : null,
          canRecord() ? h("button", {class: "icon-btn pv-mic", type: "button", title: "Falar e comparar a melodia", "aria-label": "Falar e comparar a melodia", onclick: () => melTry(f)}, icon("mic", 18)) : null))))));
  window.scrollTo({top: 0});
}
/* Passo a passo de trás para frente: “die Schmerzen.” → “haben Sie die Schmerzen.” → a frase inteira. */
function melChain(f, k) {
  const parts = [...melChunks(f).map((t, i) => ({t, id: f.id + "c" + (i + 1)})), {t: f.de, id: f.id}], box = $("melPanel"), p = parts[k];
  box.hidden = false;
  fill(box,
    h("p", {class: "pv-step"}, "Passo " + (k + 1) + " de " + parts.length + ": ouça e repita em voz alta, com a mesma melodia."),
    h("p", {class: "mel-chain", lang: "de"}, ...parts.map((q, i) => h("span", {class: i === k ? "on" : i < k ? "done" : "", text: q.t}))),
    h("div", {class: "row"},
      h("button", {class: "small", type: "button", onclick: () => playClip(melUrl(p.id), p.t)}, icon("volume", 16), "Ouvir de novo"),
      k + 1 < parts.length ? h("button", {class: "primary small", type: "button", onclick: () => melChain(f, k + 1)}, "Próximo pedaço")
        : canRecord() ? h("button", {class: "primary small", type: "button", onclick: () => melTry(f)}, icon("mic", 16), "Agora grave a frase") : null));
  box.scrollIntoView({block: "nearest", behavior: scrollBehavior()});
  playClip(melUrl(p.id), p.t);
}
async function melTry(f) {
  if (pv.busy) return;
  const box = $("melPanel");
  pv.busy = true;
  box.hidden = false;
  box.scrollIntoView({block: "nearest", behavior: scrollBehavior()});
  const say = (t, cls = "") => fill(box, h("p", {class: "pv-step " + cls}, t, cls.includes("on") ? pvMeterNode() : null), h("p", {class: "mel-chain", lang: "de"}, h("span", {class: "on", text: f.de})));
  try {
    say("Ouça o modelo:");
    await pvPlay(melUrl(f.id));
    say("Agora você:", "rec");
    const blob = await pvRecord(st => { if (st === "fala") say("Gravando:", "rec on"); }, pvMeterLevel);
    if (!blob) { fill(box, h("p", {class: "muted", text: "Não ouvi nada. Fale mais perto do microfone e tente de novo."})); return; }
    say("Medindo…");
    const [model, me] = await Promise.all([melDecodeUrl(melUrl(f.id)).then(melContour), blob.arrayBuffer().then(pvDecode).then(melContour)]);
    const checks = melCompare(f.tipo, model, me), myUrl = URL.createObjectURL(blob);
    let curve = null;
    const needle = () => curve && curve.querySelector(".mel-needle");
    fill(box,
      h("p", {class: "pv-step"}, "Melodia: ", h("b", {lang: "de", text: f.de})),
      me ? (curve = melCurve(model, me, f.tipo)) : h("p", {class: "muted", text: "Não deu para medir a melodia (gravação curta ou com ruído)."}),
      h("p", {class: "mel-legend small-text"}, h("span", {class: "mel-key model"}), "Modelo ", h("span", {class: "mel-key me"}), "Você"),
      checks.length ? h("ul", {class: "pv-checks"}, ...checks.map(c => h("li", {class: c.ok === true ? "ok" : c.ok === false ? "no" : "meh"}, h("span", {class: "pv-dot", "aria-hidden": "true"}), c.label))) : null,
      h("div", {class: "row"},
        h("button", {class: "small", type: "button", onclick: () => pvPlay(melUrl(f.id), {needle: needle()})}, icon("volume", 16), "Modelo"),
        h("button", {class: "small", type: "button", onclick: () => pvPlay(myUrl, {needle: needle()})}, icon("volume", 16), "Você"),
        h("button", {class: "small", type: "button", onclick: async () => { await pvPlay(melUrl(f.id), {needle: needle()}); await pvPlay(myUrl, {needle: needle()}); }}, "Os dois"),
        h("button", {class: "primary small", type: "button", onclick: () => melTry(f)}, icon("mic", 16), "Gravar de novo")),
      h("p", {class: "muted small-text", text: "A curva é a altura da sua voz, medida em relação ao seu próprio tom; o que importa é o desenho, não a altura."}));
    await pvPlay(melUrl(f.id), {needle: needle()});
    await pvPlay(myUrl, {needle: needle()});
  } finally { pv.busy = false; }
}
/* Acento: sílabas em blocos (a forte maior), ouvir e gravar. */
function melSyllables(a, strong = a.t) {
  return h("span", {class: "ac-word", lang: "de"}, ...a.sil.map((s, i) => h("span", {class: "ac-syl" + (i === strong ? " on" : ""), text: s})));
}
function melRenderAcento() {
  $("pronList").hidden = true;
  $("pronPlayer").hidden = false;
  stopAudio();
  fill($("pronPlayer"),
    h("button", {class: "quiet small", type: "button", onclick: () => { stopAudio(); renderPron(); }}, "← Todos os sons"),
    h("h2", {text: "Acento das palavras médicas"}),
    h("p", {class: "lede", text: "Errar a sílaba forte atrapalha mais o paciente do que errar uma vogal. O bloco maior é a sílaba forte."}),
    h("div", {id: "melPanel", class: "pv-panel", hidden: true, "aria-live": "polite"}),
    ...Object.entries(ACENTO_REGRAS).map(([regra, texto]) => h("section", {class: "mel-group"},
      h("p", {class: "ac-rule", text: texto}),
      h("div", {class: "ac-list"}, ...ACENTO_PALAVRAS.filter(a => a.regra === regra).map(a => h("div", {class: "ac-item"},
        h("button", {class: "ac-play", type: "button", "aria-label": "Ouvir " + a.w, onclick: () => playClip(melUrl(a.id, melNextVoice()), a.w)}, melSyllables(a), h("small", {text: a.pt})),
        canRecord() ? h("button", {class: "icon-btn pv-mic", type: "button", title: "Falar e comparar de ouvido", "aria-label": "Falar " + a.w + " e comparar de ouvido", onclick: () => melStressTry(a)}, icon("mic", 18)) : null))))));
  window.scrollTo({top: 0});
}
/* Acento: grava e toca o modelo e você em seguida, para comparar de ouvido (sem medida: ver o cabeçalho). */
async function melStressTry(a) {
  if (pv.busy) return;
  const box = $("melPanel");
  pv.busy = true;
  box.hidden = false;
  box.scrollIntoView({block: "nearest", behavior: scrollBehavior()});
  const say = (t, cls = "") => fill(box, h("p", {class: "pv-step " + cls}, t, " "), melSyllables(a));
  try {
    say("Ouça o modelo:");
    await pvPlay(melUrl(a.id));
    say("Agora você, com força em “" + a.sil[a.t] + "”:", "rec");
    const blob = await pvRecord(st => { if (st === "fala") say("Gravando:", "rec on"); }, pvMeterLevel);
    if (!blob) { fill(box, h("p", {class: "muted", text: "Não ouvi nada. Fale mais perto do microfone e tente de novo."})); return; }
    const myUrl = URL.createObjectURL(blob);
    fill(box,
      h("p", {class: "pv-step", text: "Agora ouça o modelo e você em seguida. A força caiu em “" + a.sil[a.t] + "”?"}),
      melSyllables(a),
      h("p", {class: "muted small-text", text: ACENTO_REGRAS[a.regra]}),
      h("div", {class: "row"},
        h("button", {class: "small", type: "button", onclick: () => pvPlay(melUrl(a.id))}, icon("volume", 16), "Modelo"),
        h("button", {class: "small", type: "button", onclick: () => pvPlay(myUrl)}, icon("volume", 16), "Você"),
        h("button", {class: "small", type: "button", onclick: async () => { await pvPlay(melUrl(a.id)); await pvPlay(myUrl); }}, "Os dois"),
        h("button", {class: "primary small", type: "button", onclick: () => melStressTry(a)}, icon("mic", 16), "Gravar de novo")),
      h("p", {class: "muted small-text", text: "Aqui o app não mede: separar as sílabas pelo som erra demais. Confie no seu ouvido e na professora."}));
    await pvPlay(melUrl(a.id));
    await pvPlay(myUrl);
  } finally { pv.busy = false; }
}
/* Atalhos na tela inicial da Pronúncia. */
function melHomeZone() {
  return h("section", {class: "pron-zone"}, h("h2", {class: "label", text: "Ritmo e melodia"}),
    h("div", {class: "pron-start-grid"},
      h("button", {class: "mel-card", type: "button", onclick: melRenderFrases}, h("b", {text: "Melodia das frases"}), h("span", {class: "muted small-text", text: MEL_FRASES.length + " frases do consultório · sobe ou cai no fim"}),
        h("span", {class: "mel-card-ex", lang: "de", text: "Haben Sie Fieber?"})),
      h("button", {class: "mel-card", type: "button", onclick: melRenderAcento}, h("b", {text: "Acento das palavras médicas"}), h("span", {class: "muted small-text", text: ACENTO_PALAVRAS.length + " palavras · qual sílaba é a forte"}),
        melSyllables(ACENTO_PALAVRAS.find(x => x.w === "Patient")))));
}
