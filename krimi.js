"use strict";
/* Krimi interativo (23/11/2026, pedido em _dev/.cache/PEDIDO-FUNCIONALIDADES.md, etapa 4): um mistério curto com três
   suspeitos. Cada suspeito é uma conversa à parte (o Gemma só faz o personagem e só sabe a própria ficha); um deles tem um
   álibi que bate de frente com uma pista e com o relato de outra pessoa. Resolver é por regra (krimiEvaluate): dizer em
   alemão quem mente E o que entrega a mentira. Sem múltipla escolha. Casos escritos pelo Claude: revisar com o tutor.
   Carregado depois de plantao-clinico.js e antes de app.js; usa o estado e as funções da Conversa só quando chamado. */

const KRIMI_CASOS = [
  {id: "station4", level: "A2", tituloPt: "Plantão noturno na ala 4", tituloDe: "Nachtdienst auf Station 4",
    aberturaDe: "Heute Nacht hat jemand zwischen 2:00 und 2:30 Uhr die Apotheke auf Station 4 geöffnet, mit einem Ersatzausweis. Danach stand der Kühlschrank mit den Medikamentenproben offen. Drei Personen waren auf der Station.",
    aberturaPt: "Esta noite, entre 2h e 2h30, alguém abriu a farmácia da ala 4 com um crachá reserva. Depois disso, a geladeira das amostras de remédio ficou aberta. Três pessoas estavam no andar.",
    situacaoEn: "Tonight between 02:00 and 02:30 someone opened the locked pharmacy room on ward 4 of a German hospital with a spare badge and left the fridge with medicine samples open. Three people were on the ward. Luiz, a doctor, is asking questions to find out who did it.",
    pistas: [
      {de: "Türprotokoll der Apotheke: Ersatzausweis 3, Tür geöffnet um 02:14 Uhr.", pt: "Registro da porta da farmácia: crachá reserva 3, porta aberta às 2h14."},
      {de: "Rufanlage: Zimmer 12 hat um 01:40 Uhr geklingelt. Danach hat in dieser Nacht kein Zimmer mehr geklingelt.", pt: "Sistema de chamada: o quarto 12 chamou à 1h40. Depois disso, nenhum quarto chamou naquela noite."}],
    suspeitos: [
      {id: "jonas", nome: "Jonas Weber", papelPt: "Enfermeiro do plantão", papelDe: "der Pfleger im Nachtdienst", voz: "orus", keys: ["jonas", "weber", "pfleger"],
        fatosDe: ["Ich habe Nachtdienst von 22 bis 6 Uhr.", "Um 2 Uhr hat die Patientin in Zimmer 12 geklingelt. Ich war bis halb drei bei ihr.",
          "Den Ersatzausweis kenne ich. Er liegt im Stationszimmer in der Schublade.", "Ich trinke nachts viel Kaffee."],
        mentiraInfoEn: "You are the culprit. At 02:14 you opened the pharmacy with spare badge 3 to take a sample of an expensive cream for your mother, and you forgot to close the fridge. Your lie: you say you were with the patient in room 12 from 02:00 to 02:30 because she rang the bell. Keep this lie. If Luiz tells you that the call system shows room 12 rang only at 01:40, or that someone saw you in the corridor at 02:10, get nervous and give a weak excuse, but do not fully confess."},
      {id: "mira", nome: "Dr. Mira Lang", papelPt: "Médica residente", papelDe: "die Assistenzärztin", voz: "kore", keys: ["mira", "frau lang", "dr. lang", "dr lang", "doktor lang", "assistenzarztin"],
        fatosDe: ["Von halb zwei bis 2:40 Uhr war ich unten in der Notaufnahme, bei einem neuen Patienten.", "Meinen eigenen Ausweis hatte ich die ganze Zeit bei mir.",
          "Auf Station 4 war ich erst wieder um Viertel vor drei.", "Die Kollegen in der Notaufnahme haben mich gesehen."],
        mentiraInfoEn: "You are innocent and tell the truth. You were in the emergency department from 01:30 to 02:40 and saw nothing on ward 4 in that time. You are tired and a little impatient, but polite."},
      {id: "kaya", nome: "Herr Kaya", papelPt: "Funcionário da limpeza", papelDe: "die Reinigungskraft", voz: "fenrir", keys: ["kaya", "reinigung", "putzmann"],
        fatosDe: ["Ich putze nachts die Flure, von Station 3 bis Station 5.", "Um zehn nach zwei habe ich Jonas im Flur gesehen. Er ist in Richtung Apotheke gegangen, mit einer Tasse Kaffee.",
          "Frau Dr. Lang habe ich in der Nacht nicht gesehen.", "Ich habe keinen Schlüssel und keinen Ausweis für die Apotheke."],
        mentiraInfoEn: "You are innocent and tell the truth. Only say that you saw Jonas at 02:10 if Luiz asks whom you saw or what you saw in the corridor. You like Jonas and do not want to get him into trouble, so you hesitate a little, but you never lie."}],
    solucao: {culpado: "jonas", culpadoKeys: ["jonas", "weber", "pfleger"],
      contradicaoKeys: ["klingel", "rufanlage", "1:40", "1.40", "01:40", "eins vierzig", "zehn nach zwei", "2:10", "02:10", "kaya", "flur"],
      explicacaoPt: "Jonas diz que ficou com a paciente do quarto 12 das 2h às 2h30 porque ela chamou. Mas o sistema de chamada mostra que o quarto 12 chamou só à 1h40, e o Herr Kaya o viu às 2h10 indo para a farmácia. A porta abriu às 2h14.",
      explicacaoDe: "Jonas sagt, er war von 2 bis halb 3 in Zimmer 12, weil die Patientin geklingelt hat. Aber die Rufanlage zeigt: Zimmer 12 hat nur um 1:40 Uhr geklingelt. Und Herr Kaya hat ihn um zehn nach zwei auf dem Weg zur Apotheke gesehen."}},
  {id: "nachtzug", level: "A2", tituloPt: "Trem noturno para Munique", tituloDe: "Nachtzug nach München",
    aberturaDe: "Im Nachtzug nach München ist ein silberner Koffer mit einem Prototyp aus Kabine 7 verschwunden. Es war beim Halt in Würzburg, zehn Minuten lang. Draußen hat es stark geschneit.",
    aberturaPt: "No trem noturno para Munique, uma maleta prateada com um protótipo sumiu da cabine 7. Foi na parada de dez minutos em Würzburg. Lá fora nevava forte.",
    situacaoEn: "On a night train to Munich, a silver suitcase with a technical prototype disappeared from compartment 7 during the ten-minute stop in Würzburg (23:08 to 23:18). Outside it was snowing heavily. Luiz, a passenger who wants to help the owner, questions three people.",
    pistas: [
      {de: "Halt in Würzburg: 23:08 bis 23:18 Uhr. Um 23:05 Uhr stand der Koffer noch in Kabine 7, um 23:20 Uhr war er weg.", pt: "Parada em Würzburg: das 23h08 às 23h18. Às 23h05 a maleta ainda estava na cabine 7; às 23h20 tinha sumido."},
      {de: "Wetter in Würzburg um 23:10 Uhr: starker Schneefall. Wer draußen auf dem Bahnsteig war, war voller Schnee.", pt: "Tempo em Würzburg às 23h10: neve forte. Quem esteve na plataforma ficou coberto de neve."}],
    suspeitos: [
      {id: "brandl", nome: "Felix Brandl", papelPt: "Passageiro da cabine 8", papelDe: "der Fahrgast aus Kabine 8", voz: "charon", keys: ["brandl", "felix", "kabine 8", "kabine acht"],
        fatosDe: ["Ich habe Kabine 8, direkt neben Kabine 7.", "In Würzburg bin ich ausgestiegen. Ich war die ganzen zehn Minuten draußen auf dem Bahnsteig und habe telefoniert.",
          "Den silbernen Koffer habe ich nie gesehen.", "Ich bin Vertriebsleiter und fahre oft mit dem Nachtzug."],
        mentiraInfoEn: "You are the culprit. During the stop you did not get off: you took the suitcase from compartment 7 into your own compartment and hid it under your bed. Your lie: you say you were outside on the platform for the whole ten minutes, telephoning. Keep this lie. If Luiz says that your jacket was dry or that everybody outside was full of snow, get nervous and say something vague (maybe you stood under the roof), but do not fully confess."},
      {id: "petra", nome: "Petra Lindner", papelPt: "Funcionária do trem", papelDe: "die Zugbegleiterin", voz: "leda", keys: ["petra", "lindner", "zugbegleiterin", "schaffnerin"],
        fatosDe: ["Um 23:05 Uhr habe ich in Kabine 7 die Fahrkarten kontrolliert. Der silberne Koffer stand noch da.",
          "Während des Halts stand ich an der Tür von Wagen 3, auf dem Bahnsteig. Mein Mantel war danach ganz weiß vom Schnee.",
          "Kurz vor der Abfahrt ist Herr Brandl im Gang an mir vorbeigegangen. Seine Jacke war ganz trocken.", "Die Frau aus Kabine 7 hat geschlafen."],
        mentiraInfoEn: "You are innocent and tell the truth. Only mention that Herr Brandl's jacket was completely dry if Luiz asks about Herr Brandl or about what you noticed. You are professional and calm."},
      {id: "jan", nome: "Jan Hoffmann", papelPt: "Estudante da cabine 6", papelDe: "der Student aus Kabine 6", voz: "puck", keys: ["jan", "hoffmann", "student", "kabine 6", "kabine sechs"],
        fatosDe: ["Ich habe die meiste Zeit geschlafen, mit Kopfhörern.", "In Würzburg bin ich kurz raus, zwei Minuten, und habe den Schnee fotografiert. Danach waren meine Haare ganz nass.",
          "Um Viertel nach elf habe ich jemanden aus Kabine 8 kommen sehen. Das Gesicht habe ich nicht gesehen.", "Ich habe Hunger. Gibt es hier etwas zu essen?"],
        mentiraInfoEn: "You are innocent and tell the truth. You are a bit chaotic and like to talk about food. If Luiz asks, you can show him your snow photo; it was taken at 23:11."}],
    solucao: {culpado: "brandl", culpadoKeys: ["brandl", "felix", "kabine 8", "kabine acht"],
      contradicaoKeys: ["schnee", "geschneit", "schneit", "trocken", "jacke", "nass", "viertel nach elf", "23:15", "23.15"],
      explicacaoPt: "Felix Brandl diz que passou os dez minutos na plataforma, ao telefone. Mas nevava forte e quem estava lá fora ficou coberto de neve; a jaqueta dele estava seca. E às 23h15 alguém saiu da cabine 8, que é a dele.",
      explicacaoDe: "Herr Brandl sagt, er war die ganze Zeit draußen auf dem Bahnsteig. Aber es hat stark geschneit, und seine Jacke war ganz trocken. Um Viertel nach elf ist außerdem jemand aus seiner Kabine gekommen."}},
  {id: "alpenlabor", level: "B1", tituloPt: "Apagão no observatório", tituloDe: "Stromausfall im Observatorium",
    aberturaDe: "Im Observatorium in den Alpen ist in der Nacht der Strom ausgefallen, zwölf Minuten lang. In dieser Zeit hat jemand die Daten eines seltenen Signals von Hand gelöscht. Drei Personen waren im Gebäude.",
    aberturaPt: "No observatório nos Alpes, a energia caiu por doze minutos durante a noite. Nesse tempo, alguém apagou à mão os dados de um sinal raro. Três pessoas estavam no prédio.",
    situacaoEn: "In a small observatory in the Alps, the power failed for twelve minutes at night (02:31 to 02:43). During this time someone deleted the data of a rare radio signal by hand. Three people were in the building. Luiz, a visitor who stayed the night, asks the questions.",
    pistas: [
      {de: "Server-Protokoll: Die Datei „Signal_0417“ wurde um 02:37 Uhr gelöscht, am Rechner im Kontrollraum. Nur dieser Rechner hatte Strom, über eine Notbatterie.", pt: "Registro do servidor: o arquivo “Signal_0417” foi apagado às 2h37, no computador da sala de controle. Só esse computador tinha energia, por uma bateria de emergência."},
      {de: "Kamera im Flur (mit Batterie): Um 02:34 Uhr geht eine Person mit einer roten Wollmütze in Richtung Kontrollraum. Das Gesicht sieht man nicht.", pt: "Câmera do corredor (com bateria): às 2h34, uma pessoa com gorro de lã vermelho vai para a sala de controle. O rosto não aparece."}],
    suspeitos: [
      {id: "nils", nome: "Nils Berger", papelPt: "Doutorando", papelDe: "der Doktorand", voz: "puck", keys: ["nils", "berger", "doktorand"],
        fatosDe: ["Während des Stromausfalls war ich in meinem Zimmer und habe geschlafen.", "Ich bin erst um drei Uhr aufgewacht, als der Strom wieder da war.",
          "Das Signal habe ich als Erster entdeckt, vor drei Tagen.", "Ich finde es schlimm, dass die Daten weg sind."],
        mentiraInfoEn: "You are the culprit. You copied the data onto your own USB stick and deleted them on the control-room computer at 02:37, because you want to publish the discovery alone. You wore your red wool hat, as always. Your lie: you say you slept in your room during the whole power failure. Keep this lie. If Luiz says that your room was empty at 02:33 or mentions the red hat on the camera, get defensive (many people have red hats), but do not fully confess."},
      {id: "sanne", nome: "Sanne Moser", papelPt: "Técnica", papelDe: "die Technikerin", voz: "zephyr", keys: ["sanne", "moser", "technikerin"],
        fatosDe: ["Als der Strom ausgefallen ist, bin ich mit der Taschenlampe in den Keller gegangen, zum Generator.",
          "Um 02:33 Uhr bin ich an Nils' Zimmer vorbeigegangen. Die Tür stand offen, und das Zimmer war leer.",
          "Im Keller habe ich den Generator repariert. Um 02:43 Uhr war der Strom wieder da.", "Vom Keller aus kann man den Kontrollraum nicht sehen."],
        mentiraInfoEn: "You are innocent and tell the truth. You are practical and a little proud that you fixed the generator so fast. Only mention Nils' empty room if Luiz asks what you saw on your way."},
      {id: "ruth", nome: "Prof. Ruth Albrecht", papelPt: "Diretora do observatório", papelDe: "die Leiterin des Observatoriums", voz: "kore", keys: ["ruth", "albrecht", "leiterin", "professorin"],
        fatosDe: ["Von 02:20 bis 02:50 Uhr habe ich in meinem Büro mit einem Kollegen in Zürich telefoniert. Mein Telefon hat eine Batterie.",
          "Nils trägt immer seine rote Wollmütze, sogar beim Essen.", "Nils wollte das Signal zuerst allein veröffentlichen. Ich habe Nein gesagt.",
          "Für mich ist das eine Katastrophe: Das Signal war vielleicht etwas ganz Neues."],
        mentiraInfoEn: "You are innocent and tell the truth. Your phone call can be checked. You are upset about the lost data and speak in a precise, slightly formal way."}],
    solucao: {culpado: "nils", culpadoKeys: ["nils", "berger", "doktorand"],
      contradicaoKeys: ["mutze", "kamera", "leer", "2:33", "02:33", "2.33", "sanne", "moser"],
      explicacaoPt: "Nils diz que dormiu no quarto durante todo o apagão. Mas às 2h33 a Sanne passou pelo quarto dele e estava vazio, e às 2h34 a câmera mostra alguém de gorro vermelho indo para a sala de controle; Nils sempre usa esse gorro. Os dados foram apagados lá às 2h37.",
      explicacaoDe: "Nils sagt, er hat während des Stromausfalls geschlafen. Aber um 2:33 Uhr war sein Zimmer leer, und um 2:34 Uhr zeigt die Kamera eine Person mit roter Mütze auf dem Weg zum Kontrollraum. Nils trägt immer diese Mütze."}},
  {id: "hafen", level: "A2", tituloPt: "A janela aberta em Kiel", tituloDe: "Das offene Fenster in Kiel",
    aberturaDe: "Im kleinen Schifffahrtsmuseum am Kieler Hafen ist die alte Uhr des Kapitäns verschwunden, vor der Öffnung am Morgen. Aber der Alarm an der Vordertür hat nie geklingelt.",
    aberturaPt: "No pequeno museu marítimo do porto de Kiel, o relógio antigo do capitão sumiu antes da abertura, de manhã. Mas o alarme da porta da frente nunca tocou.",
    situacaoEn: "In a small maritime museum at the harbour in Kiel, the captain's antique clock disappeared before the museum opened in the morning. The alarm of the front door never rang. Luiz, a visitor, asks three people questions.",
    pistas: [
      {de: "Alarmprotokoll: Die Vordertür war von 18:00 Uhr bis 9:30 Uhr zu. Um 9:30 Uhr hat Frau Möller sie aufgeschlossen. Die Fenster haben keinen Alarm.", pt: "Registro do alarme: a porta da frente ficou fechada das 18h às 9h30. Às 9h30 a Frau Möller a destrancou. As janelas não têm alarme."},
      {de: "Das Fenster im Lagerraum zum Hof steht offen. Am Rahmen ist frische hellblaue Farbe, und im Kies darunter sind Abdrücke von einer Leiter.", pt: "A janela do depósito, que dá para o pátio, está aberta. No batente há tinta azul-clara fresca, e no cascalho embaixo há marcas de uma escada."}],
    suspeitos: [
      {id: "ole", nome: "Ole Petersen", papelPt: "Zelador do museu", papelDe: "der Hausmeister", voz: "fenrir", keys: ["ole", "petersen", "hausmeister"],
        fatosDe: ["Seit Sonntag bin ich krank zu Hause, ich habe eine Erkältung.", "Gestern und heute war ich gar nicht im Museum.",
          "Die Uhr des Kapitäns ist sehr wertvoll, das weiß jeder.", "Ich arbeite seit zwanzig Jahren im Museum."],
        mentiraInfoEn: "You are the culprit. Yesterday afternoon you painted the window frames in the courtyard light blue, and this morning at 7:15 you came back with your ladder, opened the storage-room window from outside and took the clock, because you have debts. Your lie: you say you have been ill at home since Sunday and were not at the museum yesterday or today. Keep this lie. If Luiz says that you painted the frames yesterday, or mentions the fresh blue paint or the man with a ladder at 7:15, cough, get nervous, but do not fully confess."},
      {id: "inken", nome: "Inken Möller", papelPt: "Guia do museu", papelDe: "die Museumsführerin", voz: "aoede", keys: ["inken", "moller", "museumsfuhrerin"],
        fatosDe: ["Um 9:30 Uhr habe ich die Vordertür aufgeschlossen. Der Alarm war an, alles war normal.", "Gestern um 18 Uhr war die Uhr noch in der Vitrine.",
          "Gestern Nachmittag hat Ole die Fensterrahmen im Hof hellblau gestrichen. Er hat dafür seine Leiter benutzt.", "Ich habe nur einen Schlüssel für die Vordertür."],
        mentiraInfoEn: "You are innocent and tell the truth. Only mention that Ole painted the frames yesterday if Luiz asks about Ole, about the paint or about who was at the museum yesterday. You are friendly and talk a lot about the museum."},
      {id: "jansen", nome: "Herr Jansen", papelPt: "Dono do café vizinho", papelDe: "der Cafébesitzer von nebenan", voz: "charon", keys: ["jansen", "cafe", "café"],
        fatosDe: ["Ich habe einen Schlüssel für die Hintertür, für die Kaffeelieferung.", "Heute um Viertel nach sieben habe ich vom Café aus einen Mann mit einer Leiter im Museumshof gesehen. Das Gesicht habe ich nicht gesehen.",
          "Mein Café öffne ich um acht Uhr.", "Um acht Uhr war die Hintertür abgeschlossen, das habe ich gesehen."],
        mentiraInfoEn: "You are innocent and tell the truth. You are a bit grumpy because people might think you did it, since you have a key. Only mention the man with the ladder if Luiz asks what you saw this morning."}],
    solucao: {culpado: "ole", culpadoKeys: ["ole", "petersen", "hausmeister"],
      contradicaoKeys: ["farbe", "hellblau", "gestrichen", "streich", "leiter", "viertel nach sieben", "7:15", "7.15", "jansen", "fensterrahmen"],
      explicacaoPt: "Ole diz que está doente em casa desde domingo e que não foi ao museu nem ontem nem hoje. Mas a Inken conta que ontem à tarde ele pintou os batentes de azul-claro com a escada dele; a tinta fresca está na janela aberta, e às 7h15 o Herr Jansen viu um homem com uma escada no pátio.",
      explicacaoDe: "Ole sagt, er war gestern und heute nicht im Museum. Aber gestern Nachmittag hat er die Fensterrahmen hellblau gestrichen, und am offenen Fenster ist frische hellblaue Farbe. Um Viertel nach sieben hat Herr Jansen einen Mann mit Leiter im Hof gesehen."}}];
