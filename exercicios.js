"use strict";
/* Exercícios de gramática gerados a partir das frases do catálogo (sem conteúdo escrito à mão):
   - Montar a frase: as palavras vêm embaralhadas e o usuário coloca na ordem (verbo em 2º, verbo no fim…).
   - Escolha a forma certa: a frase certa contra uma versão com o erro típico de brasileiro, criada por regras
     conservadoras (troca de artigo, haben × sein, kein × nicht, ordem na subordinada…). Cada regra só gera a
     versão errada em contextos em que ela é com certeza agramatical.
   Acertos por tópico em progress.practice.gram = {topics: {id: {ok, n, at}}}.
   Carregado antes de app.js; usa o estado e as funções de app.js e didatica.js apenas quando chamado. */

const EX_PRON = ["ich", "du", "er", "sie", "es", "wir", "ihr", "man"];
const EX_TWO_WAY = ["in", "an", "auf", "über", "unter", "vor", "hinter", "neben", "zwischen"];
const EX_DAT_PREP = ["mit", "bei", "von", "zu", "aus", "nach", "seit", "gegenüber"];
const EX_MODALS = ["kann", "kannst", "können", "muss", "musst", "müssen", "darf", "darfst", "dürfen", "will", "willst", "wollen", "möchte", "möchtest", "möchten", "soll", "sollst", "sollen"];
const EX_SUB = ["weil", "dass", "wenn", "ob", "obwohl", "damit", "bevor", "nachdem", "falls", "sobald"];
const EX_PREFIX = ["an", "auf", "aus", "ein", "mit", "zu", "ab", "vor", "zurück", "fern", "los", "weg", "nach", "um", "vorbei", "fest", "teil"];
const EX_V2_START = ["heute", "morgen", "gestern", "jetzt", "dann", "danach", "deshalb", "trotzdem", "leider", "vielleicht", "zuerst", "später", "hier", "dort",
  "außerdem", "abends", "morgens", "manchmal", "oft", "bald", "zurzeit", "meistens", "sonntags", "nachher", "gleich", "natürlich"];
const EX_SEIN_PART = ["gegangen", "gefahren", "gekommen", "geflogen", "gelaufen", "geblieben", "gewesen", "geworden", "passiert", "gestorben", "eingezogen", "umgezogen",
  "ausgezogen", "aufgestanden", "angekommen", "eingeschlafen", "aufgewacht", "gestiegen", "eingestiegen", "ausgestiegen", "umgestiegen", "zurückgekommen", "mitgekommen",
  "gereist", "gelandet", "geschwommen", "gewandert", "gerannt", "losgefahren", "abgefahren", "abgeflogen", "hingefallen", "verschwunden", "vorbeigekommen", "zurückgefahren",
  "gestürzt", "gefolgt", "begegnet", "gesprungen", "eingetreten", "ausgegangen", "weggegangen", "hingegangen", "spazieren gegangen"];
const EX_SEIN_TO_HABEN = {bin: "habe", bist: "hast", ist: "hat", sind: "haben", seid: "habt"};
const EX_ORDER_TOPICS = ["v2", "nebensatz", "trennbar", "modal", "perfekt", "konnektoren", "wfragen", "imperativ", "reflexiv",
  "indirekt", "relativ", "deshalb", "umzu", "zweiobjekt", "doppelkonj"];
const ex = {kind: null, topic: null, items: [], i: 0, score: 0, answered: false, picked: [], label: ""};

// ---------- Utilidades de texto ----------
const exCore = t => t.replace(/^[„“"(]+|[.,!?;:…"“”)]+$/g, "");
const exLow = t => exCore(t).toLocaleLowerCase("de");
const exCap = (orig, repl) => /^[A-ZÄÖÜ]/.test(exCore(orig)) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
/* Troca o miolo de um token mantendo a pontuação em volta. */
function exSwap(token, repl) { const core = exCore(token), i = token.indexOf(core); return token.slice(0, i) + exCap(token, repl) + token.slice(i + core.length); }
function exTokens(frase) { return frase.trim().split(/\s+/); }
function exEndPunct(tokens) { const m = tokens[tokens.length - 1].match(/[.!?…]+$/); return m ? m[0] : ""; }
/* Move a pontuação final para o novo último token (ao reordenar). */
function exJoin(tokens, punct) { const out = tokens.map(x => x.replace(/[.!?…]+$/, "")); out[out.length - 1] += punct; return out.join(" "); }

