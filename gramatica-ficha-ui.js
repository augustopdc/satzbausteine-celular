"use strict";
/* Desenho das fichas de gramática (gramatica-fichas.js + gramatica-novos.js) em três camadas: curto (ideia + macete),
   visual (tabela com o importante colorido; tocar numa forma marcada fala a forma) e conversado (“Explicando com calma”,
   recolhido). Peças interativas: troca (alterna entre duas versões da frase e acende o que mudou), complete (você digita a
   forma que falta; ä = ae etc.) e revelar (português → tentar → ver e ouvir o alemão). Sem múltipla escolha.
   O áudio das frases vem de audio-gramatica/ (gramatica-audio.js, gerado) e, sem ele, da voz do sistema. */
function fichaOf(id) { return typeof GRAM_FICHAS !== "undefined" ? GRAM_FICHAS[id] || null : null; }
function fichaStrip(text) { return String(text || "").replace(/\{[mnfpvxd]\|([^}]*)\}/g, "$1").replace(/[[\]]/g, ""); }
/* “Ich lege das Buch [auf den] Tisch.” → texto com o trecho entre colchetes destacado. Cores de significado fixo (aula do
   Menschen): {m|den} masculino, {n|das} neutro, {f|die} feminino, {p|die} plural, {v|steht} verbo, {x|en} a parte que muda; {d|ihr} só marca a palavra alemã no meio do texto em português (letra de livro, sem cor). */
function fichaMark(text, cls = "fx-mark") {
  const out = [];
  String(text || "").split(/(\[[^\]]*\]|\{[mnfpvxd]\|[^}]*\})/).forEach(part => {
    if (!part) return;
    if (part[0] === "[") out.push(h("mark", {class: cls, text: part.slice(1, -1)}));
    else if (part.startsWith("{d|")) out.push(h("span", {class: "mr-d", lang: "de", text: part.slice(3, -1)}));
    else if (part[0] === "{" && part[2] === "|") out.push(h("mark", {class: "mr mr-" + part[1] + (cls.includes("fx-pop") ? " fx-pop" : ""), text: part.slice(3, -1)}));
    else out.push(part);
  });
  return out;
}
let fichaPlayer = null;
function fichaSay(text) {
  const plain = fichaStrip(text).trim();
  if (!plain) return;
  stopAudio();
  if (fichaPlayer) fichaPlayer.pause();
  const id = typeof GRAM_AUDIO !== "undefined" ? GRAM_AUDIO[plain] : null;
  if (id) {
    fichaPlayer = new Audio("audio-gramatica/" + id + ".mp3");
    fichaPlayer.play().catch(() => speak(plain));
  } else speak(plain);
}
function fichaHear(text, label = "Ouvir") {
  return h("button", {class: "icon-btn quiet fx-hear", type: "button", "aria-label": label, title: label, onclick: e => { e.stopPropagation(); fichaSay(text); }}, icon("volume", 16));
}
/* Compara a forma digitada: sem diferença de maiúscula, ae/oe/ue/ss valem por ä/ö/ü/ß. */
function fichaNorm(s) { return String(s || "").trim().toLocaleLowerCase("de").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[.!?,]+$/, ""); }
function fichaSame(a, b) { return fichaNorm(a) === fichaNorm(b); }
function fichaLev(a, b) {
  const prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = prev[j]; prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1)); diag = t; }
  }
  return prev[b.length];
}
const FICHA_ARTIGOS = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines", "kein", "keine", "keinen", "keinem", "keiner", "keines"]);
/* Pista da 2ª chance de uma lacuna (por regra): a dica do item; senão, “ajuste o final” quando só a terminação ou o
   artigo muda (unser × unsere, magerer × mageren, ein × einen, der × den); “confira uma letra” quando falta ou sobra
   uma letra numa palavra comprida; senão, tente de novo. */