const KRIMI_BY_ID = new Map(KRIMI_CASOS.map(c => [c.id, c]));

// ---------- Regras (puras, testadas em _dev/tests/krimi.test.cjs) ----------
const krimiNorm = s => (typeof wasNorm === "function" ? wasNorm(s) : String(s || "").toLowerCase()).replace(/[„“”"]/g, " ");
/* Chave no começo de uma palavra (“ole” não pode valer dentro de “holen”). */
function krimiHas(t, key) {
  const k = krimiNorm(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^\\p{L}\\d])" + k, "u").test(t);
}
/* Puro: quem o texto acusa e com que prova. Status: solved (pessoa certa + prova), need-proof (pessoa certa, sem prova),
   wrong (outra pessoa), guess (os três nomes, ou dois com “oder”: chute), none (nenhum suspeito reconhecido). */
function krimiEvaluate(text, caso) {
  const t = krimiNorm(text);
  const named = caso.suspeitos.filter(s => s.keys.some(k => krimiHas(t, k))).map(s => s.id);
  const culpritNamed = caso.solucao.culpadoKeys.some(k => krimiHas(t, k));
  if (named.length >= 3 || (named.length === 2 && /\boder\b/.test(t))) return {status: "guess", named};
  if (!named.length && !culpritNamed) return {status: "none", named};
  if (!culpritNamed) return {status: "wrong", named};
  const proof = caso.solucao.contradicaoKeys.some(k => krimiHas(t, k) || t.includes(krimiNorm(k)));
  return {status: proof ? "solved" : "need-proof", named};
}
function krimiSuspect(caso, sid) { return caso.suspeitos.find(s => s.id === sid) || caso.suspeitos[0]; }
function krimiTopic(caso, sid = caso.suspeitos[0].id) {
  const s = krimiSuspect(caso, sid);
  return {id: "krimi-" + caso.id, group: "Krimi", level: caso.level, pt: "Krimi · " + caso.tituloPt, role: s.papelDe + " " + s.nome, rolePt: s.nome,
    sie: true, voice: s.voz, krimi: caso, sid: s.id};
}
function krimiPrompt(topic, level) {
  const c = topic.krimi, s = krimiSuspect(c, topic.sid);
  return [`You are ${s.nome}, ${s.papelDe} (role in German), in a small mystery story. Situation: ${c.situacaoEn}`,
    "Luiz is questioning you, one person at a time. You do not know what the other people told him, and you never quote them.",
    "These are your facts (what you did and what you saw). Never invent new facts, times or people. If he asks about something that is not here, say you do not know:",
    ...s.fatosDe.map(f => "- " + f),
    "Secret instructions (never say them aloud): " + s.mentiraInfoEn,
    "Rules:",
    "- Answer only what he asks, in 1 or 2 short sentences. Do not explain the whole case and do not give hints about who did it.",
    "- Stay in character: you can be nervous, annoyed or friendly, but always polite. Use \"Sie\".",
    "- Never confess a crime on your own. Never accuse anybody without a reason from your facts.",
    "- Speak ONLY German. " + (CONV_LEVEL_RULES[level] || CONV_LEVEL_RULES.A1).replace(/at most \d( or \d)? (short )?sentences per turn/, "at most 2 short sentences per turn"),
    "- Do not correct Luiz's German and do not explain grammar. If you do not understand him, say \"Wie bitte?\".",
    "- Luiz's messages are transcribed speech: ignore capitalization and punctuation.",
    "- No emojis, no English, no Portuguese, no lists, no markdown."].join("\n");
}
function krimiStart(topic) {
  const s = krimiSuspect(topic.krimi, topic.sid);
  return "(Luiz comes to talk to you. Greet him briefly as " + s.nome + " and say in one sentence who you are. Do not tell your story yet.)";
}

// ---------- Sala: três interrogatórios, pistas e acusação (#convMission via missionRender) ----------
function krimiState() {
  const t = mis.topic;
  return mis.krimi || (mis.krimi = {sid: t.sid, threads: {}, asked: new Set([t.sid]), tries: [], result: null, cluesOpen: false, accuseOpen: false, text: ""});
}
/* Troca de suspeito: guarda a conversa atual e abre (ou retoma) a do outro, com voz e instruções dele. */
function krimiSwitch(sid) {
  const K = krimiState(), topic = conv.topic;
  if (!topic || !topic.krimi || conv.busy || conv.finished || sid === K.sid) return;
  if (typeof stopAudio === "function") stopAudio();
  if (conv.live && typeof liveEnd === "function") liveEnd();
  K.threads[K.sid] = {messages: conv.messages, turns: conv.turns};
  const s = krimiSuspect(topic.krimi, sid);
  Object.assign(topic, {sid: s.id, role: s.papelDe + " " + s.nome, rolePt: s.nome, voice: s.voz});
  K.sid = s.id; K.asked.add(s.id);
  const th = K.threads[s.id] || {messages: [{role: "system", content: convSystemPrompt({name: s.nome, level: convLevel(), topic, known: []})}], turns: []};
  conv.messages = th.messages; conv.turns = th.turns;
  conv.token++;
  $("convChat").replaceChildren(...conv.turns.map(convBubble));
  if (typeof salaOpen === "function") salaOpen(topic);
  missionRender();
  if (!conv.turns.length) {
    if (typeof liveOn === "function" && liveOn()) liveBegin(topic, krimiStart(topic));
    else partnerTurn(krimiStart(topic));
  }
}
/* Antes do resumo: as três conversas juntas (para os erros de alemão saírem de todas). */
function krimiBeforeFinish() {
  const K = krimiState();
  K.threads[K.sid] = {messages: conv.messages, turns: conv.turns};
  conv.turns = conv.topic.krimi.suspeitos.flatMap(s => (K.threads[s.id] || {turns: []}).turns);
}
const KRIMI_MSG = {
  "need-proof": "Você apontou a pessoa certa, mas diga em alemão qual pista ou horário mostra que ela mentiu.",
  wrong: "Essa pessoa não parece estar mentindo. Interrogue mais e compare com as pistas.",
  guess: "Aponte uma pessoa só e diga o que entrega a mentira.",
  none: "Não reconheci nenhum suspeito. Diga em alemão o nome de quem mente e por quê."};
function krimiSolve(text) {
  const K = krimiState(), c = conv.topic.krimi;
  if (!convClean(text) || (K.result && K.result.status === "solved")) return;
  K.text = text;
  const r = krimiEvaluate(text, c);
  if (r.status !== "none") K.tries.push(text);
  K.result = r;
  if (r.status === "solved") toast("Caso resolvido!", "success");
  missionRender();
}
function krimiPanel(box) {
  const K = krimiState(), c = conv.topic.krimi, solved = K.result && K.result.status === "solved";
  const tabs = h("div", {class: "segmented kr-tabs", role: "group", "aria-label": "Quem interrogar"},
    ...c.suspeitos.map(s => h("button", {type: "button", "aria-pressed": String(s.id === K.sid), disabled: conv.busy || conv.finished,
      onclick: () => krimiSwitch(s.id)}, h("b", {text: s.nome}), h("small", {text: s.papelPt}))));
  const clue = p => {
    const pt = h("p", {class: "muted small-text", hidden: true, text: p.pt});
    return h("li", null, h("p", {lang: "de", class: "kr-clue-de", text: p.de}), pt,
      h("button", {class: "quiet small", type: "button", onclick: e => { pt.hidden = !pt.hidden; e.currentTarget.textContent = pt.hidden ? "Tradução" : "Esconder"; }}, "Tradução"));
  };
  const ta = h("textarea", {lang: "de", rows: "3", placeholder: "Ich glaube, … lügt, weil …", "aria-label": "Quem está mentindo e qual prova entrega a mentira, em alemão"});
  ta.value = K.text || "";
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); krimiSolve(ta.value); } });
  fill(box,
    h("div", {class: "mis-head"},
      h("p", {class: "label", text: "Interrogatório"}),
      h("p", {class: "mis-stat"}, h("b", {text: String(K.asked.size)}), " de 3 pessoas ouvidas")),
    h("p", {class: "kr-case", lang: "de", text: c.aberturaDe}),
    tabs,
    h("div", {class: "row kr-acts"},
      h("button", {class: "small", type: "button", "aria-expanded": String(K.cluesOpen), onclick: () => { K.cluesOpen = !K.cluesOpen; missionRender(); }}, icon("search", 15), "Pistas (" + c.pistas.length + ")"),
      h("button", {class: (solved ? "" : "primary ") + "small", type: "button", "aria-expanded": String(K.accuseOpen), onclick: () => { K.accuseOpen = !K.accuseOpen; missionRender(); }}, "Acusar / Resolver")),
    K.cluesOpen ? h("ul", {class: "kr-clues"}, ...c.pistas.map(clue)) : null,
    K.accuseOpen || K.result ? h("div", {class: "kr-accuse"},
      solved ? h("div", {class: "mis-result ok"}, h("p", {text: "Resolvido. " + c.solucao.explicacaoPt}), h("p", {lang: "de", class: "kr-clue-de", text: c.solucao.explicacaoDe}))
        : h("div", null,
          h("p", {class: "label", text: "Quem está mentindo e qual prova entrega a mentira? Responda em alemão."}),
          ta,
          h("div", {class: "row"}, h("button", {class: "primary small", type: "button", onclick: () => krimiSolve(ta.value)}, "Resolver"),
            h("span", {class: "muted small-text", text: K.tries.length ? plural(K.tries.length, "tentativa", "tentativas") : "Fale ou escreva; a conferência é por regra."})),
          K.result ? h("p", {class: "mis-result", text: KRIMI_MSG[K.result.status]}) : null)) : null);
}
function krimiSessionExtra() {
  const K = krimiState();
  return {krimi: {id: conv.topic.krimi.id, solved: !!(K.result && K.result.status === "solved"), asked: K.asked.size, tries: K.tries.length}};
}
function krimiSummaryNode() {
  const K = krimiState(), c = conv.topic.krimi, solved = K.result && K.result.status === "solved";
  return h("div", {class: "mis-result" + (solved ? " ok" : "")},
    h("p", {text: solved ? "Caso resolvido com " + plural(K.asked.size, "pessoa ouvida", "pessoas ouvidas") + "." : "Caso ainda aberto: dá para tentar de novo."}),
    solved ? h("p", {lang: "de", class: "kr-clue-de", text: c.solucao.explicacaoDe})
      : h("details", null, h("summary", {text: "Ver a solução"}), h("p", {text: c.solucao.explicacaoPt}), h("p", {lang: "de", class: "kr-clue-de", text: c.solucao.explicacaoDe})));
}
function krimiSetupNode() {
  const sessions = convData().sessions, ok = !!(conv.status && conv.status.installed);
  const solved = new Set(sessions.filter(s => s.krimi && s.krimi.solved).map(s => s.krimi.id));
  return h("section", {class: "scene-group"},
    ...titled("h2", "Krimi", "Um mistério curto com três suspeitos. Interrogue cada um em alemão, compare com as duas pistas e descubra quem mente: diga o nome e a prova. Nada de alternativas: a conferência é por regra."),
    h("div", {class: "scene-grid"}, ...KRIMI_CASOS.map(c => h("article", {class: "scene-card"},
      h("div", {class: "scene-top"}, h("span", {class: "tag", text: c.level}), solved.has(c.id) ? h("span", {class: "tag ok", text: "resolvido"}) : null),
      h("h3", {lang: "de", text: c.tituloDe}),
      h("p", {class: "muted small-text", text: c.tituloPt}),
      h("div", {class: "row"}, h("button", {class: "small", type: "button", disabled: !ok, onclick: () => openConversaTopic(krimiTopic(c))}, "Investigar"))))));
}