// ---------- Escolha a forma certa: geradores ----------
const EX_RULES = {
  artigo(t) {
    for (let k = 1; k < t.length; k++) {
      const w = exLow(t[k]), m = w.match(/^(d|ein|mein|dein|sein|ihr|unser|kein)e([nm])$/);
      if (!m) continue;
      const prev = exLow(t[k - 1]);
      if (EX_TWO_WAY.includes(prev) || /,$/.test(t[k - 1]) || !t[k + 1]) continue;
      const other = m[1] + "e" + (m[2] === "n" ? "m" : "n");
      const topic = EX_DAT_PREP.includes(prev) || m[2] === "m" ? "dativ" : "akkusativ";
      const out = t.slice(); out[k] = exSwap(t[k], other);
      return {topic, wrong: out};
    }
    return null;
  },
  perfekt(t) {
    const words = t.map(exLow), joined = words.join(" ");
    const aux = words.findIndex(w => EX_SEIN_TO_HABEN[w]);
    if (aux < 0 || !EX_SEIN_PART.some(p => (" " + joined + " ").includes(" " + p + " "))) return null;
    if (/\b(worden|wird|werden|wurde)\b/.test(joined)) return null;
    const out = t.slice(); out[aux] = exSwap(t[aux], EX_SEIN_TO_HABEN[words[aux]]);
    return {topic: "perfekt", wrong: out};
  },
  negacao(t) {
    const k = t.findIndex((x, i) => i < t.length - 1 && /^kein(e|en|em|er|es)?$/.test(exLow(x)));
    if (k < 0 || !/^[A-ZÄÖÜa-zäöü]/.test(t[k + 1])) return null;
    const out = t.slice(); out[k] = exSwap(t[k], "nicht");
    return {topic: "negacao", wrong: out};
  },
  modal(t) {
    if (t.some(x => /,$/.test(x)) || t.length < 4) return null;
    const words = t.map(exLow), m = EX_MODALS.includes(words[0]) ? 0 : EX_MODALS.includes(words[1]) ? 1 : -1;
    const last = t.length - 1, inf = exCore(t[last]);
    if (m < 0 || !/^[a-zäöü]\p{L}*en$/u.test(inf) || last < 3 || EX_MODALS.includes(words[last])) return null;
    const punct = exEndPunct(t), body = t.map(x => x.replace(/[.!?…]+$/, ""));
    // O infinitivo vai para logo depois do modal (ou do sujeito, na pergunta): o erro típico.
    const moved = body.slice(0, 2).concat([body[last]], body.slice(2, last));
    return {topic: "modal", wrong: exTokens(exJoin(moved, punct))};
  },
  nebensatz(t) {
    const c = t.findIndex((x, i) => i > 0 && /,$/.test(t[i - 1]) && EX_SUB.includes(exLow(x)));
    if (c < 0 || t.slice(c).some(x => /,$/.test(x))) return null;
    const clause = t.slice(c), last = clause.length - 1;
    if (clause.length < 4 || !EX_PRON.includes(exLow(clause[1])) || !/^[a-zäöü]/.test(exCore(clause[last]))) return null;
    const punct = exEndPunct(t), body = clause.map(x => x.replace(/[.!?…]+$/, ""));
    const moved = [body[0], body[1], body[last], ...body.slice(2, last)];
    return {topic: "nebensatz", wrong: t.slice(0, c).concat(exTokens(exJoin(moved, punct)))};
  },
  trennbar(t) {
    if (t.some(x => /,$/.test(x)) || t.length < 4) return null;
    const last = t.length - 1, pre = exLow(t[last]);
    if (!EX_PRON.includes(exLow(t[0])) || !EX_PREFIX.includes(pre) || !/^[a-zäöü]/.test(exCore(t[last])) || !/^[a-zäöü]/.test(t[1])) return null;
    if (EX_MODALS.includes(exLow(t[1])) || ["habe", "hast", "hat", "haben", "habt", "bin", "bist", "ist", "sind", "seid", "werde", "wird", "werden"].includes(exLow(t[1]))) return null;
    const punct = exEndPunct(t), body = t.map(x => x.replace(/[.!?…]+$/, ""));
    const moved = [body[0], pre + body[1], ...body.slice(2, last)];
    return {topic: "trennbar", wrong: exTokens(exJoin(moved, punct))};
  },
  v2(t) {
    if (t.length < 4 || !EX_V2_START.includes(exLow(t[0])) || /,$/.test(t[0]) || !EX_PRON.includes(exLow(t[2])) || !/^[a-zäöü]/.test(t[1])) return null;
    const out = t.slice(); out[1] = t[2].replace(/[.!?…]+$/, ""); out[2] = t[1];
    if (/[.!?…]$/.test(t[2])) { out[2] = t[1] + exEndPunct([t[2]]); }
    return {topic: "v2", wrong: out};
  },
  konnektoren(t) {
    for (let k = 1; k < t.length - 2; k++) {
      if (!/,$/.test(t[k - 1]) || !["denn", "aber", "und", "oder", "sondern"].includes(exLow(t[k]))) continue;
      if (!EX_PRON.includes(exLow(t[k + 1])) || !/^[a-zäöü]/.test(t[k + 2]) || /[.!?…,]$/.test(t[k + 1])) continue;
      const out = t.slice(), verb = t[k + 2].replace(/[.!?…]+$/, ""), subj = t[k + 1];
      out[k + 1] = verb; out[k + 2] = subj + (t[k + 2].match(/[.!?…]+$/) || [""])[0];
      return {topic: "konnektoren", wrong: out};
    }
    return null;
  },
  komparativ(t) {
    const k = t.findIndex((x, i) => i > 0 && exLow(x) === "als" && /^\p{Ll}\p{L}{2,}er$/u.test(exCore(t[i - 1]))
      && !["immer", "aber", "oder", "wieder", "sondern", "unter", "über", "hinter"].includes(exLow(t[i - 1])));
    if (k < 0) return null;
    const out = t.slice(); out[k] = exSwap(t[k], "wie");
    return {topic: "komparativ", wrong: out};
  },
  adjektiv(t) {
    const det = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein\p{L}*|mein\p{L}*|dein\p{L}*|sein\p{L}*|ihr\p{L}*|unser\p{L}*|dies\p{L}*)$/iu;
    for (let k = 1; k < t.length - 1; k++) {
      const adj = exCore(t[k]);
      if (!det.test(exCore(t[k - 1])) || !/^\p{Ll}\p{L}{3,}(e|en|er|es|em)$/u.test(adj) || !/^[A-ZÄÖÜ]/.test(exCore(t[k + 1])) || ["bisschen", "paar"].includes(adj)) continue;
      const base = adj.replace(/(en|er|es|em|e)$/, "");
      // Base terminada em -er (früher, höher, teuer) pode ser uma forma certa (“ein früher Termin”).
      if (base.length < 3 || /er$/.test(base) ||/^(ander|nächst|erst|zweit|dritt|letzt|jed|welch|viel|all|beid|einig|manch)/.test(base)) continue;
      const out = t.slice(); out[k] = exSwap(t[k], base);
      return {topic: "adjektiv", wrong: out};
    }
    return null;
  },
  possessiv(t) {
    for (let k = 0; k < t.length - 1; k++) {
      const w = exCore(t[k]), low = w.toLocaleLowerCase("de");
      if (!/^[A-ZÄÖÜ]\p{Ll}/u.test(exCore(t[k + 1])) || /[.!?,]$/.test(t[k]) || (k > 0 && EX_PRON.includes(exLow(t[k - 1])))) continue;
      let repl = null;
      if (["mein", "dein", "unser"].includes(low) || (low === "sein" && k > 0)) repl = low + "e";
      else if (["meine", "deine", "seine", "unsere"].includes(low)) repl = low.replace(/e$/, "");
      if (!repl) continue;
      const out = t.slice(); out[k] = exSwap(t[k], repl);
      return {topic: "possessiv", wrong: out};
    }
    return null;
  },
  wfragen(t) {
    const w = exLow(t[0]);
    if (!/\?$/.test(t[t.length - 1])) return null;
    const out = t.slice();
    // wo com verbo de lugar (wohnen, liegen, sein…) × wohin: “Wohin wohnst du?” é errado.
    const still = /^(wohnst|wohnt|wohnen|wohne|arbeitest|arbeitet|arbeiten|liegt|liegen|ist|sind|bist|steht|stehen|finde|finden|findet|gibt|kann|bekomme|bekommt)$/;
    if (w === "wo" && still.test(exLow(t[1])) && !/^(hin|her)$/.test(exLow(t[t.length - 1]))) out[0] = exSwap(t[0], "wohin");
    else if (["woher", "wohin"].includes(w)) out[0] = exSwap(t[0], "wo");
    else return null;
    return {topic: "wfragen", wrong: out};
  },
  imperativ(t) {
    if (/\?$/.test(t[t.length - 1]) || t.length < 3) return null;
    const k = exLow(t[0]) === "bitte" ? 1 : 0;
    if (!/^\p{L}+en$/u.test(exCore(t[k])) || exCore(t[k + 1]) !== "Sie" || /[.!?,]$/.test(t[k + 1]) || ["sie", "die", "wie"].includes(exLow(t[k]))) return null;
    const out = t.slice(); out.splice(k + 1, 1);
    return {topic: "imperativ", wrong: out};
  },
  reflexiv(t) {
    const pairs = {ich: "mich", du: "dich", wir: "uns"}, subj = exLow(t[0]), refl = pairs[subj];
    // Com sehen, hören e lassen o pronome pode ser objeto comum (“Ich lasse mich untersuchen”).
    if (!refl || t.some(x => /,$/.test(x)) || ["sehe", "sehen", "siehst", "höre", "hören", "hörst", "lasse", "lassen", "lässt"].includes(exLow(t[1]))) return null;
    // Verbos em que o pronome é opcional (entscheiden, ändern, waschen…): sem ele a frase continua certa.
    if (t.some(x => /^(entschei|änder|geänder|beweg|wasch|gewasch|zieh|gezog|dusch|rasier|fahr|gefahr)/.test(exLow(x)))) return null;
    const k = t.findIndex((x, i) => i > 1 && exLow(x) === refl);
    if (k < 0 || EX_TWO_WAY.concat(EX_DAT_PREP, ["für", "ohne", "gegen", "um", "durch"]).includes(exLow(t[k - 1]))) return null;
    const out = t.slice(), punct = (t[k].match(/[.!?…]+$/) || [""])[0];
    out.splice(k, 1);
    if (punct) out[k - 1] = out[k - 1].replace(/[.!?…]+$/, "") + punct;
    return {topic: "reflexiv", wrong: out};
  },
  praeteritum(t) {
    const subj = exLow(t[0]), verb = exLow(t[1]);
    const aux = {ich: {war: "habe"}, er: {war: "hat"}, sie: {war: "hat", waren: "haben"}, es: {war: "hat"}, wir: {waren: "haben"}}[subj];
    if (!aux || !aux[verb] || t.length < 3 || t.length > 7 || t.some(x => /,$/.test(x))) return null;
    const punct = exEndPunct(t), body = t.map(x => x.replace(/[.!?…]+$/, ""));
    const moved = [body[0], aux[verb], ...body.slice(2), "gewesen"];
    return {topic: "praeteritum", wrong: exTokens(exJoin(moved, punct))};
  },
  // ---------- A2 ----------
  zweiobjekt(t) {
    // “es ihm” → “ihm es”: com dois pronomes o acusativo vem sempre antes. Só com verbos de dar/mostrar.
    if (!t.some(x => EX_GIVE.test(exLow(x)))) return null;
    const k = t.findIndex((x, i) => i > 0 && i < t.length - 1 && ["es", "ihn"].includes(exLow(x)) && !/[.!?,;]$/.test(x)
      && ["mir", "dir", "ihm", "uns", "euch", "ihnen"].includes(exLow(t[i + 1])));
    if (k < 0) return null;
    const out = t.slice(), punct = (t[k + 1].match(/[.!?…,]+$/) || [""])[0];
    out[k] = exCore(t[k + 1]); out[k + 1] = exCore(t[k]) + punct;
    return {topic: "zweiobjekt", wrong: out};
  },
  umzu(t) {
    // “um … zu arbeiten” → “um … arbeiten”: sem o zu, a oração de finalidade fica agramatical.
    const u = t.findIndex((x, i) => exLow(x) === "um" && (i === 0 || /,$/.test(t[i - 1])));
    if (u < 0) return null;
    for (let k = u + 2; k < t.length - 1; k++) {
      if (/[.!?,;]$/.test(t[k - 1]) && k - 1 > u) return null;
      if (exLow(t[k]) !== "zu" || /[.!?,;]$/.test(t[k])) continue;
      const inf = t[k + 1];
      if (!/^\p{Ll}\p{L}*n[.!?,…]*$/u.test(inf) || !(k + 1 === t.length - 1 || /,$/.test(inf))) return null;
      const out = t.slice(); out.splice(k, 1);
      return {topic: "umzu", wrong: out};
    }
    return null;
  },
  deshalb(t) {
    // “…, deshalb gehe ich” → “…, deshalb ich gehe”: advérbio na 1ª posição exige a inversão.
    for (let k = 1; k < t.length - 2; k++) {
      if (!["deshalb", "deswegen", "trotzdem"].includes(exLow(t[k])) || /[.!?,;]$/.test(t[k])) continue;
      if (!(/[,;]$/.test(t[k - 1]) || ["und", "aber"].includes(exLow(t[k - 1])))) continue;
      if (!/^[a-zäöü]/.test(t[k + 1]) || /[.!?…,]$/.test(t[k + 1]) || !EX_PRON.includes(exLow(t[k + 2]))) continue;
      const out = t.slice(), verb = t[k + 1], subj = exCore(t[k + 2]);
      out[k + 1] = subj; out[k + 2] = verb + (t[k + 2].match(/[.!?…,]+$/) || [""])[0];
      return {topic: "deshalb", wrong: out};
    }
    return null;
  },
  indirekt(t) {
    // “Weißt du, wann der Zug kommt?” → “…, wann kommt der Zug?”: na pergunta indireta o verbo fica no fim.
    const c = t.findIndex((x, i) => i > 1 && /,$/.test(t[i - 1]) && /^(wann|wo|wohin|woher|was|warum|wie|wer|welche\p{L}*)$/u.test(exLow(x)));
    if (c < 0 || !t.slice(0, c).some(x => EX_ASK.test(exLow(x))) || t.slice(c, -1).some(x => /[,;]$/.test(x))) return null;
    let w = 1;
    if (exLow(t[c]) === "wie" && /^(viel|viele|lange|oft|spät|alt|weit|schnell|genau)$/.test(exLow(t[c + 1]))) w = 2;
    else if (/^welche/.test(exLow(t[c])) && /^[A-ZÄÖÜ]/.test(t[c + 1])) w = 2;
    const clause = t.slice(c), last = clause.length - 1;
    if (last < w + 1 || !/^[a-zäöü]/.test(exCore(clause[last]))) return null;
    const punct = exEndPunct(t), body = clause.map(x => x.replace(/[.!?…]+$/, ""));
    const moved = [...body.slice(0, w), body[last], ...body.slice(w, last)];
    return {topic: "indirekt", wrong: t.slice(0, c).concat(exTokens(exJoin(moved, punct)))};
  }
};
const EX_GIVE = /^(gebe|gibst|gibt|geben|gib|schenke|schenkst|schenkt|schenken|zeige|zeigst|zeigt|zeigen|schicke|schickst|schickt|schicken|bringe|bringst|bringt|bringen|erkläre|erklärst|erklärt|erklären|empfehle|empfiehlt|empfehlen|leihe|leihst|leiht|leihen|gegeben|geschenkt|gezeigt|geschickt|gebracht|empfohlen|geliehen)$/;
const EX_ASK = /^(weiß|weißt|wissen|wisst|frage|fragst|fragt|fragen|sagen|sag|sagst|erklären|zeigen|verstehe|verstehen|ahnung|mitteilen|beschreiben|erzählen)$/;
const EX_RULE_TOPICS = {artigo: ["akkusativ", "dativ"], perfekt: ["perfekt"], negacao: ["negacao"], modal: ["modal"], nebensatz: ["nebensatz"], trennbar: ["trennbar"],
  v2: ["v2"], konnektoren: ["konnektoren"], komparativ: ["komparativ"], adjektiv: ["adjektiv"], possessiv: ["possessiv"], wfragen: ["wfragen"], imperativ: ["imperativ"],
  reflexiv: ["reflexiv"], praeteritum: ["praeteritum"], zweiobjekt: ["zweiobjekt"], umzu: ["umzu"], deshalb: ["deshalb"], indirekt: ["indirekt"]};
