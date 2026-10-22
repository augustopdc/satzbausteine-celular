"use strict";
/* Conversa · jogo “Was habe ich?” e trilha de missões “Chegada à Alemanha”.
   Jogo: o Gemma faz um paciente que NÃO sabe a própria doença (o prompt só tem os sintomas, então ele não tem como
   entregar a resposta); você pergunta e dá o diagnóstico; o acerto é conferido por regra (palavras-chave do caso).
   Missões: personagem com voz própria, um objetivo seu, um imprevisto no meio (só no prompt) e uma lista do que você
   precisa conseguir, marcada por regra nas suas falas (e à mão, se o app não reconhecer).
   Casos, falas e missões escritos pelo Claude: revisar com o tutor.
   Carregado depois de fsp.js e antes de app.js; usa o estado e as funções da Conversa só quando chamado. */

// ---------- “Was habe ich?” ----------
/* Cada caso: diagnóstico (de/pt), palavras-chave que valem como acerto (já sem trema, minúsculas) e fatos no formato da
   FSP [id, área, rótulo pt, fala do paciente], para reaproveitar a contagem de sintomas descobertos (fspFound). */
const WAS_CASOS = [
  {id: "erkaeltung", de: "eine Erkältung", pt: "resfriado", keys: ["erkalt", "grippal"], nome: "Herr Wagner", voz: "puck", artigo: "der Patient",
    queixa: "Mein Hals tut weh, und meine Nase läuft.", fatos: [
      ["inicio", "aktuell", "Desde quando", "Das hat vor zwei Tagen angefangen."],
      ["febre", "aktuell", "Febre", "Ich habe ein bisschen Fieber, 37,8 Grad."],
      ["tosse", "aktuell", "Tosse", "Ich huste ein bisschen, aber nicht viel."],
      ["cansaco", "aktuell", "Cansaço", "Ich bin müde, aber ich kann arbeiten."],
      ["contato", "sozial", "Contato", "Meine Kinder sind auch krank, im Kindergarten sind viele krank."],
      ["negados", "aktuell", "Sem falta de ar", "Ich habe keine Atemnot und keine Schmerzen in der Brust."]]},
  {id: "grippe", de: "eine Grippe", pt: "gripe (influenza)", keys: ["grippe", "influenza"], nome: "Frau Schulz", voz: "kore", artigo: "die Patientin",
    queixa: "Mir geht es sehr schlecht, ich habe hohes Fieber.", fatos: [
      ["inicio", "aktuell", "Início", "Es hat gestern ganz plötzlich angefangen."],
      ["febre", "aktuell", "Febre alta", "Heute Morgen hatte ich 39,5 Grad Fieber."],
      ["dores", "aktuell", "Dor no corpo", "Alles tut weh, die Arme, die Beine, der Rücken."],
      ["cabeca", "aktuell", "Dor de cabeça", "Ich habe auch starke Kopfschmerzen."],
      ["tosse", "aktuell", "Tosse seca", "Ich habe einen trockenen Husten."],
      ["fraqueza", "aktuell", "Fraqueza", "Ich bin so schwach, ich liege nur im Bett."],
      ["vacina", "vorerkr", "Vacina", "Ich habe dieses Jahr keine Impfung bekommen."]]},
  {id: "migraene", de: "eine Migräne", pt: "enxaqueca", keys: ["migran"], nome: "Frau Becker", voz: "leda", artigo: "die Patientin",
    queixa: "Ich habe wieder diese schlimmen Kopfschmerzen.", fatos: [
      ["lado", "aktuell", "Lado", "Der Schmerz ist nur links, hier an der Schläfe."],
      ["carater", "aktuell", "Pulsátil", "Es pocht, wie ein Herz im Kopf."],
      ["luz", "aktuell", "Luz e barulho", "Licht und Lärm sind ganz schlimm, ich will nur im Dunkeln liegen."],
      ["nausea", "aktuell", "Náusea", "Mir ist übel, aber ich habe nicht erbrochen."],
      ["aura", "aktuell", "Aura", "Vorher sehe ich immer so komische Zickzack-Linien."],
      ["frequencia", "aktuell", "Frequência", "Das habe ich ungefähr zweimal im Monat."],
      ["familia", "familie", "Família", "Meine Mutter hat das auch."]]},
  {id: "magendarm", de: "ein Magen-Darm-Infekt", pt: "gastroenterite", keys: ["magen-darm", "magen darm", "magendarm", "gastroenteritis", "darminfekt"], nome: "Herr Klein", voz: "fenrir", artigo: "der Patient",
    queixa: "Ich muss die ganze Zeit auf die Toilette.", fatos: [
      ["diarreia", "aktuell", "Diarreia", "Seit gestern Abend habe ich Durchfall, schon sechsmal."],
      ["vomito", "aktuell", "Vômito", "Ich habe auch zweimal erbrochen."],
      ["colica", "aktuell", "Cólica", "Ich habe Krämpfe im Bauch."],
      ["contato", "sozial", "Contato", "Meine Frau hat das seit Montag auch."],
      ["sangue", "aktuell", "Sem sangue", "Blut habe ich nicht gesehen."],
      ["liquido", "aktuell", "Pouco líquido", "Ich trinke nur wenig, weil mir übel ist."],
      ["febre", "aktuell", "Febre baixa", "Ich habe ein bisschen Fieber, 38 Grad."]]},
  {id: "heuschnupfen", de: "Heuschnupfen (eine Pollenallergie)", pt: "rinite alérgica (alergia a pólen)", keys: ["heuschnupfen", "pollen", "allerg"], nome: "Herr Neumann", voz: "orus", artigo: "der Patient",
    queixa: "Meine Augen jucken, und ich muss die ganze Zeit niesen.", fatos: [
      ["olhos", "aktuell", "Olhos", "Meine Augen sind rot und tränen."],
      ["nariz", "aktuell", "Nariz", "Meine Nase läuft, aber das ist ganz klar, wie Wasser."],
      ["epoca", "aktuell", "Época", "Das habe ich jedes Jahr im Frühling."],
      ["fora", "aktuell", "Pior fora de casa", "Draußen im Park ist es viel schlimmer."],
      ["febre", "aktuell", "Sem febre", "Fieber habe ich nicht."],
      ["tosse", "aktuell", "Sem tosse", "Ich huste nicht."]]},
  {id: "hexenschuss", de: "ein Hexenschuss", pt: "lumbago (dor lombar aguda)", keys: ["hexenschuss", "lumbago", "lumbalg"], nome: "Herr Hoffmann", voz: "charon", artigo: "der Patient",
    queixa: "Ich habe plötzlich starke Schmerzen im Rücken.", fatos: [
      ["inicio", "aktuell", "Como começou", "Heute Morgen habe ich eine schwere Kiste gehoben, und dann kam der Schmerz."],
      ["local", "aktuell", "Onde", "Es tut unten im Rücken weh, hier."],
      ["movimento", "aktuell", "Movimento", "Ich kann mich kaum bewegen, ich gehe ganz langsam."],
      ["perna", "aktuell", "Sem irradiar", "Der Schmerz geht nicht ins Bein."],
      ["sensibilidade", "aktuell", "Sem dormência", "Meine Beine fühlen sich normal an."],
      ["banheiro", "aktuell", "Banheiro normal", "Auf der Toilette ist alles normal."]]},
  {id: "verstauchung", de: "eine Verstauchung", pt: "entorse", keys: ["verstauch", "distorsion", "banderdehnung", "bandverletzung", "zerrung"], nome: "Herr Fischer", voz: "puck", artigo: "der Patient",
    queixa: "Mein Fuß tut weh, ich kann nicht gut laufen.", fatos: [
      ["como", "aktuell", "Como foi", "Ich bin beim Fußball umgeknickt."],
      ["quando", "aktuell", "Quando", "Das war gestern Abend."],
      ["local", "aktuell", "Onde", "Es ist der rechte Knöchel, außen."],
      ["inchaco", "aktuell", "Inchaço", "Der Knöchel ist dick und ein bisschen blau."],
      ["apoio", "aktuell", "Consegue pisar", "Ich kann auftreten, aber es tut weh."],
      ["gelo", "aktuell", "Gelo", "Ich habe gestern Eis gemacht."]]},
  {id: "blase", de: "eine Blasenentzündung", pt: "cistite (infecção urinária)", keys: ["blasenentzund", "harnwegsinfekt", "zystitis", "blaseninfekt", "harnweginfekt"], nome: "Frau Weber", voz: "aoede", artigo: "die Patientin",
    queixa: "Es brennt, wenn ich auf die Toilette gehe.", fatos: [
      ["frequencia", "aktuell", "Vai muito ao banheiro", "Ich muss ganz oft auf die Toilette, aber es kommt nur wenig."],
      ["inicio", "aktuell", "Desde quando", "Das habe ich seit gestern."],
      ["local", "aktuell", "Dor", "Unten im Bauch drückt es ein bisschen."],
      ["febre", "aktuell", "Sem febre", "Fieber habe ich nicht."],
      ["costas", "aktuell", "Sem dor nas costas", "Der Rücken tut nicht weh."],
      ["antes", "vorerkr", "Já teve", "Das hatte ich vor zwei Jahren schon einmal."]]},
  {id: "bindehaut", de: "eine Bindehautentzündung", pt: "conjuntivite", keys: ["bindehaut", "konjunktivitis"], nome: "Frau Richter", voz: "zephyr", artigo: "die Patientin",
    queixa: "Mein Auge ist ganz rot.", fatos: [
      ["qual", "aktuell", "Qual olho", "Es ist das rechte Auge."],
      ["coceira", "aktuell", "Coceira", "Es juckt und brennt."],
      ["manha", "aktuell", "Grudado de manhã", "Am Morgen ist das Auge ganz verklebt."],
      ["secrecao", "aktuell", "Secreção", "Da kommt so gelbes Zeug raus."],
      ["visao", "aktuell", "Visão normal", "Ich sehe aber ganz normal."],
      ["contato", "sozial", "Contato", "Mein Sohn hatte das letzte Woche."]]},
  {id: "kater", de: "ein Kater", pt: "ressaca", keys: ["kater", "hangover", "alkohol", "zu viel getrunken"], nome: "Herr Krüger", voz: "fenrir", artigo: "der Patient",
    queixa: "Mein Kopf tut so weh, und mir ist schlecht.", fatos: [
      ["festa", "sozial", "Festa", "Gestern war die Geburtstagsparty von meinem Freund."],
      ["bebida", "sozial", "Bebida", "Ich habe viel Bier getrunken und dann noch Schnaps."],
      ["sede", "aktuell", "Sede", "Ich habe so großen Durst."],
      ["luz", "aktuell", "Luz", "Das Licht ist so hell, das tut weh."],
      ["sono", "aktuell", "Pouco sono", "Ich habe nur drei Stunden geschlafen."],
      ["vergonha", "aktuell", "Vergonha", "Ich weiß nicht mehr alles von gestern Abend."]]},
  {id: "sonnenbrand", de: "ein Sonnenbrand", pt: "queimadura de sol", keys: ["sonnenbrand"], nome: "Frau Lange", voz: "kore", artigo: "die Patientin",
    queixa: "Meine Haut tut weh, sie ist ganz rot.", fatos: [
      ["local", "aktuell", "Onde", "Es sind die Schultern und der Rücken."],
      ["quando", "aktuell", "Ontem", "Gestern war ich den ganzen Tag am See."],
      ["protetor", "aktuell", "Sem protetor", "Ich hatte keine Sonnencreme dabei."],
      ["toque", "aktuell", "Dói ao tocar", "Wenn man die Haut anfasst, tut es sehr weh."],
      ["calor", "aktuell", "Pele quente", "Die Haut ist ganz heiß."],
      ["bolhas", "aktuell", "Bolhas", "Ich habe auch ein paar kleine Blasen."]]}];
