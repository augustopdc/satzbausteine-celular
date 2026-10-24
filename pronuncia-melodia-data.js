"use strict";
/* Pronúncia, rodada 3 (24/10/2026, escrito pelo Claude: revisar com a professora): frases do consultório para melodia e
   ritmo, e palavras médicas para o acento. Áudio do ElevenLabs (eleven_v4, alemão forçado) em audio-pronuncia:
   fr<NN>-<voz>.mp3 (frase), fr<NN>c<k>-<voz>.mp3 (pedaços do passo a passo), ac<NN>-<voz>.mp3 (palavra do acento). */
const MEL_TIPOS = {
  w: ["Pergunta com W", "Wo, Wie, Was, Seit wann…: em geral cai no fim; subir também é natural e soa simpático.", "cai"],
  jn: ["Pergunta de sim ou não", "Começa pelo verbo: a melodia sobe no fim.", "sobe"],
  pedido: ["Pedido no exame", "Verbo + Sie + bitte: tom calmo, cai no fim.", "cai"],
  info: ["Explicar ao paciente", "Afirmação: cai no fim, com o acento na informação nova.", "cai"],
  empatia: ["Acalmar", "Tom mais baixo e lento, cai suave no fim.", "cai"]
};
const MEL_FRASES = [
  ["w", "Seit wann haben Sie die Schmerzen?", "Desde quando o senhor tem as dores?"],
  ["w", "Wo genau tut es weh?", "Onde exatamente dói?"],
  ["w", "Welche Medikamente nehmen Sie?", "Que remédios o senhor toma?"],
  ["w", "Wie stark sind die Schmerzen?", "Quão fortes são as dores?"],
  ["w", "Was kann ich für Sie tun?", "O que posso fazer pelo senhor?"],
  ["w", "Wie oft haben Sie das?", "Com que frequência o senhor tem isso?"],
  ["jn", "Haben Sie Fieber?", "O senhor está com febre?"],
  ["jn", "Sind Sie gegen etwas allergisch?", "O senhor tem alergia a alguma coisa?"],
  ["jn", "Rauchen Sie?", "O senhor fuma?"],
  ["jn", "Strahlt der Schmerz aus?", "A dor irradia?"],
  ["jn", "Haben Sie heute schon etwas gegessen?", "O senhor já comeu alguma coisa hoje?"],
  ["jn", "Ist Ihnen übel?", "O senhor está enjoado?"],
  ["pedido", "Atmen Sie bitte tief ein.", "Respire fundo, por favor."],
  ["pedido", "Legen Sie sich bitte auf den Rücken.", "Deite-se de costas, por favor."],
  ["pedido", "Machen Sie bitte den Mund auf.", "Abra a boca, por favor."],
  ["pedido", "Zeigen Sie mir bitte, wo es wehtut.", "Mostre-me, por favor, onde dói."],
  ["info", "Wir machen jetzt ein EKG.", "Agora vamos fazer um eletrocardiograma."],
  ["info", "Das Ergebnis ist gut.", "O resultado está bom."],
  ["info", "Sie bekommen eine Infusion.", "O senhor vai receber um soro."],
  ["info", "Ich höre jetzt Ihre Lunge ab.", "Agora vou auscultar o seu pulmão."],
  ["empatia", "Das tut mir leid.", "Sinto muito."],
  ["empatia", "Ich verstehe, das ist unangenehm.", "Eu entendo, isso é desagradável."],
  ["empatia", "Keine Sorge, das ist normal.", "Não se preocupe, isso é normal."],
  ["empatia", "Sie sind hier in guten Händen.", "O senhor está em boas mãos aqui."]
].map(([tipo, de, pt], i) => ({id: "fr" + String(i + 1).padStart(2, "0"), tipo, de, pt}));
/* Passo a passo de trás para frente: pedaços finais cada vez maiores, terminando sempre com a mesma melodia.
   Na pergunta com W o pedaço termina em ponto (cai); na de sim ou não, em interrogação (sobe). */