/* Tópicos que têm exercício de escolha. */
const EX_FORM_TOPICS = [...new Set(Object.values(EX_RULE_TOPICS).flat())];
const exFormCounts = new Map();
/* Quantas frases do seu nível geram escolha para o tópico (o botão só aparece com 5 ou mais). */
function exFormCount(topic) {
  if (!EX_FORM_TOPICS.includes(topic)) return 0;
  if (!exFormCounts.has(topic)) exFormCounts.set(topic, exPool(topic).length);
  return exFormCounts.get(topic);
}
/* Gera o item de escolha para uma frase (opcionalmente só de um tópico). */
function formItem(card, topic) {
  if (!card || !card.frase || /\n/.test(card.frase)) return null;
  const t = exTokens(card.frase);
  // Uma oração só: frases com ponto ou ponto e vírgula no meio confundem as regras.
  if (t.length < 3 || t.length > 16 || t.slice(0, -1).some(x => /[.!?;:]$/.test(x))) return null;
  for (const [name, rule] of Object.entries(EX_RULES)) {
    if (topic && !EX_RULE_TOPICS[name].includes(topic)) continue;
    let r = null;
    try { r = rule(t); } catch (e) { r = null; }
    if (!r || (topic && r.topic !== topic)) continue;
    const wrong = r.wrong.join(" ");
    if (wrong === card.frase.trim()) continue;
    const diff = r.wrong.length === t.length ? t.map((x, k) => x !== r.wrong[k] ? k : -1).filter(k => k >= 0) : [];
    const blank = diff.length === 1 ? {index: diff[0], right: t[diff[0]], wrong: r.wrong[diff[0]]} : null;
    return {kind: "form", card, topic: r.topic, correct: card.frase.trim(), wrong, tokens: t, blank};
  }
  return null;
}