const wasNorm = s => String(s || "").toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
/* Que caso o texto nomeia (o primeiro que bater), ou null. */
function wasGuess(text) {
  const t = wasNorm(text);
  return WAS_CASOS.find(c => c.keys.some(k => t.includes(k))) || null;
}
/* Sorteia um caso ainda não resolvido (ou qualquer um, se já resolveu todos), evitando o último jogado. */
function wasPick(rand = Math.random) {
  const sessions = convData().sessions.filter(s => s.game), solved = new Set(sessions.filter(s => s.game.solved).map(s => s.game.id));
  const last = sessions.length ? sessions[sessions.length - 1].game.id : "";
  let pool = WAS_CASOS.filter(c => !solved.has(c.id) && c.id !== last);
  if (!pool.length) pool = WAS_CASOS.filter(c => c.id !== last);
  return pool[Math.floor(rand() * pool.length)];
}
function wasTopic(caso) {
  return {id: "was-" + caso.id, group: "Jogo", level: "A1", pt: "Was habe ich?", role: caso.artigo + " " + caso.nome, rolePt: caso.nome,
    sie: true, voice: caso.voz, game: caso};
}
function wasPrompt(topic, level) {
  const c = topic.game, female = c.artigo === "die Patientin";
  return [`You are ${c.nome}, ${female ? "a female" : "a male"} patient at a family doctor's practice (Hausarztpraxis) in Germany. Luiz, a Brazilian doctor who is learning German (level ${level}), is the doctor. This is a guessing game: he asks questions to find out what you have.`,
    "You do NOT know what illness you have. These are the ONLY facts about you. Never invent other symptoms, illnesses, medicines or numbers. If he asks about something that is not in the list, say it is normal, you do not have it, or you do not know:",
    ...c.fatos.map(f => "- " + f[3]),
    "Rules:",
    `- Your first turn: greet the doctor, say only your main complaint ("${c.queixa}") and ask: "Was habe ich, Herr Doktor?"`,
    "- Answer ONLY what he asks, in 1 or 2 short sentences. Never tell facts he has not asked about. If he asks a general question (\"Haben Sie noch andere Beschwerden?\"), tell only one more fact.",
    "- Speak like a normal patient with everyday words, never medical terms, and never name an illness yourself.",
    "- If he tells you what you have, you cannot know if it is right: just react briefly (for example \"Ah, okay. Ist das schlimm?\") and answer his next question.",
    "- Use \"Sie\" with the doctor. Do not correct his German and do not explain grammar. If you do not understand him, say \"Wie bitte?\".",
    "- Speak ONLY German. " + (CONV_LEVEL_RULES[level] || CONV_LEVEL_RULES.A1).replace(/at most \d( or \d)? (short )?sentences per turn/, "at most 2 short sentences per turn"),
    "- Luiz's messages are transcribed speech: ignore capitalization and punctuation.",
    "- No emojis, no English, no Portuguese, no lists, no markdown."].join("\n");
}

