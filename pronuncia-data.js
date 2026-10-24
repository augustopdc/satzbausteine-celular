"use strict";
/* Pares mínimos para sons difíceis para brasileiros. Cada par: [palavra A, palavra B, tradução A, tradução B].
   Áudio: audio-pronuncia/<grupo>-<n>-a.mp3 e -b.mp3 (voz Katja, edge-tts). */
const PRONUNCIA = [
  {id: "ui", title: "ü × i", tip: "Para o ü, diga “i” e arredonde os lábios como para “u”, sem mexer a língua.", pairs: [
    ["Kissen", "küssen", "travesseiro", "beijar"], ["Tier", "Tür", "animal", "porta"], ["spielen", "spülen", "brincar", "lavar a louça"],
    ["Kiste", "Küste", "caixa", "costa"], ["vier", "für", "quatro", "para"]]},
  {id: "uue", title: "u × ü", tip: "O u é posterior (como em português); o ü é um “i” com lábios de “u”.", pairs: [
    ["Mutter", "Mütter", "mãe", "mães"], ["fuhr", "für", "dirigiu", "para"], ["Hut", "Hüte", "chapéu", "chapéus"],
    ["Kuchen", "Küchen", "bolo", "cozinhas"], ["Zug", "Züge", "trem", "trens"]]},
  {id: "oe", title: "ö × e", tip: "Para o ö, diga “e” (fechado) e arredonde os lábios como para “o”.", pairs: [
    ["lesen", "lösen", "ler", "resolver"], ["kennen", "können", "conhecer", "poder"], ["Sehne", "Söhne", "tendão", "filhos"], ["Hefe", "Höfe", "fermento", "pátios"]]},
  {id: "ooe", title: "o × ö", tip: "O ö fica entre o “e” e o “o”, com os lábios arredondados.", pairs: [
    ["schon", "schön", "já", "bonito"], ["Ofen", "Öfen", "forno", "fornos"], ["Tochter", "Töchter", "filha", "filhas"], ["Rock", "Röcke", "saia", "saias"]]},
  {id: "laenge", title: "Vogal longa × curta", tip: "Vogal longa (antes de uma consoante, ou com h/ie/aa) é esticada; vogal curta (antes de consoante dupla) é rápida e mais aberta.", pairs: [
    ["Miete", "Mitte", "aluguel", "meio"], ["Staat", "Stadt", "Estado", "cidade"], ["Höhle", "Hölle", "caverna", "inferno"], ["bieten", "bitten", "oferecer", "pedir"],
    ["Beet", "Bett", "canteiro", "cama"], ["Ofen", "offen", "forno", "aberto"], ["Stahl", "Stall", "aço", "estábulo"], ["wen", "wenn", "quem (acusativo)", "quando, se"]]},
  {id: "ch", title: "ch: ich-Laut × ach-Laut", tip: "Depois de a, o, u (e au), o ch é raspado no fundo da garganta [x]; depois de e, i, ä, ö, ü e consoantes, é um chiado suave [ç], como um “rr” sussurrado com a língua na frente.", pairs: [
    ["dich", "Dach", "te", "telhado"], ["nicht", "Nacht", "não", "noite"], ["Löcher", "Loch", "buracos", "buraco"], ["Bäche", "Bach", "riachos", "riacho"]]},
  {id: "h", title: "h aspirado", tip: "O h no começo da palavra é sempre pronunciado: um sopro leve, como ao embaçar um vidro.", pairs: [
    ["Hund", "und", "cachorro", "e"], ["Hände", "Ende", "mãos", "fim"], ["hier", "ihr", "aqui", "vocês"], ["Haus", "aus", "casa", "de (origem), fora"], ["heißen", "Eisen", "chamar-se", "ferro"]]},
  {id: "zs", title: "z [ts] × s [z]", tip: "O z alemão soa como “ts”; o s antes de vogal soa como o nosso “z”.", pairs: [
    ["Zeit", "seit", "tempo", "desde"], ["zehn", "sehen", "dez", "ver"], ["reizen", "reisen", "irritar", "viajar"]]},
  {id: "er", title: "-e × -er no fim", tip: "O -e final é um “e” fraco; o -er final soa quase como um “a” curto.", pairs: [
    ["bitte", "bitter", "por favor", "amargo"], ["Lehre", "Lehrer", "ensino, aprendizagem", "professor"], ["diese", "dieser", "esta", "este"]]},
  {id: "eiie", title: "ei × ie", tip: "ei soa “ai” (mein = “máin”); ie é um “i” comprido (Liebe = “líibe”). As duas letras nunca soam separadas: nem “e-i”, nem “i-e”.", pairs: [
    ["Wein", "Wien", "vinho", "Viena"], ["Leid", "Lied", "sofrimento", "canção"], ["Reise", "Riese", "viagem", "gigante"],
    ["Beine", "Biene", "pernas", "abelha"], ["meine", "Miene", "minha(s)", "expressão do rosto"]]},
  {id: "euau", title: "au × äu/eu", tip: "au soa como em português (Haus = “haus”); äu e eu soam “ói” (Häuser = “hóizer”, neu = “nói”).", pairs: [
    ["Haus", "Häuser", "casa", "casas"], ["Maus", "Mäuse", "rato", "ratos"], ["Baum", "Bäume", "árvore", "árvores"],
    ["laut", "Leute", "alto (som)", "pessoas"], ["Traum", "träumen", "sonho", "sonhar"]]},
  {id: "ssch", title: "s × sch (e sp/st no início)", tip: "sch é o nosso “ch” de chave; s antes de vogal é “z”. No começo da palavra, sp e st também soam com “ch”: Sport = “chport”, Straße = “chtrasse”, aufstehen = “auf-chtêen”.", pairs: [
    ["sein", "Schein", "ser", "brilho; comprovante"], ["Sohn", "schon", "filho", "já"], ["wissen", "wischen", "saber", "passar pano"], ["Masse", "Masche", "massa", "malha; truque"]]},
  {id: "bp", title: "b × p", tip: "O p alemão sai com um sopro de ar (ponha a mão na frente da boca e sinta); o b é sonoro e sem sopro, como em português.", pairs: [
    ["backen", "packen", "assar", "fazer as malas"], ["Bass", "Pass", "baixo (instrumento)", "passaporte"], ["Bier", "Pier", "cerveja", "píer"], ["Bar", "Paar", "bar", "par, casal"]]},
  {id: "dt", title: "d × t", tip: "O t alemão sai com um sopro de ar e nunca vira “tch” (Tier = “tiia”, não “tchia”); o d é sonoro, sem sopro.", pairs: [
    ["Dank", "Tank", "agradecimento", "tanque"], ["dir", "Tier", "a você", "animal"], ["Deich", "Teich", "dique", "lago pequeno"], ["Dusche", "Tusche", "chuveiro", "nanquim"]]},
  {id: "gk", title: "g × k", tip: "O k alemão sai com um sopro de ar; o g é sonoro e sempre “duro”, como em “gato”, mesmo antes de e e i (gern = “guérn”).", pairs: [
    ["Garten", "Karten", "jardim", "cartões, cartas"], ["Gabel", "Kabel", "garfo", "cabo"], ["Gasse", "Kasse", "ruela", "caixa (de pagar)"], ["gern", "Kern", "com prazer", "caroço, núcleo"]]},
  {id: "vw", title: "w × f/v", tip: "O w alemão soa como o nosso “v” (Wein = “vain”). O v, na maioria das palavras alemãs, soa “f” (Vater = “fáter”, vier = “fiia”).", pairs: [
    ["vier", "wir", "quatro", "nós"], ["Vetter", "Wetter", "primo", "tempo (clima)"], ["fein", "Wein", "fino", "vinho"], ["Feld", "Welt", "campo", "mundo"]]},
  {id: "auslaut", title: "b, d, g no fim da palavra", tip: "No fim da palavra (ou da sílaba), b, d e g soam p, t e k: Tag = “tak”, Hund = “hunt”, halb = “halp”. Quando vem uma vogal depois (Tage, Hunde), voltam a soar g, d, b.", pairs: [
    ["Tag", "Tage", "dia", "dias"], ["Hund", "Hunde", "cachorro", "cachorros"], ["Kind", "Kinder", "criança", "crianças"], ["Rad", "Räder", "roda, bicicleta", "rodas"], ["halb", "halbe", "meio", "meia (declinado)"]]},
  // A2
  {id: "pff", title: "pf × f", tip: "No pf as duas letras soam juntas: feche os lábios como para “p” e solte já em “f” (Pfund = “p-fúnt”). Não pule o p: sem ele, vira outra palavra.", pairs: [
    ["Pfund", "Fund", "libra (meio quilo)", "achado"], ["Pflug", "Flug", "arado", "voo"], ["Pfad", "fad", "trilha", "sem graça"], ["Pfand", "fand", "depósito (garrafa)", "encontrou"]]},
  {id: "ngnk", title: "ng × nk", tip: "O ng é um som só, nasal, no fundo da boca, sem “g” no fim (singen = “zín-ên”). No nk esse mesmo som nasal é seguido de um k bem audível (sinken = “zín-kên”).", pairs: [
    ["singen", "sinken", "cantar", "afundar"], ["Engel", "Enkel", "anjo", "neto"], ["sang", "sank", "cantou", "afundou"]]},
  {id: "chsch", title: "ch [ç] × sch", tip: "O ch depois de i, e, ä, ö, ü é um chiado com a língua na frente e os lábios esticados (como um sorriso); o sch é o nosso “ch” de chave, com os lábios projetados para a frente.", pairs: [
    ["Kirche", "Kirsche", "igreja", "cereja"], ["Fläche", "Flasche", "superfície", "garrafa"], ["mich", "misch", "me (acusativo)", "misture"]]},
  {id: "chk", title: "ch [x] × k", tip: "Depois de a, o, u, o ch é um som contínuo, raspado no fundo da garganta, que dá para esticar; o k é uma batida curta, sem som depois. Nacht (noite) × nackt (nu): cuidado!", pairs: [
    ["Nacht", "nackt", "noite", "nu, pelado"], ["stechen", "stecken", "picar, furar", "enfiar, pôr"], ["lachen", "Laken", "rir", "lençol"], ["machen", "Macken", "fazer", "manias, defeitos"]]},
  {id: "konjii", title: "Umlaut no Konjunktiv II", tip: "Só o trema separa o passado real (hatte = tinha) do hipotético (hätte = teria). Treine para ouvir e produzir a diferença: ä soa “é”, ö e ü com lábios arredondados.", pairs: [
    ["hatte", "hätte", "tinha", "teria"], ["konnte", "könnte", "podia", "poderia"], ["wurde", "würde", "ficou, tornou-se", "-ria (würde + infinitivo)"],
    ["war", "wäre", "era, estava", "seria, estaria"], ["mochte", "möchte", "gostava", "gostaria"]]},
  {id: "aae", title: "a × ä", tip: "O a é aberto como em português; o ä soa como o nosso “é” aberto (Äpfel = “épfel”, Väter = “féta”). Muitas vezes o ä marca o plural.", pairs: [
    ["Apfel", "Äpfel", "maçã", "maçãs"], ["Vater", "Väter", "pai", "pais"], ["Mantel", "Mäntel", "casaco", "casacos"], ["fahre", "Fähre", "dirijo, vou (de veículo)", "balsa"]]},
  // 24/10/2026 (rodada 1 da Pronúncia, escritos pelo Claude: revisar com o tutor): os dois erros de brasileiro que mais trocam a palavra.
  {id: "lfinal", title: "l no fim da sílaba", tip: "No fim da sílaba, o l alemão continua l: a ponta da língua encosta atrás dos dentes de cima. Em português ele vira “u” (Brasil = “Brasiu”); em alemão isso troca a palavra: Hals (garganta) vira Haus (casa).", pairs: [
    ["Hals", "Haus", "garganta, pescoço", "casa"], ["als", "aus", "quando, como", "de (origem), fora"], ["Halt", "Haut", "parada", "pele"], ["bald", "baut", "logo", "constrói"], ["kalt", "kaut", "frio", "mastiga"]]},
  {id: "semvogal", title: "Sem vogal no fim", tip: "Termine na consoante, sem soltar um “i” ou “e” depois: Herd, não “Herdi”. A vogal a mais muda a palavra: Tablette é comprimido, Tablett é bandeja; Herde é rebanho, Herd é fogão.", pairs: [
    ["Tablett", "Tablette", "bandeja", "comprimido"], ["Herd", "Herde", "fogão", "rebanho"], ["Fest", "Feste", "festa", "festas"], ["Brot", "Brote", "pão", "pães"], ["Rat", "Rate", "conselho", "parcela"]]}
];
/* Trilha por inteligibilidade (o que mais faz o paciente não entender vem primeiro). */
const PRON_TRACKS = [
  ["entender", "Para ser entendido", "Os erros que trocam a palavra para quem escuta.", ["semvogal", "lfinal", "bp", "dt", "gk", "laenge", "h", "ui", "uue", "oe", "ooe"]],
  ["ler", "Ler certo", "Letras que em alemão soam diferente do português.", ["eiie", "euau", "vw", "ssch", "zs", "auslaut", "pff", "chk"]],
  ["gramatica", "Gramática que depende do som", "Às vezes só o som separa singular e plural, ou o real do hipotético.", ["er", "aae", "konjii"]],
  ["natural", "Soar natural", "Acabamento: o paciente já entende, mas fica mais natural.", ["ch", "chsch", "ngnk"]]];