// ---------- Montar a frase ----------
function buildItem(card) {
  const t = exTokens(card.frase);
  if (t.length < 4 || t.length > 11 || /\n/.test(card.frase) || t.slice(0, -1).some(x => /[.!?;:]$/.test(x))) return null;
  const punct = exEndPunct(t), words = t.map(x => x.replace(/[.!?…]+$/, ""));
  let bank = words.map((w, k) => ({w, k}));
  for (let tries = 0; tries < 8 && bank.every((x, k) => x.k === k); tries++) bank = shuffled(bank);
  if (bank.every((x, k) => x.k === k)) return null;
  const topics = topicsFor(card).filter(x => EX_ORDER_TOPICS.includes(x));
  return {kind: "build", card, words, punct, bank, topics};
}

// ---------- Escolha das frases ----------
function exPool(topic) {
  const open = typeof unlockedLevels === "function" ? unlockedLevels() : new Set(["A1"]);
  const base = cards.filter(c => tag(c, "Modus") === "Produktion" && !isMedical(c) && !isMine(c) && !nwLocked(c) && (open.has(tag(c, "Niveau")) || studied(c) || nwChapter(c) !== null));
  const list = topic ? base.filter(c => topicsFor(c).includes(topic) || (EX_FORM_TOPICS.includes(topic) && formItem(c, topic))) : base;
  const seen = shuffled(list.filter(c => cardProgress(c.id) && cardProgress(c.id).introducedAt));
  const rest = shuffled(list.filter(c => !(cardProgress(c.id) && cardProgress(c.id).introducedAt)));
  return seen.concat(rest);
}
function exItems(kind, topic, n = 10) {
  const out = [], pool = exPool(topic);
  const weak = kind === "form" && !topic ? gramWeakTopics().map(w => w.id) : [];
  // Sem tópico: metade das escolhas vem dos pontos fracos.
  if (weak.length) for (const c of pool) { if (out.length >= n / 2) break; const it = formItem(c); if (it && weak.includes(it.topic)) out.push(it); }
  for (const c of pool) {
    if (out.length >= n) break;
    if (out.some(x => x.card.id === c.id)) continue;
    const it = kind === "build" ? buildItem(c) : formItem(c, topic);
    if (it) out.push(it);
  }
  return shuffled(out);
}