// ---------- Missões “Chegada à Alemanha” ----------
/* Metas: [id, rótulo pt, expressão regular aplicada às suas falas já sem trema e em minúsculas]. */
const MISSOES = [
  {id: "m-anmeldung", level: "A1", pt: "Anmeldung no Bürgeramt", rolePt: "Atendente", voice: "kore",
    role: "eine Sachbearbeiterin im Bürgeramt", setting: "Luiz ist neu in der Stadt und möchte seine Wohnung anmelden. Er hat einen Termin.",
    missao: "Registrar o seu endereço novo (Anmeldung).",
    twist: "When Luiz gives his documents, tell him that the Wohnungsgeberbestätigung (the confirmation from the landlord) is missing. If he asks what he can do, explain that he can bring it later by e-mail or make a new appointment.",
    metas: [["pedido", "Dizer que quer se registrar", /anmeld/],
      ["docs", "Entregar os documentos", /pass|ausweis|mietvertrag|dokument|unterlagen|formular/],
      ["endereco", "Dizer o endereço", /strasse|str\b|weg\b|platz|hausnummer|nummer \d|\d{5}/],
      ["solucao", "Perguntar o que fazer com o papel que falta", /was kann ich|was soll ich|nachreichen|spater|nochmal|neuen termin|per (e-?mail|mail)|schicken/]]},
  {id: "m-wohnung", level: "A2", pt: "Visitar um apartamento", rolePt: "Proprietário", voice: "orus",
    role: "der Vermieter einer Zweizimmerwohnung", setting: "Luiz besichtigt die Wohnung und möchte sie gern mieten.",
    missao: "Saber o essencial do apartamento e ficar com ele.",
    twist: "After a few questions, mention that another person is also very interested and that you need his documents (Gehaltsnachweis and SCHUFA) quickly. React positively if he offers to send them soon.",
    metas: [["aluguel", "Perguntar o aluguel", /miete|kostet|warm|kalt|nebenkosten|euro/],
      ["quando", "Perguntar desde quando está livre", /ab wann|frei|einziehen|einzug/],
      ["casa", "Perguntar sobre algo da casa", /kuche|balkon|heizung|waschmaschine|internet|keller|bad\b|badezimmer/],
      ["trabalho", "Contar o seu trabalho", /arzt|krankenhaus|klinik|arbeite/],
      ["proximo", "Combinar o envio dos documentos", /schicke|sende|unterlagen|dokumente|morgen|heute noch|e-?mail/]]},
  {id: "m-bank", level: "A2", pt: "Abrir conta no banco", rolePt: "Gerente", voice: "leda",
    role: "eine Bankberaterin", setting: "Luiz möchte ein Girokonto eröffnen.",
    missao: "Abrir uma conta corrente e entender quanto custa.",
    twist: "Ask him for his Meldebescheinigung (proof of address registration). If he does not have it with him, tell him he can upload it later in the app, and the account is opened when it arrives.",
    metas: [["conta", "Dizer que quer abrir uma conta", /konto|eroffn/],
      ["custo", "Perguntar quanto custa", /kostet|gebuhr|kostenlos|im monat|pro monat|euro/],
      ["cartao", "Perguntar pelo cartão", /karte|girocard|kreditkarte/],
      ["app", "Perguntar pelo app ou online", /\bapp\b|online|handy/],
      ["registro", "Resolver a Meldebescheinigung", /meldebescheinigung|anmeldung|hochladen|spater|nachreichen/]]},
  {id: "m-krankenkasse", level: "A2", pt: "Krankenkasse por telefone", rolePt: "Atendente", voice: "puck",
    role: "ein Mitarbeiter einer gesetzlichen Krankenkasse am Telefon", setting: "Luiz ruft an. Er fängt bald als Arzt in einem Krankenhaus an und braucht eine Krankenversicherung.",
    missao: "Entrar no plano de saúde público antes de começar a trabalhar.",
    twist: "When everything is almost clear, tell him that for the health card (Gesundheitskarte) you still need a passport photo, which he can upload in the app.",
    metas: [["motivo", "Dizer que vai trabalhar como médico", /arzt|krankenhaus|klinik|arbeit|stelle/],
      ["entrar", "Pedir para ser segurado", /mitglied|versicher|anmelden/],
      ["docs", "Perguntar que documentos precisa", /unterlagen|dokument|brauche|brauchen sie/],
      ["cartao", "Perguntar pelo cartão do plano", /karte/],
      ["foto", "Resolver a foto", /foto|bild|hochladen/]]},
  {id: "m-handy", level: "A1", pt: "Contrato de celular", rolePt: "Vendedor", voice: "fenrir",
    role: "ein Verkäufer in einem Handyladen", setting: "Luiz braucht eine deutsche Handynummer mit Internet.",
    missao: "Conseguir um chip com internet sem ficar preso a contrato longo.",
    twist: "Your first offer is cheap but has a minimum term of 24 months. Only if he asks, offer a monthly cancellable tariff or prepaid (a bit more expensive).",
    metas: [["pedido", "Dizer o que precisa", /sim|nummer|vertrag|prepaid|tarif|handy/],
      ["preco", "Perguntar o preço", /kostet|preis|euro|im monat|pro monat/],
      ["internet", "Perguntar pela internet", /internet|daten|\bgb\b|gigabyte/],
      ["prazo", "Perguntar a duração do contrato", /laufzeit|monate|kundig|wie lange/],
      ["flexivel", "Pedir uma opção sem prazo longo", /monatlich|kundbar|ohne vertrag|prepaid|ohne laufzeit/]]},
  {id: "m-auslaenderbehoerde", level: "A2", pt: "Ausländerbehörde", rolePt: "Atendente", voice: "charon",
    role: "ein Sachbearbeiter in der Ausländerbehörde", setting: "Luiz hat einen Termin für seinen Aufenthaltstitel zum Arbeiten.",
    missao: "Pedir o visto de residência para trabalhar.",
    twist: "When he talks about his work, ask for his Approbation. He only has the Berufserlaubnis (temporary permission to work as a doctor) so far: if he says so, accept it for now and tell him to bring the Approbation later.",
    metas: [["motivo", "Dizer o motivo da visita", /aufenthalt|visum|arbeitserlaubnis|blaue karte|titel/],
      ["trabalho", "Dizer onde vai trabalhar", /arzt|krankenhaus|klinik|arbeitsvertrag/],
      ["documento", "Explicar a Berufserlaubnis", /berufserlaubnis|approbation/],
      ["prazo", "Perguntar quanto tempo demora", /wie lange|dauert|wochen|wann/],
      ["trazer", "Perguntar o que trazer depois", /mitbringen|bringen|unterlagen|dokument|schicken/]]},
  {id: "m-approbation", level: "A2", pt: "Ligar sobre a Approbation", rolePt: "Atendente", voice: "zephyr",
    role: "eine Sachbearbeiterin im Landesprüfungsamt (Approbationsbehörde) am Telefon", setting: "Luiz hat vor drei Monaten seinen Antrag auf Approbation gestellt und ruft an.",
    missao: "Saber como está o seu pedido de Approbation e da FSP.",
    twist: "When you look at his file, tell him that one document is missing: the certified translation (beglaubigte Übersetzung) of his diploma. Explain he can send it by post.",
    metas: [["apresentar", "Dizer nome e que é médico do Brasil", /arzt|brasilien|mein name|ich heisse/],
      ["status", "Perguntar como está o pedido", /stand|antrag|bearbeit|wie weit|status/],
      ["fsp", "Perguntar pela Fachsprachprüfung", /fachsprach|fsp|prufung/],
      ["numero", "Dar ou pedir o número do processo", /aktenzeichen|nummer|vorgang/],
      ["faltando", "Resolver o documento que falta", /ubersetzung|beglaubig|schicke|nachreichen|post/]]},
  {id: "m-hausarzt", level: "A1", pt: "Primeira vez no médico de família", rolePt: "Recepcionista", voice: "aoede",
    role: "eine medizinische Fachangestellte (MFA) am Empfang einer Hausarztpraxis", setting: "Luiz kommt zum ersten Mal in die Praxis und möchte einen Termin.",
    missao: "Se cadastrar como paciente novo e conseguir ser atendido.",
    twist: "This week there are no appointments. Offer the open consultation hour (offene Sprechstunde) tomorrow at 8 o'clock, with some waiting time.",
    metas: [["novo", "Dizer que é paciente novo", /neu|erste[sn]? mal/],
      ["plano", "Mostrar o plano de saúde", /krankenkasse|karte|versichert|versicherung/],
      ["queixa", "Dizer o que tem", /schmerz|husten|fieber|check|untersuch|blut|impf|tut weh/],
      ["horario", "Pedir um horário", /termin|wann|uhr|montag|dienstag|mittwoch|donnerstag|freitag|morgen/],
      ["aceitar", "Resolver a falta de horário", /sprechstunde|morgen|warten|acht|8 uhr|ok|gut|passt/]]}];