function fichaGapHint(typed, resposta, dica) {
  if (dica) return dica;
  const a = fichaNorm(typed), b = fichaNorm(resposta);
  if (a && b && a !== b) {
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    if ((p >= 3 && p >= Math.min(a.length, b.length) - 2) || (FICHA_ARTIGOS.has(a) && FICHA_ARTIGOS.has(b) && p >= 2)) return "Quase: ajuste o final da palavra";
    if (Math.max(a.length, b.length) >= 5 && fichaLev(a, b) === 1) return "Quase: confira uma letra";
  }
  return "Tente mais uma vez (Enter de novo mostra a resposta)";
}

// ---------- Peças interativas ----------
/* A frase em palavras (cada uma num .fx-tw, com as marcas de fichaMark dentro), separadas por um espaço: o texto da linha
   continua igual à frase sem as marcas. Marca colada numa palavra (war{x|st}) fica na mesma palavra. */
function fichaWords(text) {
  const words = [];
  let cur = null;
  String(text || "").split(/(\[[^\]]*\]|\{[mnfpvxd]\|[^}]*\})/).forEach(part => {
    if (!part) return;
    if (part[0] === "[" || (part[0] === "{" && part[2] === "|")) { if (!cur) words.push(cur = []); cur.push(part); return; }
    for (const piece of part.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) { cur = null; continue; }
      if (!cur) words.push(cur = []);
      cur.push(piece);
    }
  });
  return words.map(x => x.join(""));
}
function fichaWordKey(raw) { return fichaNorm(fichaStrip(raw)).replace(/[^\p{L}\p{N}]+/gu, ""); }
function fichaTrocaLine(line, de) {
  const nodes = [];
  fichaWords(de).forEach((word, i) => {
    if (i) nodes.push(" ");
    nodes.push(h("span", {class: "fx-tw", dataset: {w: fichaWordKey(word)}}, ...fichaMark(word, "fx-mark fx-pop")));
  });
  fill(line, ...nodes);
}
/* Voo das palavras ao trocar de estado (FLIP): a palavra que já estava na frase sai do lugar antigo e pousa no novo
   (em arco por cima da linha quando anda mais de 36 px de lado, como o verbo indo para o fim); a palavra nova entra
   com uma escala curta. Sem nada com “reduzir movimento”. */