// ---------- Dados ----------
function gramData() {
  progress.practice = progress.practice || {scenes: {}, pron: {}};
  return progress.practice.gram || (progress.practice.gram = {topics: {}});
}
function sanitizeGram(src) {
  const out = {topics: {}};
  if (!src || typeof src.topics !== "object") return out;
  for (const [id, s] of Object.entries(src.topics)) {
    if (!/^[a-z][a-z0-9]{1,19}$/.test(id) || !s) continue;
    const n = Math.max(0, Math.round(Number(s.n) || 0)), ok = Math.min(n, Math.max(0, Math.round(Number(s.ok) || 0)));
    const r = typeof s.r === "string" && /^[01]*$/.test(s.r) ? s.r.slice(-GRAM_RECENT_KEEP) : "";
    if (n) out.topics[id] = r ? {ok, n, at: Number(s.at) || 0, r} : {ok, n, at: Number(s.at) || 0};
  }
  return out;
}
/* Diagnóstico pelo que é recente: além dos totais, cada tópico guarda as últimas respostas (r = "0101…",
   mais nova no fim). O acerto que vale para pontos fracos é o das últimas 10; assim melhora e recaída aparecem logo. */
const GRAM_RECENT = 10, GRAM_RECENT_KEEP = 20;
/* Contadores só crescem: vale o registro com mais respostas. */
function mergeGram(local, incoming) {
  const out = sanitizeGram(local);
  for (const [id, s] of Object.entries(sanitizeGram(incoming).topics)) if (!out.topics[id] || s.n > out.topics[id].n) out.topics[id] = s;
  return out;
}
function gramRecord(topics, ok) {
  const d = gramData();
  for (const id of new Set(topics)) {
    const s = d.topics[id] || {ok: 0, n: 0, at: 0};
    d.topics[id] = {ok: s.ok + (ok ? 1 : 0), n: s.n + 1, at: Date.now(), r: ((s.r || "") + (ok ? "1" : "0")).slice(-GRAM_RECENT_KEEP)};
  }
}
/* pct = acerto recente (últimas 10) quando já há 5 respostas recentes; senão, o total. all = acerto de sempre.
   trend: "up"/"down" quando o recente se afasta 15 pontos ou mais do total (com 10+ respostas). */