/* Vozes do treino do ouvido: edge-tts (grátis) e Google Chirp 3 HD (cota grátis). Katja é a pasta original (sem sufixo);
   as outras têm o sufixo no nome do arquivo (ui-1-a-conrad.mp3). As da Áustria ficam fora dos grupos de ch (lá -ig e
   alguns ch soam diferente). Sem as vozes “Multilingual” (Florian, Seraphina): com uma palavra solta elas adivinham
   inglês (o usuário ouviu; o Whisper confirmou: 17 de 20 palavras detectadas como inglês). */
const PRON_VOICES = [["katja", "Katja", "Alemanha"], ["conrad", "Conrad", "Alemanha"], ["amala", "Amala", "Alemanha"], ["killian", "Killian", "Alemanha"],
  ["aoede", "Aoede", "Alemanha"], ["kore", "Kore", "Alemanha"], ["puck", "Puck", "Alemanha"], ["fenrir", "Fenrir", "Alemanha"],
  ["ingrid", "Ingrid", "Áustria"], ["jonas", "Jonas", "Áustria"]];
const PRON_NO_AT = ["ch", "chsch", "chk"];
/* Palavras do consultório com o som de cada grupo (ouvir e repetir; áudio <grupo>-m<n>[-voz].mp3). */
const PRON_MED = {
  ui: [["Übelkeit", "náusea"], ["Gefühl", "sensação"], ["Rücken", "costas"]],
  uue: [["Untersuchung", "exame"], ["Lungenentzündung", "pneumonia"], ["Frühstück", "café da manhã"]],
  oe: [["Röntgen", "raio X"], ["Störung", "distúrbio"], ["Gehör", "audição"]],
  ooe: [["Knochen", "osso"], ["Röteln", "rubéola"], ["Ödem", "edema"]],
  laenge: [["Fieber", "febre (ie longo)"], ["Magen", "estômago (a longo)"], ["Puls", "pulso (u curto)"]],
  ch: [["Bauch", "barriga (ach)"], ["Gesicht", "rosto (ich)"], ["Knöchel", "tornozelo (ich)"]],
  h: [["Herz", "coração"], ["Husten", "tosse"], ["Hals", "garganta"]],
  zs: [["Schmerzen", "dores (z = ts)"], ["Zucker", "açúcar, diabetes"], ["Sodbrennen", "azia (s = z)"]],
  er: [["Fieber", "febre (-er)"], ["Leber", "fígado (-er)"], ["Niere", "rim (-e)"]],
  eiie: [["Kreislauf", "circulação (ei)"], ["Niere", "rim (ie)"], ["Übelkeit", "náusea (ei)"]],
  euau: [["Bauch", "barriga (au)"], ["Haut", "pele (au)"], ["Beule", "galo, inchaço (eu)"]],
  ssch: [["Schmerzen", "dores"], ["Spritze", "injeção (sp = chp)"], ["Stuhlgang", "evacuação (st = cht)"]],
  bp: [["Puls", "pulso"], ["Blut", "sangue"], ["Patient", "paciente"]],
  dt: [["Tablette", "comprimido"], ["Durchfall", "diarreia"], ["Temperatur", "temperatura"]],
  gk: [["Kopf", "cabeça"], ["Galle", "vesícula biliar"], ["Krankenhaus", "hospital"]],
  vw: [["Wunde", "ferida (w = v)"], ["Verband", "curativo (v = f)"], ["Vene", "veia (exceção: v = v)"]],
  auslaut: [["Hand", "mão (d = t)"], ["Mund", "boca (d = t)"], ["Schlaganfall", "AVC (g = k)"]],
  pff: [["Kopf", "cabeça"], ["Pflaster", "curativo adesivo"], ["Impfung", "vacina"]],
  ngnk: [["Lunge", "pulmão (ng)"], ["krank", "doente (nk)"], ["Schwangerschaft", "gravidez (ng)"]],
  chsch: [["Gesicht", "rosto (ch)"], ["Schulter", "ombro (sch)"], ["Brechreiz", "ânsia de vômito (ch)"]],
  chk: [["Knochen", "osso (ch)"], ["Rachen", "garganta (ch)"], ["Nacken", "nuca (ck)"]],
  konjii: [["könnten", "poderiam (Könnten Sie …?)"], ["hätten", "teriam"], ["wäre", "seria"]],
  aae: [["Magen", "estômago (a)"], ["Schädel", "crânio (ä)"], ["Ärztin", "médica (ä)"]],
  lfinal: [["Hals", "garganta"], ["Puls", "pulso"], ["Schulter", "ombro"]],
  semvogal: [["Arzt", "médico"], ["Rezept", "receita"], ["Blutdruck", "pressão arterial"]]
};
