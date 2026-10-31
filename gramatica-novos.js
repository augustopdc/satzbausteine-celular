"use strict";
/* Tópicos novos de gramática (26/10/2026), cobrindo o que faltava do A1 em relação às três gramáticas de referência do
   usuário. Cada um entra em GRAMATICA (título, nota curta, armadilha, exemplos e uma detecção conservadora nas frases do
   catálogo; sem detecção segura, `detect` só reconhece casos óbvios e a aula usa as frases de treino da ficha) e ganha a
   sua ficha em GRAM_FICHAS. Escrito pelo Claude; revisar com o tutor. Carregado depois de gramatica-fichas.js. */
(() => {
  const low = c => String(c.frase || "").toLocaleLowerCase("de");
  const add = (topic, ficha) => { GRAMATICA.push(topic); GRAM_FICHAS[topic.id] = ficha; };
  // Formas de du/er com troca de vogal (a→ä, e→i, e→ie) dos verbos mais comuns.
  const VOKAL = /\b(du|er|sie|es|man)\s+(fährst|fährt|schläfst|schläft|läufst|läuft|trägst|trägt|wäschst|wäscht|hältst|hält|lässt|fällt|fängst|fängt|gibst|gibt|nimmst|nimmt|isst|sprichst|spricht|hilfst|hilft|triffst|trifft|vergisst|vergisst|siehst|sieht|liest|empfiehlst|empfiehlt|wirst|wird|weißt|weiß)\b/;

  add({id: "praesens", title: "Presente: conjugar o verbo", short: "A raiz do verbo + a terminação da pessoa: ich -e, du -st, er -t, wir -en, ihr -t, sie/Sie -en.",
    body: ["Tire o -en do infinitivo e cole a terminação de cada pessoa: wohnen → ich wohne, du wohnst, er wohnt, wir wohnen, ihr wohnt, sie wohnen.",
      "sein e haben são irregulares e os mais usados: ich bin, du bist, er ist, wir sind; ich habe, du hast, er hat."],
    trap: ["Ich wohnen in Curitiba.", "Ich wohne in Curitiba."],
    examples: [["Ich arbeite im Krankenhaus.", "Trabalho no hospital."], ["Wo wohnst du?", "Onde você mora?"]],
    detect: c => /\b(ich (bin|habe|wohne|arbeite|heiße|komme|lerne)|du (bist|hast|wohnst|arbeitest|heißt|kommst))\b/.test(low(c))}, {
    ideia: "O verbo alemão muda o final conforme a pessoa: raiz + terminação. Em português também (“moro, mora, moramos“), só que com outras letras.",
    macete: "e – st – t – en – t – en: “ich wohnE, du wohnST, er wohnT, wir wohnEN, ihr wohnT, sie wohnEN“. Sie formal = igual a sie (eles).",
    visual: {head: ["pessoa", "wohnen", "arbeiten", "sein", "haben"], rows: [["ich", "wohn[e]", "arbeit[e]", "[bin]", "hab[e]"], ["du", "wohn[st]", "arbeit[est]", "[bist]", "ha[st]"], ["er / sie / es", "wohn[t]", "arbeit[et]", "[ist]", "ha[t]"], ["wir", "wohn[en]", "arbeit[en]", "[sind]", "hab[en]"], ["ihr", "wohn[t]", "arbeit[et]", "[seid]", "hab[t]"], ["sie / Sie", "wohn[en]", "arbeit[en]", "[sind]", "hab[en]"]],
      nota: "Raiz terminada em -t ou -d (arbeiten, finden) ganha um -e- extra: du arbeitest, er findet."},
    interativo: [{tipo: "complete", itens: [["Ich ___ in Curitiba. (wohnen)", "wohne", "ich → -e"], ["Du ___ im Krankenhaus. (arbeiten)", "arbeitest", "raiz em -t: -est"], ["Wir ___ Ärzte. (sein)", "sind", "sein: wir sind"], ["Er ___ zwei Kinder. (haben)", "hat", "haben: er hat"], ["Woher ___ Sie? (kommen)", "kommen", "Sie = forma de eles"]]}],
    armadilha: {pt: "Eu moro em Curitiba.", errado: "Ich wohnen in Curitiba.", certo: "Ich wohne in Curitiba."},
    exemplos: [["Ich [arbeite] als Arzt.", "Trabalho como médico."], ["Wo [wohnst] du?", "Onde você mora?"], ["Wir [sind] aus Brasilien.", "Somos do Brasil."]],
    hospital: ["Ich [bin] Ihr Arzt heute.", "Eu sou o seu médico hoje."],
    conversa: ["O infinitivo alemão termina quase sempre em -en (wohnen, kommen, lernen). Tire esse -en e você tem a raiz: wohn-, komm-, lern-. Depois é só colar a terminação da pessoa.",
      "Repare que wir e sie/Sie são iguais ao infinitivo (wir wohnen, sie wohnen). E er e ihr terminam em -t. Sobram só ich (-e) e du (-st) para lembrar.",
      "sein e haben fogem da regra, mas você vai usá-los tanto que decoram sozinhos: bin, bist, ist, sind, seid, sind."],
    treino: [["Eu moro em Curitiba.", "Ich wohne in Curitiba."], ["Você trabalha no hospital?", "Arbeitest du im Krankenhaus?"], ["Somos do Brasil.", "Wir sind aus Brasilien."], ["Ele tem dois irmãos.", "Er hat zwei Geschwister."], ["Eu aprendo alemão.", "Ich lerne Deutsch."], ["De onde o senhor vem?", "Woher kommen Sie?"], ["Ela mora em Ponta Grossa.", "Sie wohnt in Ponta Grossa."], ["Vocês são médicos?", "Seid ihr Ärzte?"], ["Eu me chamo Luiz.", "Ich heiße Luiz."], ["Você tem tempo?", "Hast du Zeit?"]],
    erros: [["Ich wohnen in Berlin.", "Ich wohne in Berlin.", "ich → -e."], ["Du arbeitst viel.", "Du arbeitest viel.", "Raiz em -t ganha -e-: arbeitest."]]
  });

  add({id: "vokalwechsel", title: "Verbos que trocam a vogal (du e er)", short: "Alguns verbos mudam a vogal só no du e no er/sie/es: fahren → du fährst; nehmen → du nimmst; sehen → du siehst.",
    body: ["Três trocas: a → ä (fahren, schlafen, tragen), e → i (nehmen, geben, essen, sprechen, helfen) e e → ie (sehen, lesen, empfehlen).",
      "Só du e er/sie/es mudam; ich, wir, ihr e sie ficam normais: ich fahre, du fährst, er fährt, wir fahren."],
    trap: ["Er fahrt nach Berlin.", "Er fährt nach Berlin."],
    examples: [["Du schläfst zu wenig.", "Você dorme pouco."], ["Er nimmt die Tablette.", "Ele toma o comprimido."]],
    detect: c => VOKAL.test(low(c))}, {
    ideia: "Uns verbos irregulares mudam a vogal da raiz só no du e no er/sie/es. O resto da conjugação é normal.",
    macete: "A troca só acontece na “dupla du-er“: du fährst, er fährt — mas ich fahre, wir fahren. Três trocas: a→ä, e→i, e→ie.",
    visual: {head: ["", "fahren (a→ä)", "nehmen (e→i)", "sehen (e→ie)"], rows: [["ich", "fahre", "nehme", "sehe"], ["du", "f[ä]hrst", "n[i]mmst", "s[ie]hst"], ["er / sie / es", "f[ä]hrt", "n[i]mmt", "s[ie]ht"], ["wir / sie / Sie", "fahren", "nehmen", "sehen"]],
      nota: "Os mais comuns: a→ä fahren, schlafen, tragen, waschen, laufen (au→äu); e→i essen, geben, helfen, nehmen, sprechen, treffen, vergessen; e→ie sehen, lesen, empfehlen."},
    interativo: [{tipo: "complete", itens: [["Du ___ zu wenig. (schlafen)", "schläfst", "a → ä"], ["Er ___ die Tablette. (nehmen)", "nimmt", "e → i"], ["Sie ___ ein Buch. (lesen, ela)", "liest", "e → ie"], ["Was ___ du? (essen)", "isst", "e → i"], ["Der Arzt ___ Deutsch. (sprechen)", "spricht", "e → i"]]}],
    armadilha: {pt: "Ele dirige até Berlim.", errado: "Er fahrt nach Berlin.", certo: "Er fährt nach Berlin."},
    exemplos: [["Du [schläfst] zu wenig.", "Você dorme pouco."], ["Was [isst] du gern?", "O que você gosta de comer?"], ["Er [spricht] gut Deutsch.", "Ele fala bem alemão."]],
    hospital: ["[Nimmt] Ihr Vater Blutverdünner?", "Seu pai toma anticoagulante?"],
    conversa: ["Esses verbos são irregulares só “pela metade“: a vogal muda em duas pessoas e o resto segue a regra normal de terminações.",
      "Uma dica de pronúncia ajuda a lembrar: a troca deixa a vogal mais “aguda“ (a → ä, e → i). Quem fala com alemães acaba ouvindo “du nimmst“, “er spricht“ o tempo todo.",
      "No imperativo com du, a troca e→i continua (Nimm! Sprich! Hilf!), mas a→ä não (Fahr! Schlaf!)."],
    treino: [["Você dorme pouco.", "Du schläfst zu wenig."], ["Ele toma o comprimido.", "Er nimmt die Tablette."], ["Ela lê um livro.", "Sie liest ein Buch."], ["O que você come?", "Was isst du?"], ["Ele fala bem alemão.", "Er spricht gut Deutsch."], ["Você dirige amanhã?", "Fährst du morgen?"], ["Ela me ajuda.", "Sie hilft mir."], ["Você vê o ônibus?", "Siehst du den Bus?"], ["Ele recomenda um médico?", "Empfiehlt er einen Arzt?"], ["Ele esquece tudo.", "Er vergisst alles."]],
    erros: [["Du nehmst die Tablette.", "Du nimmst die Tablette.", "nehmen: du nimmst (e → i)."], ["Er fahrt nach Hause.", "Er fährt nach Hause.", "fahren: er fährt (a → ä)."]]
  });

  add({id: "plural", title: "Plural dos substantivos", short: "O plural é sempre die, mas a terminação varia: -e, -er, -n/-en, -s ou nada (às vezes com trema).",
    body: ["Femininos costumam fazer -n/-en (die Lampe → die Lampen, die Zeitung → die Zeitungen). Masculinos muitas vezes -e (der Tisch → die Tische). Neutros curtos -er com trema (das Haus → die Häuser).",
      "Palavras em -er, -el, -en (masculinas e neutras) e em -chen não mudam: der Lehrer → die Lehrer, das Mädchen → die Mädchen. Estrangeiras e em vogal: -s (das Auto → die Autos)."],
    trap: ["Ich habe zwei Bruders.", "Ich habe zwei Brüder."],
    examples: [["Die Kinder spielen.", "As crianças brincam."], ["Ich habe zwei Termine.", "Tenho duas consultas marcadas."]],
    detect: c => /\b(zwei|drei|vier|viele|einige|mehrere)\s+[A-ZÄÖÜ]\w*(e|en|er|s|n)\b/.test(c.frase || "")}, {
    ideia: "No plural o artigo é sempre die; o que muda é o final da palavra — e é por isso que o plural se aprende junto com a palavra.",
    macete: "Cinco caminhos: -e (Tische), -er + trema (Häuser), -n/-en (Lampen), -s (Autos), nada (Lehrer). Feminino → quase sempre -n/-en.",
    visual: {head: ["terminação", "singular", "plural", "típico de"], rows: [["-e", "der Tisch", "die Tisch[e]", "masculinos"], ["-¨e", "der Arzt", "die [Ä]rzt[e]", "masculinos curtos"], ["-er / -¨er", "das Kind / das Haus", "die Kind[er] / die H[ä]us[er]", "neutros curtos"], ["-n / -en", "die Lampe / die Zeitung", "die Lampe[n] / die Zeitung[en]", "femininos"], ["-s", "das Auto", "die Auto[s]", "palavras em vogal, estrangeiras"], ["igual", "der Lehrer / das Mädchen", "die Lehrer / die Mädchen", "-er, -el, -en, -chen"]],
      nota: "No dativo plural se acrescenta -n (se der para): mit den Kinder[n], mit den Ärzte[n]. Treine em Treinar → Artigos (pergunta o plural junto)."},
    interativo: [{tipo: "revelar", itens: [["os médicos", "die Ärzte"], ["as crianças", "die Kinder"], ["as lâmpadas", "die Lampen"], ["os carros", "die Autos"], ["os professores", "die Lehrer"], ["as casas", "die Häuser"]]}],
    armadilha: {pt: "Tenho dois irmãos.", errado: "Ich habe zwei Bruders.", certo: "Ich habe zwei Brüder."},
    exemplos: [["Die [Kinder] schlafen schon.", "As crianças já estão dormindo."], ["Ich habe zwei [Termine].", "Tenho duas consultas."], ["Wie viele [Zimmer] hat die Wohnung?", "Quantos quartos tem o apartamento?"]],
    hospital: ["Haben Sie [Allergien] gegen [Medikamente]?", "O senhor tem alergia a medicamentos?"],
    conversa: ["O “-s“ do português e do inglês é a exceção em alemão: só palavras estrangeiras e terminadas em vogal usam (Autos, Handys, Hotels).",
      "Há tendências fortes que ajudam: feminino → -n/-en (90%), palavras em -er/-el/-en/-chen → iguais, masculinos e neutros curtos → -e ou -er, muitas vezes com trema.",
      "Mas a regra de ouro continua: aprenda a palavra com o artigo E o plural (“der Arzt, die Ärzte“) — é o que o treino de Artigos pede."],
    treino: [["Tenho dois irmãos.", "Ich habe zwei Brüder."], ["As crianças estão dormindo.", "Die Kinder schlafen."], ["Os médicos estão aqui.", "Die Ärzte sind hier."], ["Tenho duas consultas.", "Ich habe zwei Termine."], ["As lâmpadas são novas.", "Die Lampen sind neu."], ["Os carros são caros.", "Die Autos sind teuer."], ["Os professores são legais.", "Die Lehrer sind nett."], ["Quantos quartos?", "Wie viele Zimmer?"], ["As casas são grandes.", "Die Häuser sind groß."], ["Tenho alergias.", "Ich habe Allergien."]],
    erros: [["Ich habe zwei Kinds.", "Ich habe zwei Kinder.", "Kind → Kinder (-er)."], ["Die Ärzte sprecht mit den Kinder.", "Die Ärzte sprechen mit den Kindern.", "Plural: sprechen; dativo plural ganha -n."]]
  });

  add({id: "perspron", title: "Pronomes: mich ou mir, ihn ou ihm", short: "Pronome de objeto direto (acusativo): mich, dich, ihn, sie, es, uns, euch, sie. Indireto/depois de mit etc. (dativo): mir, dir, ihm, ihr, ihm, uns, euch, ihnen.",
    body: ["Acusativo = a pessoa que sofre a ação: “Ich sehe dich“. Dativo = a pessoa que recebe: “Ich gebe dir das Buch“ e depois de mit, bei, von, zu: “mit mir“.",
      "Verbos com dativo pedem mir/dir mesmo parecendo objeto direto: helfen, danken, gefallen, gehören, wehtun."],
    trap: ["Kannst du mich helfen?", "Kannst du mir helfen?"],
    examples: [["Ich rufe dich morgen an.", "Ligo para você amanhã."], ["Das gehört mir.", "Isso é meu."]],
    detect: c => /\b(mich|dich|ihn|mir|dir|ihm|uns|euch|ihnen)\b/.test(low(c))}, {
    ideia: "Os pronomes têm duas formas de objeto: acusativo (a pessoa atingida: mich, dich, ihn) e dativo (a pessoa que recebe ou depois de mit, bei, zu…: mir, dir, ihm).",
    macete: "M de “me atingiu“ → mich; R de “recebe“ → mir. ihn × ihm: N de “ataque“ (acusativo), M de “para ele“ (dativo), igual a den/dem.",
    visual: {head: ["nominativo", "acusativo (direto)", "dativo (indireto)"], rows: [["ich", "[mich]", "[mir]"], ["du", "[dich]", "[dir]"], ["er", "[ihn]", "[ihm]"], ["sie (ela)", "sie", "[ihr]"], ["es", "es", "[ihm]"], ["wir", "uns", "uns"], ["ihr", "euch", "euch"], ["sie / Sie", "sie / Sie", "[ihnen] / [Ihnen]"]],
      nota: "Só ich, du, er, sie (ela) e eles mudam de verdade entre os dois casos; uns e euch são iguais."},
    interativo: [{tipo: "troca", estados: [{rotulo: "acusativo", de: "Ich sehe [ihn] morgen.", pt: "Eu o vejo amanhã."}, {rotulo: "dativo", de: "Ich helfe [ihm] morgen.", pt: "Eu o ajudo amanhã."}]},
      {tipo: "complete", itens: [["Kannst du ___ helfen? (me)", "mir", "helfen → dativo"], ["Ich rufe ___ an. (te)", "dich", "anrufen → acusativo"], ["Das Essen schmeckt ___. (a ela)", "ihr", "schmecken → dativo"], ["Kommst du mit ___? (comigo)", "mir", "mit → dativo"]]}],
    armadilha: {pt: "Você pode me ajudar?", errado: "Kannst du mich helfen?", certo: "Kannst du mir helfen?"},
    exemplos: [["Ich liebe [dich].", "Eu te amo."], ["Gib [mir] bitte das Wasser.", "Me dá a água, por favor."], ["Wir besuchen [ihn] am Sonntag.", "Nós o visitamos no domingo."]],
    hospital: ["Was tut [Ihnen] weh? Zeigen Sie es [mir].", "O que dói no senhor? Me mostre."],
    conversa: ["Em português usamos “me“ para os dois casos (“ele me viu“, “ele me deu“). O alemão separa: mich para “me viu“ (acusativo), mir para “me deu“ (dativo).",
      "Os verbos de dativo mais traiçoeiros: helfen (ajudar), danken (agradecer), gratulieren, gefallen (agradar), gehören (pertencer), wehtun (doer): “Hilf mir“, “Der Rücken tut mir weh“.",
      "Depois de mit, bei, von, zu, aus, nach, seit é sempre dativo: mit mir, bei dir, zu ihm."],
    treino: [["Você pode me ajudar?", "Kannst du mir helfen?"], ["Eu te amo.", "Ich liebe dich."], ["Ligo para você amanhã.", "Ich rufe dich morgen an."], ["Isso é meu.", "Das gehört mir."], ["Nós o visitamos.", "Wir besuchen ihn."], ["Eu o ajudo.", "Ich helfe ihm."], ["Você vem comigo?", "Kommst du mit mir?"], ["Gosto disso.", "Das gefällt mir."], ["Agradeço ao senhor.", "Ich danke Ihnen."], ["Minhas costas doem.", "Der Rücken tut mir weh."]],
    erros: [["Hilf mich!", "Hilf mir!", "helfen → dativo: mir."], ["Ich sehe ihm.", "Ich sehe ihn.", "sehen → acusativo: ihn."]]
  });

  add({id: "janeindoch", title: "ja, nein e doch", short: "doch = “sim“ em resposta a uma pergunta negativa: “Hast du keinen Hunger?“ — “Doch!“ (tenho sim).",
    body: ["Pergunta normal: ja / nein. Pergunta com nicht ou kein: para concordar com a negação, nein; para contrariar, doch."],
    trap: ["Kommst du nicht? — Ja, ich komme.", "Kommst du nicht? — Doch, ich komme."],
    examples: [["Hast du keine Zeit? — Doch!", "Você não tem tempo? — Tenho sim!"], ["Ist das nicht teuer? — Nein, gar nicht.", "Não é caro? — Não, nada."]],
    detect: c => /\bdoch[,!]/.test(low(c)) || /^doch\b/.test(low(c))}, {
    ideia: "Em resposta a uma pergunta NEGATIVA, “sim (ao contrário)“ é doch, não ja.",
    macete: "doch = “contrariar a negação“. “Du hast keinen Hunger?“ — “Doch!“ (tenho sim!).",
    visual: {head: ["pergunta", "concordo (não)", "contrario (sim)"], rows: [["Hast du Zeit?", "Nein.", "[Ja.]"], ["Hast du [keine] Zeit?", "Nein, keine.", "[Doch!]"], ["Kommst du [nicht]?", "Nein, ich komme nicht.", "[Doch], ich komme."]],
      nota: "doch também aparece no meio da frase dando ênfase: “Komm doch mit!“ (vem junto, vai!)."},
    interativo: [{tipo: "troca", estados: [{rotulo: "pergunta positiva", de: "Haben Sie Schmerzen? — [Ja].", pt: "O senhor tem dor? — Sim."}, {rotulo: "pergunta negativa", de: "Haben Sie keine Schmerzen? — [Doch].", pt: "O senhor não tem dor? — Tenho sim."}]}],
    armadilha: {pt: "Você não vem? — Venho sim!", errado: "Kommst du nicht? — Ja, ich komme!", certo: "Kommst du nicht? — Doch, ich komme!"},
    exemplos: [["Bist du nicht müde? — [Doch], sehr!", "Você não está cansado? — Estou sim, muito!"], ["Hast du kein Auto? — [Nein], ich fahre Bus.", "Você não tem carro? — Não, ando de ônibus."], ["Kommst du [doch] mit?", "Você vem junto, afinal?"]],
    hospital: ["Haben Sie keine Allergien? — [Doch], gegen Penicillin.", "O senhor não tem alergias? — Tenho sim, à penicilina."],
    conversa: ["Em português respondemos “sim, tenho“ mesmo a uma pergunta negativa, e o contexto resolve. Em alemão “ja“ depois de pergunta negativa soa confuso: o alemão tem uma palavra só para isso, doch.",
      "Na anamnese isso aparece muito: “Sie nehmen keine Medikamente?“ — se o paciente toma, a resposta é “Doch, …“."],
    treino: [["Você não tem tempo? — Tenho sim!", "Hast du keine Zeit? — Doch!"], ["O senhor não tem alergias? — Tenho sim.", "Haben Sie keine Allergien? — Doch."], ["Você não vem? — Venho sim!", "Kommst du nicht? — Doch, ich komme!"], ["Não está cansado? — Não.", "Bist du nicht müde? — Nein."], ["O senhor tem dor? — Sim.", "Haben Sie Schmerzen? — Ja."], ["Vem junto, vai!", "Komm doch mit!"]],
    erros: [["Hast du keinen Hunger? — Ja, ich habe Hunger.", "Hast du keinen Hunger? — Doch, ich habe Hunger.", "Contrariar a negação = doch."]]
  });

  add({id: "uhrzeit", title: "Horas, dias e datas: um, am, im", short: "um + hora (um acht Uhr); am + dia e parte do dia (am Montag, am Abend); im + mês e estação (im Mai, im Sommer).",
    body: ["Hora exata: um. Dias, datas e partes do dia: am (am Montag, am 3. Mai, am Morgen; exceção: in der Nacht). Meses, estações e anos com palavra: im (im Juli, im Winter). Ano sozinho: sem preposição (2028).",
      "Hora informal: halb drei = 2:30 (meia para as três!), Viertel nach zwei = 2:15, Viertel vor drei = 2:45."],
    trap: ["Ich komme in Montag.", "Ich komme am Montag."],
    examples: [["Der Dienst beginnt um sieben Uhr.", "O plantão começa às sete."], ["Im Sommer ist es warm.", "No verão é quente."]],
    detect: c => /\b(um (ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|\d+)( uhr)?|um halb|am (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|wochenende|morgen|abend|vormittag|nachmittag)|im (januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|sommer|winter|frühling|herbst))\b/.test(low(c))}, {
    ideia: "Cada tipo de tempo tem a sua preposição: hora → um, dia → am, mês/estação → im.",
    macete: "Do menor para o maior: UM (relógio) → AM (dia) → IM (mês, estação). “Um acht Uhr am Montag im Mai.“",
    visual: {head: ["o quê", "preposição", "exemplo"], rows: [["hora", "[um]", "um acht Uhr, um halb drei"], ["dia da semana", "[am]", "am Montag, am Wochenende"], ["parte do dia", "[am]", "am Morgen, am Abend (mas: [in der] Nacht)"], ["data", "[am]", "am 24. Juli"], ["mês, estação", "[im]", "im Juli, im Winter"], ["ano", "—", "2028 / im Jahr 2028"]],
      nota: "halb drei = 2:30 (falta meia hora para as três). Viertel nach zwei = 2:15; Viertel vor drei = 2:45."},
    interativo: [{tipo: "complete", itens: [["Der Termin ist ___ Montag.", "am", "dia → am"], ["Ich komme ___ acht Uhr.", "um", "hora → um"], ["___ Sommer fahren wir weg.", "Im", "estação → im"], ["Mein Geburtstag ist ___ 24. Juli.", "am", "data → am"]]}, {tipo: "revelar", itens: [["às duas e meia", "um halb drei"], ["às quinze para as três", "um Viertel vor drei"], ["às duas e quinze", "um Viertel nach zwei"]]}],
    armadilha: {pt: "Às duas e meia.", errado: "Um halb zwei.", certo: "Um halb drei."},
    exemplos: [["[Um] sieben Uhr beginnt der Dienst.", "Às sete começa o plantão."], ["[Am] Wochenende habe ich frei.", "No fim de semana tenho folga."], ["[Im] Dezember ist es in Brasilien heiß.", "Em dezembro é quente no Brasil."]],
    hospital: ["Die Visite ist [um] halb neun.", "A visita médica é às oito e meia."],
    conversa: ["Em português usamos “às“, “na“, “em“ meio que livremente. Em alemão a escolha é fixa pelo tamanho do tempo: relógio = um, dia = am, mês e estação = im.",
      "O “halb“ engana todo brasileiro: “halb drei“ é 2:30, porque o alemão pensa “metade do caminho até as três“.",
      "Datas: “am 24. Juli“ lê-se “am vierundzwanzigsten Juli“ — o ponto depois do número indica ordinal."],
    treino: [["Às sete começa o plantão.", "Um sieben beginnt der Dienst."], ["Na segunda-feira tenho folga.", "Am Montag habe ich frei."], ["No verão é quente.", "Im Sommer ist es warm."], ["A consulta é às duas e meia.", "Der Termin ist um halb drei."], ["Meu aniversário é em julho.", "Mein Geburtstag ist im Juli."], ["À noite eu durmo.", "In der Nacht schlafe ich."], ["De manhã tomo café.", "Am Morgen trinke ich Kaffee."], ["No fim de semana vamos ao cinema.", "Am Wochenende gehen wir ins Kino."], ["A visita é às oito e meia.", "Die Visite ist um halb neun."], ["Em dezembro faz calor no Brasil.", "Im Dezember ist es in Brasilien heiß."]],
    erros: [["Ich komme in Montag.", "Ich komme am Montag.", "dia → am."], ["Der Termin ist am acht Uhr.", "Der Termin ist um acht Uhr.", "hora → um."]]
  });

  add({id: "praepakk", title: "Preposições sempre com acusativo", short: "durch, für, gegen, ohne, um (bis, entlang): depois delas, sempre acusativo.",
    body: ["Decore como “DOGFU“: Durch, Ohne, Gegen, Für, Um. Depois delas o masculino vira den/einen: für den Patienten, ohne einen Termin."],
    trap: ["Das ist für der Patient.", "Das ist für den Patienten."],
    examples: [["Das Geschenk ist für dich.", "O presente é para você."], ["Ich trinke Kaffee ohne Zucker.", "Tomo café sem açúcar."]],
    detect: c => /\b(für|ohne|gegen|durch)\b/.test(low(c))}, {
    ideia: "Cinco preposições pedem SEMPRE acusativo, sem pensar em movimento: durch, ohne, gegen, für, um.",
    macete: "DOGFU: Durch, Ohne, Gegen, Für, Um — e todas mandam o masculino para den/einen.",
    visual: {head: ["preposição", "sentido", "exemplo"], rows: [["[durch]", "através de, por", "durch [den] Park"], ["[ohne]", "sem", "ohne [einen] Termin"], ["[gegen]", "contra; por volta de", "Tabletten gegen [den] Schmerz"], ["[für]", "para, por", "für [den] Patienten"], ["[um]", "ao redor; às (hora)", "um [den] Tisch, um acht Uhr"]],
      nota: "Pronomes depois delas: für mich, ohne dich, gegen ihn."},
    interativo: [{tipo: "complete", itens: [["Das ist für ___ Chef. (o)", "den", "für + acusativo"], ["Ich komme ohne ___ Freundin. (minha)", "meine", "feminino não muda"], ["Haben Sie etwas gegen ___ Husten? (a)", "den", "der Husten → den"], ["Der Bus fährt durch ___ Stadt. (a)", "die", "die Stadt"]]}],
    armadilha: {pt: "Isso é para o paciente.", errado: "Das ist für der Patient.", certo: "Das ist für den Patienten."},
    exemplos: [["Das ist [für] dich.", "Isso é para você."], ["Kaffee [ohne] Zucker, bitte.", "Café sem açúcar, por favor."], ["Wir gehen [durch] den Park.", "Atravessamos o parque."]],
    hospital: ["Ich gebe Ihnen etwas [gegen] die Schmerzen.", "Vou lhe dar algo contra as dores."],
    conversa: ["Algumas preposições “casam“ com um caso para sempre. Estas cinco casam com o acusativo — não importa se há movimento ou não.",
      "Como o acusativo só aparece no masculino, o efeito prático é: depois de für/ohne/gegen/durch/um, der → den, ein → einen, er → ihn.",
      "gegen no hospital: “Tabletten gegen Kopfschmerzen“ (remédio PARA dor de cabeça) — em alemão o remédio é “contra“ a doença."],
    treino: [["Isso é para você.", "Das ist für dich."], ["Café sem açúcar.", "Kaffee ohne Zucker."], ["Vou lhe dar algo contra a dor.", "Ich gebe Ihnen etwas gegen die Schmerzen."], ["Atravessamos o parque.", "Wir gehen durch den Park."], ["O presente é para o meu pai.", "Das Geschenk ist für meinen Vater."], ["Venho sem o meu irmão.", "Ich komme ohne meinen Bruder."], ["Tem algo para tosse?", "Haben Sie etwas gegen Husten?"], ["Obrigado pela ajuda.", "Danke für die Hilfe."], ["Estou contra isso.", "Ich bin dagegen."], ["Sem consulta marcada não dá.", "Ohne Termin geht es nicht."]],
    erros: [["Das ist für der Patient.", "Das ist für den Patienten.", "für + acusativo: den Patienten."], ["Ich komme ohne mein Bruder.", "Ich komme ohne meinen Bruder.", "ohne + acusativo masculino: meinen."]]
  });

  add({id: "praepdat", title: "Preposições sempre com dativo", short: "aus, bei, mit, nach, seit, von, zu (e gegenüber): depois delas, sempre dativo.",
    body: ["Decore em ritmo: “aus, bei, mit, nach, seit, von, zu“. Depois delas: dem/einem (m, n), der/einer (f), den …n (plural). Contrações: zu dem = zum, zu der = zur, bei dem = beim, von dem = vom."],
    trap: ["Ich fahre mit der Bus.", "Ich fahre mit dem Bus."],
    examples: [["Ich wohne bei meinen Eltern.", "Moro com meus pais."], ["Seit einem Jahr lerne ich Deutsch.", "Há um ano aprendo alemão."]],
    detect: c => /\b(aus|bei|beim|mit|nach|seit|von|vom|zu|zum|zur)\s+(dem|der|den|einem|einer|meinem|meiner|meinen|ihrem|ihrer|seinem|seiner|unserem|unserer)\b/.test(low(c))}, {
    ideia: "Sete preposições pedem SEMPRE dativo: aus, bei, mit, nach, seit, von, zu.",
    macete: "Cante: “aus-bei-mit-nach-seit-von-zu“ — todas com dem/der/den…n. E as contrações: zum, zur, beim, vom.",
    visual: {head: ["preposição", "sentido", "exemplo"], rows: [["[aus]", "de (origem), de dentro", "aus [dem] Haus, aus Brasilien"], ["[bei]", "na casa de, junto a, em (empresa)", "bei [meinen] Eltern, [beim] Arzt"], ["[mit]", "com, de (meio)", "mit [dem] Bus"], ["[nach]", "depois de; para (cidade/país)", "nach [dem] Essen, nach Berlin"], ["[seit]", "desde, há (tempo)", "seit [einem] Jahr"], ["[von]", "de (quem/onde)", "von [der] Arbeit, [vom] Arzt"], ["[zu]", "para (pessoa/lugar)", "[zum] Arzt, [zur] Apotheke"]],
      nota: "seit + presente: “Ich wohne seit zwei Jahren hier“ = moro aqui há dois anos (e ainda moro)."},
    interativo: [{tipo: "complete", itens: [["Ich fahre mit ___ Bus. (o)", "dem", "mit + dativo"], ["Ich gehe ___ Arzt. (ao)", "zum", "zu dem = zum"], ["Seit zwei ___ wohne ich hier. (anos)", "Jahren", "dativo plural ganha -n"], ["Nach ___ Essen schlafe ich. (a comida)", "dem", "das Essen → dem"]]}],
    armadilha: {pt: "Moro aqui há dois anos.", errado: "Ich wohne hier seit zwei Jahre.", certo: "Ich wohne hier seit zwei Jahren."},
    exemplos: [["Ich komme [aus] Brasilien.", "Sou do Brasil."], ["Wir fahren [mit dem] Zug.", "Vamos de trem."], ["Ich gehe [zur] Apotheke.", "Vou à farmácia."]],
    hospital: ["[Seit wann] haben Sie die Beschwerden? — [Seit einer] Woche.", "Desde quando o senhor tem as queixas? — Há uma semana."],
    conversa: ["Assim como DOGFU é sempre acusativo, estas sete são sempre dativo. Não precisa pensar em movimento: viu mit, zu, bei… é dem/der.",
      "seit é o “há“ do português para algo que continua: “Ich habe seit drei Tagen Fieber“ = tenho febre há três dias (e ainda tenho). Repare no presente!",
      "zu × nach: zu para pessoas e lugares com artigo (zum Arzt, zur Bank); nach para cidades, países sem artigo e “nach Hause“."],
    treino: [["Vou de ônibus.", "Ich fahre mit dem Bus."], ["Moro com meus pais.", "Ich wohne bei meinen Eltern."], ["Sou do Brasil.", "Ich komme aus Brasilien."], ["Vou à farmácia.", "Ich gehe zur Apotheke."], ["Há uma semana tenho tosse.", "Seit einer Woche habe ich Husten."], ["Depois da comida eu durmo.", "Nach dem Essen schlafe ich."], ["Venho do trabalho.", "Ich komme von der Arbeit."], ["Estou no médico.", "Ich bin beim Arzt."], ["Moro aqui há dois anos.", "Ich wohne hier seit zwei Jahren."], ["Vou ao médico.", "Ich gehe zum Arzt."]],
    erros: [["Ich fahre mit der Zug.", "Ich fahre mit dem Zug.", "mit + dativo: dem Zug."], ["Ich habe seit drei Tage Fieber.", "Ich habe seit drei Tagen Fieber.", "Dativo plural: Tagen."]]
  });

  add({id: "richtung", title: "Para onde e onde: zum Arzt, nach Hause, zu Hause", short: "Para pessoas e lugares com artigo: zu (zum Arzt); cidades e países: nach (nach Berlin); casa: nach Hause (indo) × zu Hause (estando); prédios: in (ins Kino).",
    body: ["Ir até: zu + pessoa/empresa (zum Arzt, zu Maria), nach + cidade/país/casa (nach München, nach Hause), in + espaço onde se entra (ins Kino, in die Stadt).",
      "Estar em: bei + pessoa (beim Arzt, bei Maria), in + cidade/país/espaço (in München, im Kino), zu Hause."],
    trap: ["Ich gehe zu Hause.", "Ich gehe nach Hause."],
    examples: [["Ich gehe zum Arzt.", "Vou ao médico."], ["Ich bin beim Arzt.", "Estou no médico."]],
    detect: c => /\b(nach hause|zu hause|zum arzt|beim arzt|zur arbeit|nach (berlin|münchen|leipzig|deutschland|brasilien|curitiba))\b/.test(low(c))}, {
    ideia: "Ir PARA e estar EM usam palavras diferentes — e mudam conforme o destino: pessoa, cidade ou um lugar onde se entra.",
    macete: "Indo: ZU pessoa · NACH cidade/casa · IN prédio. Estando: BEI pessoa · IN cidade/prédio · ZU Hause.",
    visual: {head: ["destino", "Wohin? (indo)", "Wo? (estando)"], rows: [["pessoa, médico, empresa", "[zum] Arzt, [zu] Maria", "[beim] Arzt, [bei] Maria"], ["cidade, país", "[nach] Berlin, [nach] Deutschland", "[in] Berlin, [in] Deutschland"], ["casa", "[nach] Hause", "[zu] Hause"], ["lugar onde se entra", "[ins] Kino, [in die] Stadt", "[im] Kino, [in der] Stadt"], ["países com artigo", "[in die] Schweiz, [in die] USA", "[in der] Schweiz"]],
      nota: "Trabalho: zur Arbeit (indo), bei der Arbeit / auf der Arbeit (estando)."},
    interativo: [{tipo: "troca", estados: [{rotulo: "indo", de: "Ich gehe jetzt [nach Hause].", pt: "Vou para casa agora."}, {rotulo: "estando", de: "Ich bin jetzt [zu Hause].", pt: "Estou em casa agora."}]},
      {tipo: "complete", itens: [["Ich gehe ___ Arzt. (ao)", "zum", "pessoa → zu"], ["Wir fahren ___ Leipzig.", "nach", "cidade → nach"], ["Ich bin ___ Arzt. (no)", "beim", "estar com pessoa → bei"], ["Gehen wir ___ Kino?", "ins", "lugar onde se entra → in"]]}],
    armadilha: {pt: "Vou para casa.", errado: "Ich gehe zu Hause.", certo: "Ich gehe nach Hause."},
    exemplos: [["Am Samstag fahren wir [nach] Leipzig.", "No sábado vamos a Leipzig."], ["Ich bin heute [zu Hause].", "Hoje estou em casa."], ["Ich muss [zur] Bank.", "Preciso ir ao banco."]],
    hospital: ["Waren Sie schon [beim] Hausarzt?", "O senhor já foi ao médico de família?"],
    conversa: ["O português usa “para“ e “em“ para quase tudo. O alemão escolhe a preposição pelo TIPO de destino: pessoa (zu/bei), cidade e país (nach/in), espaço onde se entra (in).",
      "A dupla mais traiçoeira: nach Hause (indo para casa) × zu Hause (estando em casa). “Ich bin zu Hause“, “Ich gehe nach Hause“.",
      "zu e bei são do dativo, então: zum Arzt (zu dem), zur Apotheke (zu der), beim Arzt (bei dem)."],
    treino: [["Vou para casa.", "Ich gehe nach Hause."], ["Estou em casa.", "Ich bin zu Hause."], ["Vou ao médico.", "Ich gehe zum Arzt."], ["Estou no médico.", "Ich bin beim Arzt."], ["Vamos a Leipzig.", "Wir fahren nach Leipzig."], ["Moro em Curitiba.", "Ich wohne in Curitiba."], ["Vamos ao cinema?", "Gehen wir ins Kino?"], ["Preciso ir ao banco.", "Ich muss zur Bank."], ["Quero me mudar para a Alemanha.", "Ich will nach Deutschland ziehen."], ["Ela está na casa da mãe.", "Sie ist bei ihrer Mutter."]],
    erros: [["Ich gehe zu Hause.", "Ich gehe nach Hause.", "Indo para casa: nach Hause."], ["Ich fahre zu Berlin.", "Ich fahre nach Berlin.", "Cidade: nach."]]
  });

  add({id: "man", title: "man, jemand, niemand, etwas, nichts", short: "man = a gente/se (verbo como er): “Hier darf man nicht rauchen“. jemand/niemand = alguém/ninguém; etwas/nichts = algo/nada.",
    body: ["man é o sujeito genérico (o “se“ do português: “aqui se fala alemão“ = hier spricht man Deutsch). O verbo fica na forma de er.",
      "Uma negação só por frase: “Ich sehe niemanden“, nunca “Ich sehe nicht niemand“."],
    trap: ["Hier man darf nicht rauchen.", "Hier darf man nicht rauchen."],
    examples: [["Wie sagt man das auf Deutsch?", "Como se diz isso em alemão?"], ["Ist hier jemand?", "Tem alguém aqui?"]],
    detect: c => /\b(man|jemand|jemanden|niemand|niemanden)\b/.test(low(c))}, {
    ideia: "man é o “se“ ou “a gente“ genérico do português; jemand/niemand e etwas/nichts são alguém/ninguém e algo/nada.",
    macete: "man = “se“ com verbo de ER: “Man spricht Deutsch“ (fala-se alemão). E em alemão só UMA negação por frase.",
    visual: {head: ["alemão", "português", "exemplo"], rows: [["[man]", "se, a gente", "Wie sagt [man]…? (como se diz…?)"], ["[jemand]", "alguém", "Ist [jemand] da?"], ["[niemand]", "ninguém", "[Niemand] ist da."], ["[etwas]", "algo", "Möchten Sie [etwas] trinken?"], ["[nichts]", "nada", "Ich habe [nichts] gegessen."]],
      nota: "Acusativo: jemanden, niemanden (“Ich kenne niemanden hier“)."},
    interativo: [{tipo: "revelar", itens: [["Não vi ninguém.", "Ich habe niemanden gesehen."], ["Não comi nada.", "Ich habe nichts gegessen."], ["Ninguém sabe.", "Niemand weiß es."]]},
      {tipo: "complete", itens: [["Wie sagt ___ das auf Deutsch? (se)", "man", "sujeito genérico"], ["Ich habe ___ gegessen. (nada)", "nichts", "uma negação"], ["Ist hier ___? (alguém)", "jemand", "alguém"]]}],
    armadilha: {pt: "Eu não comi nada.", errado: "Ich habe nicht nichts gegessen.", certo: "Ich habe nichts gegessen."},
    exemplos: [["Hier darf [man] nicht parken.", "Aqui não se pode estacionar."], ["[Niemand] hat angerufen.", "Ninguém ligou."], ["Möchten Sie [etwas] trinken?", "O senhor quer beber algo?"]],
    hospital: ["Haben Sie heute schon [etwas] gegessen? — Nein, [nichts].", "O senhor já comeu algo hoje? — Não, nada."],
    conversa: ["Placas e regras em alemão usam muito man: “Hier darf man nicht rauchen“, “Wie schreibt man das?“. É o sujeito “todo mundo“.",
      "O português adora dupla negação (“não vi ninguém“, “não comi nada“). Em alemão, a palavra negativa basta: “Ich habe niemanden gesehen“. Juntar nicht + nichts vira o contrário ou soa errado."],
    treino: [["Como se diz isso em alemão?", "Wie sagt man das auf Deutsch?"], ["Tem alguém aqui?", "Ist hier jemand?"], ["Ninguém ligou.", "Niemand hat angerufen."], ["Eu não comi nada.", "Ich habe nichts gegessen."], ["O senhor quer beber algo?", "Möchten Sie etwas trinken?"], ["Aqui não se pode fumar.", "Hier darf man nicht rauchen."], ["Não conheço ninguém aqui.", "Ich kenne hier niemanden."], ["Como se escreve isso?", "Wie schreibt man das?"]],
    erros: [["Ich habe nicht nichts gesehen.", "Ich habe nichts gesehen.", "Só uma negação."], ["Hier man spricht Deutsch.", "Hier spricht man Deutsch.", "Verbo em 2º: Hier spricht man."]]
  });
})();