function gramStat(id) {
  const s = gramData().topics[id];
  if (!s || !s.n) return null;
  const all = s.ok / s.n, last = (s.r || "").slice(-GRAM_RECENT);
  const recent = last.length >= 5 ? [...last].filter(x => x === "1").length / last.length : null;
  const pct = recent == null ? all : recent;
  const trend = recent != null && s.n >= 10 ? (recent - all >= .15 ? "up" : all - recent >= .15 ? "down" : null) : null;
  return {pct, all, recent, recentN: last.length, n: s.n, trend};
}
function gramStatText(s) {
  if (!s) return "";
  const base = s.recent != null && s.n > s.recentN ? Math.round(s.recent * 100) + "% nas últimas " + s.recentN + " (" + Math.round(s.all * 100) + "% de " + s.n + ")"
    : Math.round(s.pct * 100) + "% de " + s.n;
  return base + (s.trend === "up" ? " · melhorando" : s.trend === "down" ? " · piorou" : "");
}
/* Pontos fracos: acerto recente abaixo de 80% com pelo menos 5 respostas nos exercícios. */
function gramWeakTopics() {
  const out = [];
  for (const t of GRAMMAR_BY_ID.values()) {
    const s = gramStat(t.id);
    if (s && s.n >= 5 && s.pct < .8) out.push({id: t.id, title: t.title, pct: s.pct, n: s.n, trend: s.trend});
  }
  return out.sort((a, b) => a.pct - b.pct).slice(0, 3);
}