function fichaTrocaAnimate(line, before) {
  if (!before || !line.isConnected || typeof Element.prototype.animate !== "function") return;
  if (typeof reducedMotion === "function" ? reducedMotion() : window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ease = (getComputedStyle(document.documentElement).getPropertyValue("--ease") || "").trim() || "ease";
  const used = new Set();
  for (const el of line.querySelectorAll(".fx-tw")) {
    const k = before.findIndex((b, i) => !used.has(i) && b.key === el.dataset.w);
    const r = el.getBoundingClientRect();
    if (k < 0) { el.animate([{transform: "scale(.94)", opacity: .35}, {transform: "none", opacity: 1}], {duration: 360, easing: ease}); continue; }
    used.add(k);
    const dx = before[k].x - r.left, dy = before[k].y - r.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    const frames = Math.abs(dx) > 36 && typeof gfArcFrames === "function" ? gfArcFrames(dx, dy)
      : [{transform: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)"}, {transform: "none"}];
    el.animate(frames, {duration: 360, easing: ease});
  }
}
function fichaTroca(w) {
  let k = 0;
  const line = h("p", {class: "fx-troca-de", lang: "de"}), pt = h("p", {class: "muted small-text"});
  const tabs = w.estados.map((s, j) => h("button", {type: "button", "aria-pressed": String(j === 0), onclick: () => show(j)}, s.rotulo));
  const show = j => {
    const before = j !== k && line.isConnected ? [...line.querySelectorAll(".fx-tw")].map(el => { const r = el.getBoundingClientRect(); return {key: el.dataset.w, x: r.left, y: r.top}; }) : null;
    k = j;
    tabs.forEach((b, i) => b.setAttribute("aria-pressed", String(i === j)));
    fichaTrocaLine(line, w.estados[j].de);
    pt.textContent = w.estados[j].pt || "";
    fichaTrocaAnimate(line, before);
  };
  show(0);
  return h("div", {class: "fx-widget fx-troca"},
    h("p", {class: "fx-wlabel", text: "Toque para comparar"}),
    h("div", {class: "segmented seg fx-seg", role: "group"}, ...tabs),
    h("div", {class: "fx-troca-box"}, line, h("div", {class: "fx-troca-foot"}, pt,
      h("button", {class: "icon-btn quiet fx-hear", type: "button", "aria-label": "Ouvir", title: "Ouvir", onclick: () => fichaSay(w.estados[k].de)}, icon("volume", 16)))));
}
function fichaComplete(w, topicId) {
  const rows = w.itens.map(([frase, resposta, dica]) => {
    const [antes, depois] = frase.split("___");
    const input = h("input", {type: "text", lang: "de", class: "fx-gap", autocomplete: "off", autocapitalize: "off", spellcheck: "false", size: String(Math.max(4, resposta.length + 1)), "aria-label": "Complete"});
    const res = h("span", {class: "fx-res"});
    const after = (depois || "").replace(/\s*\([^)]*\)\s*$/, "");
    // Confere só no Enter (ou no botão ✓): sair do campo para ouvir a tabela não corrige nem tranca a lacuna.
    let tries = 0, recorded = false;
    const go = h("button", {class: "icon-btn quiet fx-go", type: "button", "aria-label": "Conferir", title: "Conferir (Enter)", hidden: true, onclick: () => check()}, icon("check", 14));
    go.addEventListener("mousedown", e => e.preventDefault());
    const finish = ok => {
      input.readOnly = true;
      input.classList.remove("try");
      input.classList.add(ok ? "ok" : "no");
      go.hidden = true;
      fill(res, ok ? h("span", {class: "fx-ok", text: "✓"}) : [h("span", {class: "fx-no", text: "→ "}), h("b", {lang: "de", text: resposta})], dica ? h("span", {class: "muted small-text", text: " " + dica}) : null);
      if (ok && typeof uiSound === "function") uiSound("ok");
      // A frase inteira certa, só com a janela à vista e com foco (o autoteste não toca dezenas de áudios).
      if (document.visibilityState === "visible" && document.hasFocus()) fichaSay(fichaStrip(antes + resposta + after));
      const box = input.closest(".fx-complete"), next = box ? [...box.querySelectorAll(".fx-gap")].find(x => !x.readOnly) : null;
      if (next) next.focus();
    };
    const check = () => {
      if (input.readOnly || !input.value.trim()) return;
      tries++;
      const ok = fichaSame(input.value, resposta);
      // Conta só a 1ª tentativa (a 2ª chance é ajuda, não acerto).
      if (!recorded && topicId && typeof gramRecord === "function") { gramRecord([topicId], ok); saveProgress(); recorded = true; }
      if (ok || tries >= 2) return finish(ok);
      input.classList.remove("try");
      void input.offsetWidth; // recomeça a sacudida
      input.classList.add("try");
      fill(res, h("span", {class: "fx-try", text: fichaGapHint(input.value, resposta, dica)}),
        h("button", {class: "quiet small fx-see", type: "button", onclick: () => finish(false)}, "Ver"));
      input.focus();
      input.select();
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); check(); } });
    input.addEventListener("input", () => { go.hidden = input.readOnly || !input.value.trim(); });
    return h("li", null, h("span", {lang: "de", class: "fx-gapline"}, ...fichaMark(antes), input, go, ...fichaMark(after),
      /\([^)]*\)\s*$/.test(depois || "") ? h("span", {class: "fx-gaphint", lang: "pt-BR", text: " " + depois.match(/\([^)]*\)\s*$/)[0].trim()}) : null), res);
  });
  return h("div", {class: "fx-widget fx-complete"}, h("p", {class: "fx-wlabel"}, ...(w.rotulo ? fichaMark(w.rotulo) : ["Complete digitando (Enter confere)"])), h("ol", null, ...rows));
}
function fichaRevelar(w) {
  return h("div", {class: "fx-widget fx-revelar"}, h("p", {class: "fx-wlabel", text: "Diga em alemão, depois toque para conferir"}),
    h("ul", null, ...w.itens.map(([pt, de]) => {
      const back = h("span", {class: "fx-rev-de", lang: "de", hidden: true}, de, fichaHear(de));
      const btn = h("button", {class: "fx-rev", type: "button", onclick: () => { back.hidden = false; btn.classList.add("open"); fichaSay(de); }}, h("span", {text: pt}), back);
      return h("li", null, btn);
    })));
}
function fichaWidget(w, topicId) {
  if (w.tipo === "troca") return fichaTroca(w);
  if (w.tipo === "complete") return fichaComplete(w, topicId);
  if (w.tipo === "revelar") return fichaRevelar(w);
  return null;
}

