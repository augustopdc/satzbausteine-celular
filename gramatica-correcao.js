"use strict";
/* Correção da aula de gramática centrada na regra (04/11/2026, a partir de uma crítica colada pelo usuário).
   Três perguntas separadas, todas por REGRA:
   1) Você acertou a parte da regra? A frase modelo e a versão estragada pela regra (formItem, ou a frase errada do
      Consertar) só diferem na parte da regra; a resposta que fica mais perto da modelo do que da estragada acertou a
      regra, a que fica mais perto da estragada errou. Empate (a resposta não tem essas palavras): a detecção do tópico.
   2) A frase diz o que foi pedido? Comparação palavra por palavra com a modelo (outra formulação pode estar certa).
   3) Outros erros? O corretor (LanguageTool). Erro de outro assunto não conta contra o tópico da aula.
   Errou: não mostra a resposta logo; primeiro a região e o tipo do problema, depois uma pista mais explícita, só então
   a resposta comentada. Fica registrado se acertou sozinho, com pista ou vendo o modelo (progress.practice.gram.topics[id].h).
   A IA (Gemma) só entra no botão “Comparar minha resposta”, como opinião; quem decide contar como certo é você. */
const GRAM_HELP_KEEP = 20;
const GC_FAMILY_HINT = {
  base: "Confira a forma do verbo ou do substantivo: terminação, troca de vogal, plural.",
  ordem: "Confira a ordem das palavras: onde fica o verbo conjugado, e o que vai para o fim?",
  passado: "Confira o auxiliar (haben, sein, war, hatte, würde…) e a forma que vai para o fim.",
  casos: "Confira o artigo, o pronome ou a terminação: quem faz e quem recebe a ação?",
  lugar: "Confira a preposição e o caso que ela pede.",
  pedir: "Confira a forma educada: Sie, a forma do verbo e a posição dele.",
  descrever: "Confira a palavra da negação, da comparação ou da resposta, e onde ela fica.",
  verbos: "Confira o verbo especial e o que vem junto com ele (pronome, zu, lassen, werden…).",
  formal: "Confira o auxiliar (werden, sein, haben) e o que vai para o fim da frase."};
const gcBare = s => String(s || "").split(/\s+/).map(normWord).filter(Boolean).join(" ");

/* As palavras da frase modelo que a versão estragada muda ou move (a “parte da regra”). */
function gcRuleWords(model, wrong) {
  if (!wrong) return [];
  const a = exTokens(model), b = exTokens(wrong), out = [];
  if (a.length === b.length) a.forEach((x, k) => { if (normWord(x) !== normWord(b[k])) out.push(x); });
  else { const rest = b.map(normWord); a.forEach(x => { const j = rest.indexOf(normWord(x)); if (j >= 0) rest.splice(j, 1); else out.push(x); }); }
  return out.map(x => x.replace(/[.,!?…;:]+$/, "")).filter(Boolean);
}
/* Diagnóstico puro. model = frase certa; wrong = versão errada pela regra (ou null); detect = (frase) → bool|null;
   lt = erros do corretor (ou null sem corretor); topic = id do tópico (erro do corretor ligado a ele conta contra a regra). */