function missionTopic(m) { return {...m, group: "Missão", sie: true, mission: m}; }
function missionGoals(m, turns) {
  const said = turns.filter(t => t.who === "me").map(t => wasNorm(t.de)).join("\n");
  return new Set(m.metas.filter(([, , re]) => re.test(said)).map(([id]) => id));
}
function missionPromptLines(topic) {
  const m = topic.mission;
  return ["What Luiz must achieve (do not tell him, but give him the chance): " + m.metas.map(x => x[1]).join("; ") + ".",
    "Complication, after Luiz's second or third answer: " + m.twist,
    "Be realistic and polite, a bit busy. Do not solve everything for him: let him ask."];
}

// ---------- Estado na sala da Conversa ----------
const mis = {topic: null, tries: [], solved: null, manual: new Set(), reveal: false};
function missionReset(topic) { Object.assign(mis, {topic: topic && (topic.game || topic.mission) ? topic : null, tries: [], solved: null, manual: new Set(), reveal: false}); missionRender(); }
/* Depois de cada fala sua: no jogo, um diagnóstico certo dito na conversa já vale; nas missões, a lista se marca sozinha. */
function missionAfterTurn(turn) {
  if (!mis.topic) return;
  if (mis.topic.game && !mis.solved && !mis.reveal) {
    const g = wasGuess(turn.de);
    if (g && g.id === mis.topic.game.id) wasSolve();
  }
  missionRender();
}
function wasQuestions() { return conv.turns.filter(t => t.who === "me").length; }
function wasSolve() { mis.solved = {questions: wasQuestions()}; toast("Acertou! Era " + mis.topic.game.pt + ".", "success"); }
function wasTry(text) {
  const g = wasGuess(text), c = mis.topic.game;
  if (!convClean(text)) return;
  if (g && g.id === c.id) { mis.tries.push(text); wasSolve(); }
  else if (g) { mis.tries.push(text); toast("Não é " + g.pt + ". Pergunte mais um pouco.", "info"); }
  else { toast("Não reconheci um diagnóstico. Escreva o nome da doença em alemão (ex.: eine Grippe).", "info"); return; }
  if (!mis.solved && mis.tries.length >= 3) mis.reveal = true;
  missionRender();
}
function missionRender() {
  const box = $("convMission");
  if (!box) return;
  if (!mis.topic) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  if (mis.topic.game) {
    const c = mis.topic.game, found = fspFound(c, conv.turns).size;
    const input = h("input", {type: "text", lang: "de", placeholder: "Seu diagnóstico em alemão: Sie haben …", "aria-label": "Seu diagnóstico em alemão"});
    const send = () => { wasTry(input.value); input.value = ""; };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });
    const done = mis.solved || mis.reveal;
    fill(box, h("div", {class: "mis-head"},
      h("p", {class: "label", text: "Jogo do diagnóstico"}),
      h("p", {class: "mis-stat"}, h("b", {text: String(found)}), " de " + c.fatos.length + " sintomas descobertos, " + wasQuestions() + (wasQuestions() === 1 ? " pergunta" : " perguntas"))),
      done ? h("div", {class: "mis-result" + (mis.solved ? " ok" : "")},
        h("p", null, mis.solved ? "Acertou com " + mis.solved.questions + (mis.solved.questions === 1 ? " pergunta: " : " perguntas: ") : "Era ", h("b", {lang: "de", text: c.de}), " (" + c.pt + ")."),
        h("div", {class: "row"}, h("button", {class: "small", type: "button", onclick: () => openConversaTopic(wasTopic(wasPick()))}, "Outro paciente"),
          h("span", {class: "muted small-text", text: "Toque em “Terminar e ver erros” para ver o seu alemão."})))
        : h("div", {class: "row mis-guess"}, input, h("button", {class: "primary small", type: "button", onclick: send}, "Dar o diagnóstico"),
          h("span", {class: "muted small-text", text: (3 - mis.tries.length) + (3 - mis.tries.length === 1 ? " tentativa" : " tentativas")}),
          h("button", {class: "quiet small", type: "button", onclick: () => { mis.reveal = true; missionRender(); }}, "Desistir")));
    return;
  }
  const m = mis.topic.mission, auto = missionGoals(m, conv.turns), done = id => auto.has(id) || mis.manual.has(id);
  const n = m.metas.filter(([id]) => done(id)).length;
  fill(box, h("div", {class: "mis-head"},
    h("p", {class: "label", text: "Sua missão"}),
    h("p", {class: "mis-goal", text: m.missao}),
    h("p", {class: "mis-stat"}, h("b", {text: String(n)}), " de " + m.metas.length)),
  h("ul", {class: "mis-list"}, ...m.metas.map(([id, label]) => h("li", null,
    h("button", {class: "mis-item" + (done(id) ? " on" : ""), type: "button", "aria-pressed": String(done(id)),
      title: auto.has(id) ? "O app reconheceu nas suas falas" : "Toque para marcar se você fez e o app não reconheceu",
      onclick: () => { if (auto.has(id)) return; mis.manual.has(id) ? mis.manual.delete(id) : mis.manual.add(id); missionRender(); }},
      h("span", {class: "mis-box"}, done(id) ? icon("check", 13) : null), h("span", {text: label}))))),
  n === m.metas.length ? h("p", {class: "mis-done", text: "Missão cumprida. Termine quando a conversa fechar naturalmente."}) : null);
}
/* O que vai junto da sessão salva (jogo: caso e resultado; missão: metas cumpridas). */
function missionSessionExtra() {
  if (!mis.topic) return {};
  if (mis.topic.game) return {game: {id: mis.topic.game.id, solved: !!mis.solved, questions: wasQuestions(), tries: mis.tries.length}};
  const m = mis.topic.mission, auto = missionGoals(m, conv.turns);
  return {mission: {done: m.metas.filter(([id]) => auto.has(id) || mis.manual.has(id)).length, total: m.metas.length}};
}
function missionSummaryNode() {
  if (!mis.topic) return null;
  if (mis.topic.game) {
    const c = mis.topic.game;
    return h("p", {class: "mis-result" + (mis.solved ? " ok" : "")}, mis.solved ? "Diagnóstico certo com " + mis.solved.questions + " perguntas: " : "Diagnóstico: ", h("b", {lang: "de", text: c.de}), " (" + c.pt + ").");
  }
  const x = missionSessionExtra().mission;
  return h("p", {class: "mis-result" + (x.done === x.total ? " ok" : "")}, "Missão: " + x.done + " de " + x.total + " metas.");
}

