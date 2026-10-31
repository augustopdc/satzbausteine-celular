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
function fichaSame(a, b) {
  const n = s => String(s || "").trim().toLocaleLowerCase("de").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[.!?,]+$/, "");
  return n(a) === n(b);
}

// ---------- Peças interativas ----------
function fichaTroca(w) {
  let k = 0;
  const line = h("p", {class: "fx-troca-de", lang: "de"}), pt = h("p", {class: "muted small-text"});
  const tabs = w.estados.map((s, j) => h("button", {type: "button", "aria-pressed": String(j === 0), onclick: () => show(j)}, s.rotulo));
  const show = j => {
    k = j;
    tabs.forEach((b, i) => b.setAttribute("aria-pressed", String(i === j)));
    fill(line, ...fichaMark(w.estados[j].de, "fx-mark fx-pop"));
    pt.textContent = w.estados[j].pt || "";
  };
  show(0);
  return h("div", {class: "fx-widget fx-troca"},
    h("p", {class: "fx-wlabel", text: "Toque para comparar"}),
    h("div", {class: "seg fx-seg", role: "group"}, ...tabs),
    h("div", {class: "fx-troca-box"}, line, h("div", {class: "fx-troca-foot"}, pt,
      h("button", {class: "icon-btn quiet fx-hear", type: "button", "aria-label": "Ouvir", title: "Ouvir", onclick: () => fichaSay(w.estados[k].de)}, icon("volume", 16)))));
}
function fichaComplete(w, topicId) {
  const rows = w.itens.map(([frase, resposta, dica]) => {
    const [antes, depois] = frase.split("___");
    const input = h("input", {type: "text", lang: "de", class: "fx-gap", autocomplete: "off", spellcheck: "false", size: String(Math.max(4, resposta.length + 1)), "aria-label": "Complete"});
    const res = h("span", {class: "fx-res"});
    const check = () => {
      if (input.readOnly || !input.value.trim()) return;
      const ok = fichaSame(input.value, resposta);
      input.readOnly = true;
      input.classList.add(ok ? "ok" : "no");
      fill(res, ok ? h("span", {class: "fx-ok", text: "✓"}) : [h("span", {class: "fx-no", text: "→ "}), h("b", {lang: "de", text: resposta})], dica ? h("span", {class: "muted small-text", text: " " + dica}) : null);
      if (topicId && typeof gramRecord === "function") { gramRecord([topicId], ok); saveProgress(); }
      if (ok && typeof uiSound === "function") uiSound("ok");
      const all = [...input.closest(".fx-complete").querySelectorAll(".fx-gap")], next = all.find(x => !x.readOnly);
      if (next) next.focus();
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); check(); } });
    input.addEventListener("blur", () => { if (input.value.trim()) check(); });
    return h("li", null, h("span", {lang: "de", class: "fx-gapline"}, ...fichaMark(antes), input, ...fichaMark((depois || "").replace(/\s*\([^)]*\)\s*$/, "")),
      /\([^)]*\)\s*$/.test(depois || "") ? h("span", {class: "fx-gaphint", lang: "pt-BR", text: " " + depois.match(/\([^)]*\)\s*$/)[0].trim()}) : null), res);
  });
  return h("div", {class: "fx-widget fx-complete"}, h("p", {class: "fx-wlabel", text: w.rotulo || "Complete digitando (Enter confere)"}), h("ol", null, ...rows));
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
