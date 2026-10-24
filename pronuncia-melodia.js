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
function melCurve(model, me) {
  const c = h("canvas", {class: "mel-curve", width: 640, height: 150, "aria-hidden": "true"});
  requestAnimationFrame(() => {
    const g = c.getContext("2d"), css = getComputedStyle(document.documentElement), W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = css.getPropertyValue("--line").trim() || "#ddd";
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    const draw = (cv, color, width) => {
      if (!cv) return;
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath();
      cv.pts.forEach((p, i) => { const X = 6 + p.t * (W - 12), Y = H / 2 - Math.max(-9, Math.min(9, p.st)) * (H / 2 - 8) / 9; if (i && cv.pts[i - 1].t < p.t - .08) g.moveTo(X, Y); else if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.stroke();
    };
    draw(model, css.getPropertyValue("--accent").trim() || "#0b6e63", 3);
    draw(me, css.getPropertyValue("--warn").trim() || "#9a5705", 2.5);
  });
  return c;
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
  box.scrollIntoView({block: "nearest", behavior: "smooth"});
  playClip(melUrl(p.id), p.t);
}
async function melTry(f) {
  if (pv.busy) return;
  const box = $("melPanel");
  pv.busy = true;
  box.hidden = false;
  box.scrollIntoView({block: "nearest", behavior: "smooth"});
  const say = (t, cls = "") => fill(box, h("p", {class: "pv-step " + cls}, t), h("p", {class: "mel-chain", lang: "de"}, h("span", {class: "on", text: f.de})));
  try {
    say("Ouça o modelo:");
    await pvPlay(melUrl(f.id));
    say("Agora você:", "rec");
    const blob = await pvRecord(st => { if (st === "fala") say("Gravando:", "rec on"); });
    if (!blob) { fill(box, h("p", {class: "muted", text: "Não ouvi nada. Fale mais perto do microfone e tente de novo."})); return; }
    say("Medindo…");
    const [model, me] = await Promise.all([melDecodeUrl(melUrl(f.id)).then(melContour), blob.arrayBuffer().then(pvDecode).then(melContour)]);
    const checks = melCompare(f.tipo, model, me), myUrl = URL.createObjectURL(blob);
    fill(box,
      h("p", {class: "pv-step"}, "Melodia: ", h("b", {lang: "de", text: f.de})),
      me ? melCurve(model, me) : h("p", {class: "muted", text: "Não deu para medir a melodia (gravação curta ou com ruído)."}),
      h("p", {class: "mel-legend small-text"}, h("span", {class: "mel-key model"}), "Modelo ", h("span", {class: "mel-key me"}), "Você"),
      checks.length ? h("ul", {class: "pv-checks"}, ...checks.map(c => h("li", {class: c.ok === true ? "ok" : c.ok === false ? "no" : "meh"}, h("span", {class: "pv-dot", "aria-hidden": "true"}), c.label))) : null,
      h("div", {class: "row"},
        h("button", {class: "small", type: "button", onclick: () => pvPlay(melUrl(f.id))}, icon("volume", 16), "Modelo"),
        h("button", {class: "small", type: "button", onclick: () => pvPlay(myUrl)}, icon("volume", 16), "Você"),
        h("button", {class: "small", type: "button", onclick: async () => { await pvPlay(melUrl(f.id)); await pvPlay(myUrl); }}, "Os dois"),
        h("button", {class: "primary small", type: "button", onclick: () => melTry(f)}, icon("mic", 16), "Gravar de novo")),
      h("p", {class: "muted small-text", text: "A curva é a altura da sua voz, medida em relação ao seu próprio tom; o que importa é o desenho, não a altura."}));
    await pvPlay(melUrl(f.id));
    await pvPlay(myUrl);
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
  box.scrollIntoView({block: "nearest", behavior: "smooth"});
  const say = (t, cls = "") => fill(box, h("p", {class: "pv-step " + cls}, t, " "), melSyllables(a));
  try {
    say("Ouça o modelo:");
    await pvPlay(melUrl(a.id));
    say("Agora você, com força em “" + a.sil[a.t] + "”:", "rec");
    const blob = await pvRecord(st => { if (st === "fala") say("Gravando:", "rec on"); });
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