// ---------- Escolha na tela da Conversa ----------
function missionSetupNode() {
  const sessions = convData().sessions, ok = !!(conv.status && conv.status.installed);
  const solved = new Set(sessions.filter(s => s.game && s.game.solved).map(s => s.game.id));
  const best = id => sessions.filter(s => s.topic === id && s.mission).reduce((m, s) => Math.max(m, s.mission.done / Math.max(1, s.mission.total)), -1);
  return [
    h("section", {class: "scene-group"},
      ...titled("h2", "Was habe ich?", "Jogo do diagnóstico: um paciente chega com uma queixa e não sabe o que tem. Faça perguntas em alemão, descubra os sintomas e dê o diagnóstico (3 tentativas)."),
      h("div", {class: "row"}, h("button", {class: "primary", type: "button", disabled: !ok, onclick: () => openConversaTopic(wasTopic(wasPick()))}, "Atender um paciente"),
        h("span", {class: "muted small-text", text: solved.size + " de " + WAS_CASOS.length + " casos resolvidos"}))),
    h("section", {class: "scene-group"},
      ...titled("h2", "Chegada à Alemanha", "Missões com situações reais da mudança. Cada uma tem um objetivo, um imprevisto no meio e uma lista do que você precisa conseguir, marcada sozinha conforme você fala."),
      h("div", {class: "scene-grid"}, ...MISSOES.map(m => {
        const b = best(m.id);
        return h("article", {class: "scene-card"},
          h("div", {class: "scene-top"}, h("span", {class: "tag", text: m.level}), h("span", {class: "tag", text: "Sie"}), b >= 1 ? h("span", {class: "tag ok", text: "cumprida"}) : b >= 0 ? h("span", {class: "tag", text: Math.round(b * 100) + "%"}) : null),
          h("h3", {text: m.pt}),
          h("p", {class: "muted small-text", text: m.missao}),
          h("div", {class: "row"}, h("button", {class: "primary small", type: "button", disabled: !ok, onclick: () => openConversaTopic(missionTopic(m))}, "Começar")));
      })))];
}