// ---------- A ficha inteira ----------
function fichaTable(v) {
  if (!v) return null;
  const cell = (x, tag) => {
    const marked = /\[|\{[mnfpvx]\|/.test(x);
    const c = h(tag, {lang: marked ? "de" : null, class: marked ? "fx-live" : null}, ...fichaMark(x));
    if (marked) { c.tabIndex = 0; c.title = "Tocar para ouvir"; c.addEventListener("click", () => fichaSay(x)); c.addEventListener("keydown", e => { if (e.key === "Enter") fichaSay(x); }); }
    return c;
  };
  return h("div", {class: "fx-visual"},
    h("div", {class: "gram-table-scroll"}, h("table", {class: "gram-table fx-table"},
      h("thead", null, h("tr", null, ...v.head.map(x => h("th", {text: x})))),
      h("tbody", null, ...v.rows.map(r => h("tr", null, ...r.map((x, k) => cell(x, k ? "td" : "th"))))))),
    v.nota ? h("p", {class: "fx-nota small-text"}, icon("info", 14), h("span", {text: v.nota})) : null);
}
/* full = página do tópico (tudo); senão, a versão do passo Entender da aula (sem a lista de treino). */
function fichaNodes(t, full = true) {
  const f = fichaOf(t.id);
  if (!f) return null;
  const a = f.armadilha;
  return [
    h("div", {class: "fx-head"},
      h("p", {class: "fx-ideia", text: f.ideia}),
      h("div", {class: "fx-macete"}, h("span", {class: "fx-macete-tag", text: "Macete"}), h("p", {text: f.macete}))),
    fichaTable(f.visual),
    a ? h("div", {class: "trap"}, h("b", {text: "A armadilha do português"}),
      a.pt ? h("p", {class: "trap-pt"}, "Em português: ", h("i", {text: "“" + a.pt + "”"})) : null,
      h("p", {class: "trap-wrong", lang: "de"}, h("span", {text: "✗ "}), a.errado),
      h("p", {class: "trap-right", lang: "de"}, h("span", {text: "✓ "}), a.certo, fichaHear(a.certo))) : null,
    ...(f.interativo || []).map(w => fichaWidget(w, t.id)),
    h("div", {class: "fx-examples"}, ...(f.exemplos || []).map(([de, pt]) => h("div", {class: "fx-ex"}, fichaHear(de),
      h("div", null, h("p", {class: "fx-ex-de", lang: "de"}, ...fichaMark(de)), h("p", {class: "muted small-text", text: pt}))))),
    f.hospital ? h("div", {class: "gram-clinic"}, h("b", {class: "label", text: "No hospital"}),
      h("p", {class: "gram-clinic-de", lang: "de"}, ...fichaMark(f.hospital[0]), fichaHear(f.hospital[0])), h("p", {class: "muted small-text", text: f.hospital[1]})) : null,
    f.conversa && f.conversa.length ? h("details", {class: "fx-calma"},
      h("summary", null, h("b", {text: "Explicando com calma"}), h("span", {class: "muted small-text", text: "o porquê, como numa aula"})),
      ...f.conversa.map(p => h("p", {text: p}))) : null
  ].filter(Boolean);
}
/* Frases de treino da ficha no formato de cartão (para a aula): id G-…, sem entrar no catálogo nem no FSRS. */
function fichaCards(id) {
  const f = fichaOf(id);
  return f ? (f.treino || []).map(([pt, de], k) => ({id: "G-" + id + "-" + k, frase: de, traducao: pt, situacao: "", tags: "Modus::Produktion", ficha: true})) : [];
}
