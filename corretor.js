"use strict";
/* Corretor por regra (LanguageTool local, só no PC): confere o alemão que você escreve e explica em português.
   O LanguageTool pega concordância de artigo/adjetivo, haben×sein, ortografia, maiúscula e vírgula; ordem das palavras e
   caso depois de preposição ficam com a comparação com a frase modelo (gramatica-aula.js). As mensagens dele vêm em alemão:
   LT_RULES_PT traduz as regras mais comuns e liga cada uma a um tópico da Gramática. */
const LT_RULES_PT = [
  [/^HILFSVERB_HABEN_SEIN|HABEN_SEIN/, "Este verbo forma o Perfekt com sein (movimento ou mudança de estado), não com haben.", "perfekt"],
  [/AGREEMENT|KONGRUENZ|DE_DU_UHR/, "Artigo, adjetivo e substantivo não combinam (gênero, número ou caso).", "adjektiv"],
  [/VERBAGREEMENT|SUBJECT_VERB|PRP_VB|VERB_FORM/, "O verbo não combina com o sujeito (ich bin, du bist, er ist…).", "v2"],
  [/^PRAEP_|_PRAEP|PRAEPOSITION|DE_CASE/, "Depois desta preposição o caso é outro (acusativo, dativo ou genitivo).", "praep"],
  [/NACH_7_TAGE|PLURAL|DATIV_PLURAL/, "Falta a terminação do plural ou do dativo plural (seit zwei Jahren, mit den Kindern).", "dativ"],
  [/KOMMA|COMMA/, "Vírgula: em alemão ela vem antes de weil, dass, wenn, ob… e entre orações.", "nebensatz"],
  [/UPPERCASE|LOWERCASE|CASING|GROSS|KLEIN/, "Maiúscula: no começo da frase e em todo substantivo (das Haus, die Arbeit).", null],
  [/SPELLER|TYPO|MORFOLOGIK/, "Palavra escrita errado ou forma que não existe.", null],
  [/WORD_REPEAT|DOPPELTES/, "Palavra repetida.", null],
  [/ZUSAMMENSCHREIBUNG|GETRENNT|COMPOUND/, "Junto ou separado: esta palavra se escreve de outro jeito.", null]
];
const LT_CATS_PT = {GRAMMAR: "Gramática", TYPOS: "Ortografia", CASING: "Maiúsculas", PUNCTUATION: "Pontuação", STYLE: "Estilo", COLLOCATIONS: "Combinação de palavras",
  CONFUSED_WORDS: "Palavras parecidas", REDUNDANCY: "Repetição", COMPOUNDING: "Junto ou separado", MISC: "Outros"};
function ltAvailable() { return !!(window.satzDesktop && window.satzDesktop.ltCheck); }
/* Explicação em português e tópico da Gramática de um erro do LanguageTool. Concordância em duas palavras (kein Zeit) é
   artigo × gênero; com adjetivo no meio (einen neue Auto), terminação do adjetivo. */
function ltExplain(m, part = "") {
  const hit = LT_RULES_PT.find(([re]) => re.test(m.rule || ""));
  let topic = hit ? hit[2] : null;
  if (topic === "adjektiv" && part && part.trim().split(/\s+/).length <= 2) topic = "genero";
  return {pt: hit ? hit[1] : (LT_CATS_PT[m.cat] || "Possível erro") + ": " + m.msg, topic, cat: LT_CATS_PT[m.cat] || "Outros"};
}
/* Confere um texto; devolve null quando o corretor não está disponível ou falhou (a tela segue sem ele). */
async function ltCheck(text) {
  if (!ltAvailable() || !String(text || "").trim()) return null;
  try { return (await window.satzDesktop.ltCheck(text)).matches || []; }
  catch (e) { if (typeof reportError === "function") reportError("corretor", e.message, e.stack); return null; }
}
/* Os erros do texto como lista: trecho → sugestão, com a explicação em português. Estilo fica de fora. */
function ltList(text, matches) {
  const rel = (matches || []).filter(m => m.cat !== "STYLE");
  if (!rel.length) return null;
  return h("ul", {class: "lt-list"}, ...rel.map(m => {
    const part = text.substr(m.o, m.l), ex = ltExplain(m, part);
    return h("li", null,
      h("p", {class: "lt-fix", lang: "de"}, h("del", {text: part}), m.sug && m.sug[0] ? [" → ", h("ins", {text: m.sug[0]})] : null),
      h("p", {class: "small-text", text: ex.pt}),
      ex.topic && GRAMMAR_BY_ID.has(ex.topic) ? h("button", {class: "chip chip-grammar small", type: "button", onclick: () => openGrammarDialog(ex.topic)}, iconText("book", GRAMMAR_BY_ID.get(ex.topic).title, 14)) : null);
  }));
}