// ---------- Tela ----------
function startExercise(kind, topic) {
  const items = exItems(kind, topic);
  if (items.length < 3) { setStatus("Ainda não há frases suficientes para este exercício no seu nível.", "error"); return; }
  Object.assign(ex, {kind, topic, items, i: 0, score: 0, answered: false, picked: [],
    label: (kind === "build" ? "Montar a frase" : "Escolha a forma certa") + (topic ? ": " + GRAMMAR_BY_ID.get(topic).title : "")});
  stopAudio();
  $("grammarList").hidden = true;
  $("grammarTrain").hidden = true;
  $("grammarDetail").hidden = false;
  renderExercise();
  window.scrollTo({top: 0});
}
function exHeader() {
  return [h("button", {class: "quiet small", type: "button", onclick: exClose}, "← Voltar"), h("h2", {text: ex.label}),
    h("p", {class: "counter", text: "Pergunta " + (ex.i + 1) + " de " + ex.items.length + " · acertos: " + ex.score})];
}
function exClose() { stopAudio(); ex.kind = null; if (ex.topic) renderGrammarTopic(ex.topic); else renderGrammar(); }
function exSituation(card) {
  const {text} = splitSituation(card.situacao);
  return h("div", {class: "ex-situation"}, h("p", {text}), h("p", {class: "muted small-text", text: card.traducao}));
}
function renderExercise() {
  const item = ex.items[ex.i];
  ex.answered = false;
  if (item.kind === "build") {
    ex.picked = [];
    const answer = h("div", {class: "ex-answer", id: "exAnswer"}), bank = h("div", {class: "ex-bank", id: "exBank"});
    fill($("grammarDetail"), ...exHeader(), exSituation(item.card),
      h("p", {class: "muted small-text", text: "Toque nas palavras na ordem certa (ou digite o número). Toque numa palavra da resposta para devolvê-la."}),
      answer, bank,
      h("div", {class: "row"}, h("button", {class: "primary", type: "button", id: "exCheck", disabled: true, onclick: checkBuild}, "Conferir", h("kbd", null, "Enter")),
        h("button", {class: "quiet", type: "button", onclick: () => { ex.picked = []; drawBuild(); }}, "Limpar"),
        h("button", {class: "quiet", type: "button", onclick: () => { if (ex.answered) return; ex.picked = []; exGrade(false); }}, "Não sei")),
      h("div", {id: "exFeedback", class: "pron-feedback"}));
    drawBuild();
  } else {
    const options = shuffled([["right", item.blank ? item.blank.right : item.correct], ["wrong", item.blank ? item.blank.wrong : item.wrong]]);
    const prompt = item.blank
      ? h("p", {class: "ex-cloze", lang: "de"}, ...item.tokens.map((x, k) => k === item.blank.index ? h("span", {class: "ex-gap", text: "___" + (x.match(/[.,!?…]+$/) || [""])[0]}) : x).flatMap((x, k) => k ? [" ", x] : [x]))
      : h("p", {class: "muted", text: "Qual destas frases está certa?"});
    fill($("grammarDetail"), ...exHeader(), exSituation(item.card), prompt,
      h("div", {class: "pron-options ex-options" + (item.blank ? "" : " ex-sentences")}, ...options.map(([side, text], k) => h("button", {class: "pron-option", type: "button", dataset: {side},
        onclick: () => answerForm(side)}, h("kbd", null, String(k + 1)), h("b", {lang: "de", text: item.blank ? exCore(text) : text})))),
      h("div", {id: "exFeedback", class: "pron-feedback"}));
  }
}
function drawBuild() {
  const item = ex.items[ex.i];
  fill($("exAnswer"), ...(ex.picked.length ? ex.picked.map((b, k) => h("button", {class: "chip ex-chip", type: "button", lang: "de", onclick: () => { if (ex.answered) return; ex.picked.splice(k, 1); drawBuild(); }}, item.bank[b].w))
    : [h("span", {class: "muted small-text", text: "Sua frase aparece aqui."})]), item.punct ? h("span", {class: "ex-punct", text: item.punct}) : null);
  fill($("exBank"), ...item.bank.map((x, b) => ex.picked.includes(b) ? h("span", {class: "chip ex-chip used", text: x.w}) : h("button", {class: "chip ex-chip", type: "button", lang: "de",
    onclick: () => { if (ex.answered) return; ex.picked.push(b); drawBuild(); }}, h("small", {text: String(b + 1)}), x.w)));
  $("exCheck").disabled = ex.picked.length !== item.bank.length || ex.answered;
}
function checkBuild() {
  const item = ex.items[ex.i];
  if (ex.answered || ex.picked.length !== item.bank.length) return;
  const mine = ex.picked.map(b => item.bank[b].w).join(" "), right = item.words.join(" ");
  exGrade(mine === right, mine);
}
function answerForm(side) {
  if (ex.answered) return;
  all(".ex-options .pron-option").forEach(b => { b.disabled = true; b.classList.add(b.dataset.side === "right" ? "right" : b.dataset.side === side ? "wrong" : "dim"); });
  exGrade(side === "right");
}
function exGrade(ok, mine) {
  const item = ex.items[ex.i];
  ex.answered = true;
  if (ok) ex.score++;
  const topics = item.kind === "build" ? (ex.topic ? [ex.topic] : item.topics) : [item.topic];
  gramRecord(topics, ok);
  saveProgress();
  speakCard(item.card);
  const t = GRAMMAR_BY_ID.get(item.kind === "build" ? topics[0] : item.topic);
  const allowOwn = item.kind === "build" && !ok && mine;
  fill($("exFeedback"),
    h("p", {class: ok ? "fb-ok" : "fb-bad", text: ok ? "Isso!" : item.kind === "build" ? "A frase é:" : "A certa é:"}),
    !ok ? h("p", {class: "ex-right", lang: "de", text: item.correct || item.card.frase}) : null,
    item.kind === "form" && !ok ? h("p", {class: "small-text"}, h("s", {lang: "de", text: item.wrong})) : null,
    t ? h("p", {class: "muted small-text"}, t.short + " ", h("button", {class: "quiet small", type: "button", onclick: () => openGrammarDialog(t.id)}, "📘 " + t.title)) : null,
    h("div", {class: "row center"},
      allowOwn ? h("button", {class: "small", type: "button", onclick: e => { e.currentTarget.remove(); ex.score++; gramRecord(topics, true); gramUndoMiss(topics); saveProgress(); }}, "A minha ordem também está certa") : null,
      h("button", {class: "primary", type: "button", onclick: nextExercise}, ex.i + 1 < ex.items.length ? "Próxima" : "Ver resultado", h("kbd", null, "Espaço"))));
  if (item.kind === "build") drawBuild();
}
/* “A minha ordem também está certa”: desfaz o erro contado (o acerto já foi somado). */
function gramUndoMiss(topics) {
  const d = gramData();
  for (const id of new Set(topics)) {
    const s = d.topics[id];
    if (s && s.n > 0) { s.n--; s.ok = Math.min(s.ok, s.n); }
    // Tira o “0” que ficou antes do acerto recém-somado.
    if (s && s.r && s.r.endsWith("01")) s.r = s.r.slice(0, -2) + "1";
  }
}
function nextExercise() {
  if (!ex.answered) return;
  ex.i++;
  if (ex.i < ex.items.length) { renderExercise(); return; }
  progress.days[dateKey()] = Number(progress.days[dateKey()] || 0) + 1;
  saveProgress();
  const pct = ex.score / ex.items.length, kind = ex.kind, topic = ex.topic;
  fill($("grammarDetail"), h("button", {class: "quiet small", type: "button", onclick: exClose}, "← Voltar"),
    h("div", {class: "summary"}, h("div", {class: "summary-icon"}, icon("check", 30)), h("h2", {text: ex.score + " de " + ex.items.length + " acertos"}),
      h("p", {class: "muted", text: pct >= .9 ? "Muito bem! Esse ponto já está firme." : pct >= .6 ? "Bom caminho. Repita daqui a pouco para fixar." : "Leia a nota de gramática e tente de novo: o erro de hoje é o acerto de amanhã."}),
      h("div", {class: "row center"}, h("button", {class: "primary", type: "button", onclick: () => startExercise(kind, topic)}, "De novo"),
        h("button", {type: "button", onclick: () => startExercise(kind === "build" ? "form" : "build", topic && (kind === "build" ? EX_FORM_TOPICS : EX_ORDER_TOPICS).includes(topic) ? topic : null)}, kind === "build" ? "Escolha a forma certa" : "Montar a frase"),
        h("button", {class: "quiet", type: "button", onclick: exClose}, "Voltar"))));
  ex.kind = null;
}
function exKey(e) {
  if (!ex.kind || $("grammarDetail").hidden) return false;
  const item = ex.items[ex.i];
  if ((e.code === "Space" || e.key === "Enter") && ex.answered) { e.preventDefault(); nextExercise(); return true; }
  if (item.kind === "form" && (e.key === "1" || e.key === "2")) { e.preventDefault(); const b = all(".ex-options .pron-option")[Number(e.key) - 1]; if (b) answerForm(b.dataset.side); return true; }
  if (item.kind === "build" && !ex.answered) {
    if (e.key === "Enter") { e.preventDefault(); checkBuild(); return true; }
    if (e.key === "Backspace") { e.preventDefault(); ex.picked.pop(); drawBuild(); return true; }
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && n <= item.bank.length && !ex.picked.includes(n - 1)) { e.preventDefault(); ex.picked.push(n - 1); drawBuild(); return true; }
  }
  if (e.key === "Escape") { e.preventDefault(); exClose(); return true; }
  return false;
}
/* Painel no topo da tela Gramática: exercícios mistos e pontos fracos. */
function renderGrammarTrain() {
  const box = $("grammarTrain");
  if (!box) return;
  const weak = gramWeakTopics(), d = gramData().topics, total = Object.values(d).reduce((a, s) => a + s.n, 0);
  fill(box,
    h("h2", {text: "Treino de gramática"}),
    h("p", {class: "muted small-text", text: "Exercícios montados com as frases do seu nível (primeiro as que você já viu). “Escolha a forma certa” puxa mais dos seus pontos fracos."}),
    h("div", {class: "row"},
      h("button", {class: "primary", type: "button", onclick: () => startExercise("build")}, "Montar a frase"),
      h("button", {class: "primary", type: "button", onclick: () => startExercise("form")}, "Escolha a forma certa"),
      h("button", {type: "button", onclick: renderGrammarTables}, "Tabelas de consulta")),
    weak.length ? h("p", {class: "small-text spaced"}, h("b", {text: "Seus pontos fracos: "}), ...weak.flatMap((w, k) => [k ? ", " : "",
      h("button", {class: "quiet small", type: "button", onclick: () => renderGrammarTopic(w.id)}, w.title + " (" + Math.round(w.pct * 100) + "%" + (w.trend === "up" ? ", melhorando" : w.trend === "down" ? ", piorou" : "") + ")")]),
      h("span", {class: "muted", text: " · conta mais o que você fez nas últimas 10 respostas de cada tema."}))
      : h("p", {class: "muted small-text spaced", text: total ? "Nenhum ponto fraco por enquanto (abaixo de 80% nas respostas recentes, com 5 ou mais)." : "Faça alguns exercícios para o app mostrar seus pontos fracos."}));
  box.hidden = false;
}
function renderGrammarTables() {
  stopAudio();
  $("grammarList").hidden = true;
  $("grammarTrain").hidden = true;
  $("grammarDetail").hidden = false;
  const table = tb => h("div", {class: "gram-table-wrap"}, h("h3", {text: tb.title}), tb.note ? h("p", {class: "muted small-text", text: tb.note}) : null,
    h("table", {class: "gram-table"}, h("thead", null, h("tr", null, ...tb.head.map(x => h("th", {text: x})))),
      h("tbody", null, ...tb.rows.map(r => h("tr", null, ...r.map((x, k) => h(k ? "td" : "th", {text: x, lang: k ? "de" : null})))))));
  fill($("grammarDetail"), h("button", {class: "quiet small", type: "button", onclick: renderGrammar}, "← Todos os tópicos"),
    h("h2", {text: "Tabelas de consulta"}), ...GRAM_TABLES.map(table));
  window.scrollTo({top: 0});
}