function gramDiagnose({model, typed, wrong = null, detect = null, lt = null, topic = null}) {
  typed = String(typed || "").trim();
  if (!typed) return {rule: "no", meaning: "longe", pct: 0, exact: false, others: [], topicOk: false, grade: "no", ruleWords: gcRuleWords(model, wrong)};
  const d = wordDiff(model, typed), pct = d.total ? (d.correct - d.near * .5) / d.total : 0;
  const exact = gcBare(model) === gcBare(typed);
  const ruleWords = gcRuleWords(model, wrong);
  const others = (lt || []).filter(m => m.cat !== "STYLE");
  const ltRule = topic ? others.filter(m => ltExplain(m, typed.substr(m.o, m.l)).topic === topic) : [];
  let rule = "unknown", by = "";
  if (exact) { rule = "ok"; by = "exact"; }
  else if (wrong && gcBare(wrong) === gcBare(typed)) { rule = "no"; by = "wrong"; }
  else if (wrong && pct >= .6) {
    // Só compara quando a frase está perto do pedido: com outra construção (Ich nehme den Bus × mit dem Bus), o “den”
    // bate com a versão estragada por acaso.
    const w = wordDiff(wrong, typed), mOk = d.correct - d.near * .5, wOk = w.correct - w.near * .5;
    if (mOk > wOk) { rule = "ok"; by = "compare"; } else if (wOk > mOk) { rule = "no"; by = "compare"; }
  }
  // A regra do exercício só estraga frases que têm a estrutura certa: se ela consegue estragar a sua, a estrutura está lá.
  if (rule === "unknown" && topic && typeof formItem === "function" && formItem({id: "T-0", frase: typed}, topic)) { rule = "ok"; by = "rule"; }
  if (rule === "unknown" && detect) {
    let hit = null;
    try { hit = detect(typed); } catch (e) { hit = null; }
    if (hit === true) { rule = "ok"; by = "detect"; }
    else if (hit === false) { rule = "absent"; by = "detect"; }
  }
  if (rule === "ok" && ltRule.length) { rule = "no"; by = "lt"; }
  const meaning = exact || pct >= .85 ? "ok" : pct >= .6 ? "perto" : "longe";
  // O tópico conta pela regra; sem como conferir a regra, vale a frase inteira (como antes).
  const ltGrammar = others.some(m => m.cat === "GRAMMAR");
  const topicOk = rule === "ok" ? true : rule === "no" ? false : meaning === "ok" && !ltGrammar;
  const grade = exact || (topicOk && meaning === "ok" && !others.length) ? "ok" : topicOk || pct >= .6 ? "quase" : "no";
  return {rule, by, meaning, pct, exact, others, topicOk, grade, ruleWords, d};
}
/* A família do tópico (GRAM_GOALS) dá a pergunta da pista. */
function gcFamilyHint(id) {
  const g = (typeof GRAM_GOALS !== "undefined" ? GRAM_GOALS : []).find(x => x[2].includes(id));
  return (g && GC_FAMILY_HINT[g[0]]) || "Confira a parte da frase que esta regra muda.";
}
/* Pista 1: onde e de que tipo é o problema, sem a resposta. */
function gcHint1(diag, t) {
  const name = t.title.split(/[:(]/)[0].trim().toLowerCase();
  if (diag.rule === "no") return {lead: "A parte da regra ainda não está certa.", ask: gcFamilyHint(t.id)};
  if (diag.rule === "absent") return {lead: "Não encontrei " + name + " na sua frase.", ask: "Tente de novo usando essa estrutura. " + gcFamilyHint(t.id)};
  if (diag.rule === "ok") return {lead: "A regra da aula está certa.", ask: diag.others.length ? "Falta ajustar outra parte (marcada). Isso não conta contra este tópico." : "Algumas palavras não batem com o pedido (marcadas): confira o sentido."};
  return {lead: "Algumas palavras não batem com o pedido (marcadas).", ask: gcFamilyHint(t.id)};
}
/* Pista 2, mais explícita: a palavra da regra pela 1ª letra, ou a posição dela; e o esqueleto da frase modelo. */
function gcHint2(diag, model, it) {
  const out = [];
  if (diag.rule !== "ok" && it && it.blank) {
    const r = it.blank.right.replace(/[.,!?…]+$/, "");
    out.push("A palavra da regra começa com “" + r.slice(0, Math.min(2, r.length - 1)) + "…”.");
  } else if (diag.rule !== "ok" && diag.ruleWords.length) {
    out.push("Repare onde fica “" + diag.ruleWords[0] + "” na frase.");
  }
  // O esqueleto (1ª letra das palavras) entregaria a ordem e a forma: só quando a regra já está certa e falta o resto.
  return {lines: out, skeleton: diag.rule === "ok" || diag.rule === "unknown" ? gcSkeleton(model, diag.d) : ""};
}
/* A frase modelo com as palavras que você acertou inteiras e as outras só com a 1ª letra. */
function gcSkeleton(model, d) {
  const got = new Set(((d && d.ops) || []).filter(o => o[0] === "eq").map(o => normWord(o[1])));
  return exTokens(model).map(w => {
    const m = w.match(/^(.*?)([.,!?…;:]*)$/), core = m[1];
    return got.has(normWord(core)) || core.length <= 1 ? w : core[0] + "·".repeat(Math.min(core.length - 1, 6)) + m[2];
  }).join(" ");
}
/* As palavras da sua resposta que não batem com a modelo, mais os trechos do corretor (para sublinhar). */
function gcMarkTyped(typed, diag) {
  const bad = new Set(((diag.d && diag.d.ops) || []).filter(o => o[0] === "del" || o[0] === "near").map(o => normWord(o[0] === "del" ? o[1] : o[2])));
  const spans = (diag.others || []).map(m => [m.o, m.o + m.l]);
  let pos = 0;
  return typed.split(/(\s+)/).map(part => {
    const start = pos; pos += part.length;
    if (/^\s+$/.test(part) || !part) return {text: part, bad: false};
    const inLt = spans.some(([a, b]) => start < b && start + part.length > a);
    return {text: part, bad: bad.has(normWord(part)) || inLt};
  });
}
/* Registro da ajuda: s = sozinho, 1 = com a 1ª pista, 2 = com a 2ª pista, m = viu o modelo. */
function gramHelpLog(topics, code) {
  if (!/^[s12m]$/.test(code)) return;
  const d = gramData();
  for (const id of new Set(topics)) {
    const s = d.topics[id];
    if (!s) continue;
    s.h = ((s.h || "") + code).slice(-GRAM_HELP_KEEP);
  }
}
/* Resumo da ajuda nas últimas respostas: quantas sozinho, com pista e vendo o modelo. */
function gramHelpStats(id) {
  const h = ((gramData().topics[id] || {}).h) || "";
  return {n: h.length, alone: [...h].filter(c => c === "s").length, hint: [...h].filter(c => c === "1" || c === "2").length, model: [...h].filter(c => c === "m").length};
}

// ---------- “Comparar minha resposta” (Gemma, só no PC) ----------
const GC_COMPARE_SCHEMA = {type: "object", properties: {
  veredito: {type: "string", enum: ["certo", "errado", "incerto"]},
  regra: {type: "string", enum: ["usou", "nao_usou", "errou", "incerto"]},
  explicacao: {type: "string"}, corrigida: {type: "string"}}, required: ["veredito", "regra", "explicacao", "corrigida"]};
function gcComparePrompt(t) {
  return `You compare ONE answer by Luiz, a Brazilian learner of German, in a grammar lesson about "${t.title}" (${t.short}). He had to translate a Portuguese sentence; a reference German sentence is given, but other wordings are also correct if they are correct German and mean the same. Decide: "veredito" = "certo" if his answer is correct German with the same meaning (a different but natural wording is "certo"), "errado" if it has a real mistake or a different meaning, "incerto" if you are not sure. "regra" = whether he used the lesson's structure: "usou" (used it correctly), "errou" (tried it and made a mistake in it), "nao_usou" (said it another way), "incerto". Ignore capitalization of the first word and punctuation. Only call something wrong if you are sure; never invent mistakes. "explicacao" = one or two short sentences in Brazilian Portuguese: what is right and, if wrong, the rule. "corrigida" = his answer with only the mistakes fixed (keep his words); if it is correct, repeat it. Answer as JSON.`;
}
/* Lê a resposta da IA com filtros por regra: “errado” sem nenhuma mudança na corrigida vira incerto. */
function gcCompareResult(typed, j) {
  if (!j || !/^(certo|errado|incerto)$/.test(j.veredito)) return {state: "fail"};
  const fixed = String(j.corrigida || "").trim();
  let state = j.veredito;
  if (state === "errado" && (!fixed || gcBare(fixed) === gcBare(typed))) state = "incerto";
  return {state, rule: j.regra, text: String(j.explicacao || "").trim(), fixed: state === "errado" ? fixed : ""};
}
async function gcCompare(t, pt, model, typed) {
  if (typeof convAvailable !== "function" || !convAvailable()) return {state: "fail"};
  try {
    const r = await window.satzDesktop.convChat([{role: "system", content: gcComparePrompt(t)},
      {role: "user", content: "Portuguese: " + pt + "\nReference: " + model + "\nLuiz: " + typed}], {kind: "compare", temperature: .1, maxTokens: 400, schema: GC_COMPARE_SCHEMA});
    return gcCompareResult(typed, parseLooseJson(r.text));
  } catch (e) { if (typeof reportError === "function") reportError("gramatica", "comparar: " + e.message); return {state: "fail"}; }
}