function melChunks(f) {
  const end = f.de.slice(-1), words = f.de.slice(0, -1).split(" ");
  if (words.length < 4) return [];
  const lens = [...new Set([2, Math.ceil(words.length * .6)])].filter(n => n < words.length);
  const punct = f.tipo === "jn" ? "?" : ".";
  return lens.map(n => words.slice(-n).join(" ") + (end === "?" || end === "." ? punct : end));
}
/* Acento: sílabas e a tônica (índice). Regras: palavra alemã → 1ª sílaba; composto → 1º pedaço; be-/er-/ver-/ent-/ge-
   nunca são tônicos; palavras latinas/gregas → no fim (-ent, -ie, -ion, -ur, -ieren, -ose). */
const ACENTO_REGRAS = {
  alema: "Palavra alemã: a 1ª sílaba é a forte.",
  composto: "Palavra composta: o 1º pedaço é o forte.",
  prefixo: "be-, er-, ver-, ent- e ge- nunca são fortes: a força vai para a sílaba seguinte.",
  latina: "Palavra de origem latina ou grega: a força vai para o fim (-ent, -ie, -ion, -ur, -ieren, -ose)."
};
const ACENTO_PALAVRAS = [
  ["Übelkeit", ["Ü", "bel", "keit"], 0, "náusea", "alema"],
  ["Husten", ["Hus", "ten"], 0, "tosse", "alema"],
  ["Schwindel", ["Schwin", "del"], 0, "tontura", "alema"],
  ["Krankenhaus", ["Kran", "ken", "haus"], 0, "hospital", "composto"],
  ["Blutdruck", ["Blut", "druck"], 0, "pressão arterial", "composto"],
  ["Kopfschmerzen", ["Kopf", "schmer", "zen"], 0, "dor de cabeça", "composto"],
  ["Lungenentzündung", ["Lun", "gen", "ent", "zün", "dung"], 0, "pneumonia", "composto"],
  ["Notaufnahme", ["Not", "auf", "nah", "me"], 0, "pronto-socorro", "composto"],
  ["Erbrechen", ["Er", "bre", "chen"], 1, "vômito", "prefixo"],
  ["Verstopfung", ["Ver", "stop", "fung"], 1, "prisão de ventre", "prefixo"],
  ["Entzündung", ["Ent", "zün", "dung"], 1, "inflamação", "prefixo"],
  ["Behandlung", ["Be", "hand", "lung"], 1, "tratamento", "prefixo"],
  ["Ergebnis", ["Er", "geb", "nis"], 1, "resultado", "prefixo"],
  ["Untersuchung", ["Un", "ter", "su", "chung"], 2, "exame", "prefixo"],
  ["Patient", ["Pa", "ti", "ent"], 2, "paciente", "latina"],
  ["Medikament", ["Me", "di", "ka", "ment"], 3, "remédio", "latina"],
  ["Diagnose", ["Di", "a", "gno", "se"], 2, "diagnóstico", "latina"],
  ["Therapie", ["The", "ra", "pie"], 2, "terapia", "latina"],
  ["Allergie", ["Al", "ler", "gie"], 2, "alergia", "latina"],
  ["Infektion", ["In", "fek", "tion"], 2, "infecção", "latina"],
  ["Operation", ["O", "pe", "ra", "tion"], 3, "cirurgia", "latina"],
  ["Temperatur", ["Tem", "pe", "ra", "tur"], 3, "temperatura", "latina"],
  ["operieren", ["o", "pe", "rie", "ren"], 2, "operar", "latina"],
  ["Tablette", ["Ta", "blet", "te"], 1, "comprimido", "latina"],
  ["Termin", ["Ter", "min"], 1, "consulta marcada", "latina"],
  ["Infusion", ["In", "fu", "sion"], 2, "soro, infusão", "latina"]
].map(([w, sil, t, pt, regra], i) => ({id: "ac" + String(i + 1).padStart(2, "0"), w, sil, t, pt, regra}));
const MEL_VOICES = [["otto", "Otto"], ["lisa", "Lisa"], ["mila", "Mila"]];
