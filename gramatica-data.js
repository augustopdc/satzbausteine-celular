"use strict";
/* Notas de gramática contrastiva para brasileiros.
   Cada tópico: explicação curta, a armadilha típica de quem fala português e uma regra que encontra frases do catálogo. */
const GRAMATICA = (() => {
  const low = c => c.frase.toLocaleLowerCase("de");
  const alvo = c => (c.alvo || "").toLocaleLowerCase("pt-BR");
  /* Alguma oração (entre vírgulas) termina em particípio (ou em infinitivo + modal, com modals) e o auxiliar mais próximo
     antes dele é um de `aux`? Usado no Plusquamperfekt e no Konjunktiv II do passado: “waren wir im Konzert und sind …
     gekommen” não conta, porque o auxiliar de gekommen é sind. */
  const AUXES = /^(bin|bist|ist|sind|seid|habe|hast|hat|haben|habt|hatte|hattest|hatten|hattet|war|warst|waren|wart|hätte|hättest|hätten|hättet|wäre|wärst|wären|wärt|wird|werden|wurde|wurden)$/;
  const lastAux = (s, aux, modals) => s.split(/[,;]/).some(part => {
    const w = part.replace(/[.!?…„“"]/g, " ").trim().split(/\s+/), end = w[w.length - 1] || "";
    const sein = x => /^(war|warst|waren|wart|wäre|wärst|wären|wärt)$/.test(x), sp = x => typeof EX_SEIN_PART !== "undefined" && EX_SEIN_PART.includes(x);
    // Subordinada: o auxiliar fecha a oração (“…, nachdem wir gegessen hatten”).
    const prev = w[w.length - 2] || "";
    if (aux.test(end) && /^(\p{Ll}*ge\p{Ll}+(t|en)|\p{Ll}+iert)$/u.test(prev)) return !sein(end) || sp(prev);
    const ok =/^(\p{Ll}*ge\p{Ll}+(t|en)|\p{Ll}+iert)$/u.test(end) || (modals && /^(sollen|müssen|können|dürfen|wollen)$/.test(end) && /en$/.test(w[w.length - 2] || ""));
    if (!ok || w.includes("worden")) return false;
    for (let i = w.length - 2; i >= 0; i--) {
      if (!AUXES.test(w[i])) continue;
      if (!aux.test(w[i])) return false;
      // war/wäre + particípio só conta com verbo de sein (gegangen, gekommen…): “war ausgezeichnet” é adjetivo.
      const sein = /^(war|warst|waren|wart|wäre|wärst|wären|wärt)$/.test(w[i]);
      return !sein || (typeof EX_SEIN_PART !== "undefined" && EX_SEIN_PART.includes(end));
    }
    return false;
  });
  return [
    {id: "v2", title: "Verbo na 2ª posição", short: "Na oração principal, o verbo conjugado é sempre o segundo elemento.",
      body: ["Em alemão, o verbo conjugado ocupa a segunda posição da oração principal. Se a frase começa por outra coisa que não o sujeito (tempo, lugar, objeto), o sujeito passa para depois do verbo.",
        "Em português a ordem é livre (“Hoje eu trabalho”); em alemão, não: “Heute arbeite ich”."],
      trap: ["Heute ich arbeite.", "Heute arbeite ich."],
      examples: [["Morgen habe ich frei.", "Amanhã estou de folga."], ["Seit gestern habe ich Fieber.", "Estou com febre desde ontem."]],
      detect: c => /posi[cç][aã]o 1|verbo em 2|posi[cç][aã]o 2|invers/.test(alvo(c)) || /^(heute|morgen|gestern|jetzt|dann|danach|deshalb|trotzdem|außerdem|leider|vielleicht|zuerst|später|hier|dafür|am \w+|um \w+ uhr|seit \w+|im \w+|nach dem \w+|vor \w+)\s+(bin|bist|ist|sind|habe|hast|hat|haben|kann|muss|möchte|werde|wird|gibt|komme|gehe|arbeite)\b/.test(low(c))},
    {id: "nebensatz", title: "Verbo no fim da subordinada", short: "Depois de dass, weil, wenn, ob… o verbo conjugado vai para o final.",
      body: ["Conjunções como dass (que), weil (porque), wenn (quando/se), ob (se), obwohl (embora), damit (para que) e falls (caso) mandam o verbo conjugado para o fim da oração.",
        "Com dois verbos, o conjugado fica por último: “…, weil ich arbeiten muss”."],
      trap: ["Ich lerne Deutsch, weil ich will in Deutschland arbeiten.", "Ich lerne Deutsch, weil ich in Deutschland arbeiten will."],
      examples: [["Ich glaube, dass er recht hat.", "Acho que ele tem razão."], ["Sagen Sie Bescheid, wenn es wehtut.", "Avise se doer."]],
      detect: c => {
        const s = low(c), conj = "(dass|weil|obwohl|damit|bevor|nachdem|falls|sobald|ob|wenn)";
        return new RegExp(",\\s*" + conj + "\\b").test(s) || (new RegExp("^" + conj + "\\b").test(s) && s.includes(","));
      }},
    {id: "trennbar", title: "Verbos separáveis", short: "Prefixos como an-, auf-, ein-, mit- vão para o fim da frase.",
      body: ["Muitos verbos têm um prefixo que se separa no presente e no passado simples e vai para o fim da oração: anrufen → “Ich rufe dich an”.",
        "No particípio, o ge- entra no meio (angerufen); em subordinadas e com modais, o verbo volta a ficar junto (…, weil ich dich anrufe)."],
      trap: ["Ich anrufe dich morgen.", "Ich rufe dich morgen an."],
      examples: [["Wann kann ich einziehen?", "Quando posso me mudar?"], ["Nehmen Sie regelmäßig Medikamente ein?", "O senhor toma remédios regularmente?"]],
      detect: c => /separ[aá]vel|separ/.test(alvo(c))},
    {id: "modal", title: "Modais e o infinitivo no fim", short: "Com können, müssen, möchten…, o segundo verbo vai para o fim, no infinitivo.",
      body: ["Os verbos modais (können, müssen, dürfen, sollen, wollen, möchten) ficam na 2ª posição, e o verbo principal vai para o fim da frase, no infinitivo, sem “zu”.",
        "Em português os dois verbos ficam juntos (“posso vir amanhã”); em alemão, eles abraçam o resto da frase."],
      trap: ["Ich kann kommen morgen.", "Ich kann morgen kommen."],
      examples: [["Können Sie das bitte wiederholen?", "Pode repetir, por favor?"], ["Ich muss meinen Aufenthaltstitel verlängern.", "Preciso prorrogar minha autorização de residência."]],
      detect: c => /\b(kann|kannst|können|könnte|könnten|muss|musst|müssen|darf|dürfen|soll|sollte|sollen|will|möchte|möchten)\b/.test(low(c))},
    {id: "perfekt", title: "Perfekt com haben ou sein", short: "Verbos de movimento e mudança de estado usam sein no passado.",
      body: ["O passado da fala usa haben ou sein + particípio no fim da frase. A maioria usa haben; verbos de movimento (gehen, fahren, kommen) e de mudança de estado (aufwachen, einschlafen, sterben) usam sein.",
        "Brasileiros costumam usar sempre haben porque em português é tudo “ter/ir”."],
      trap: ["Ich habe nach Berlin gefahren.", "Ich bin nach Berlin gefahren."],
      examples: [["Ich bin letzte Woche eingezogen.", "Me mudei na semana passada."], ["Haben Sie Blut im Stuhl bemerkt?", "Notou sangue nas fezes?"]],
      detect: c => /\b(habe|hast|hat|haben|habt|bin|bist|ist|sind|seid)\b.*\b(ge\w+(t|en)|\w+(iert|ert))\b[.!?]?$/.test(low(c))},
    {id: "genero", title: "Gênero dos substantivos", short: "O gênero alemão raramente coincide com o português: aprenda o artigo junto.",
      body: ["Todo substantivo tem gênero: der (masculino), die (feminino) ou das (neutro). O gênero em português não ajuda: a ponte é die Brücke, o sol é die Sonne, a lua é der Mond.",
        "Aprenda sempre a palavra com o artigo. Algumas terminações ajudam: -ung, -heit, -keit, -ion e -tät são femininas; -chen e -lein, neutras."],
      trap: ["der Brücke (porque “o” ponte… não: a ponte)", "die Brücke"],
      examples: [["Wo ist die Toilette?", "Onde fica o banheiro?"], ["Wo ist der Bahnhof?", "Onde fica a estação?"]],
      detect: c => /\b(feminino|masculino|neutro)\b/.test(alvo(c)) || (c.tags || "").includes("Thema::Fachbegriffe")},
    {id: "akkusativ", title: "Acusativo (objeto direto)", short: "O artigo masculino muda: der → den, ein → einen.",
      body: ["O objeto direto fica no acusativo. Só o masculino muda de forma: der → den, ein → einen, kein → keinen, mein → meinen.",
        "Preposições como für, durch, gegen, ohne e um sempre pedem acusativo."],
      trap: ["Ich habe ein Termin.", "Ich habe einen Termin."],
      examples: [["Ich brauche einen Termin.", "Preciso de um horário."], ["Haben Sie etwas gegen Husten?", "Tem algo para tosse?"]],
      detect: c => /acusativ/.test(alvo(c))},
    {id: "dativ", title: "Dativo (objeto indireto)", short: "Depois de mit, bei, nach, seit, von, zu, aus: dativo.",
      body: ["O dativo marca o objeto indireto (a quem) e vem depois de mit, bei, nach, seit, von, zu e aus. Os artigos mudam: dem (masc./neutro), der (fem.), den + -n (plural).",
        "Alguns verbos pedem dativo: helfen, danken, gefallen, gehören, wehtun (“Mir tut der Kopf weh”)."],
      trap: ["Ich helfe dich.", "Ich helfe dir."],
      examples: [["Mir geht es gut.", "Estou bem."], ["Ich wohne seit einem Jahr hier.", "Moro aqui há um ano."]],
      detect: c => /dativ/.test(alvo(c))},
    {id: "genitiv", title: "Genitivo", short: "Posse e linguagem formal: des/der e -s no masculino e neutro.",
      body: ["O genitivo expressa posse (die Farbe des Auswurfs) e aparece muito em textos formais e médicos. Artigos: des + -s (masc./neutro), der (fem. e plural).",
        "Na fala do dia a dia, muitas vezes se usa von + dativo, mas na FSP e no Arztbrief o genitivo é esperado."],
      trap: ["die Aktivität von Ihr Herz", "die Aktivität Ihres Herzens"],
      examples: [["Mit einem EKG messen wir die elektrische Aktivität Ihres Herzens.", "Com o ECG medimos a atividade elétrica do seu coração."], ["Welche der beiden Untersuchungen ist zuerst wichtig?", "Qual dos dois exames é importante primeiro?"]],
      detect: c => /genitiv/.test(alvo(c))},
    {id: "praep", title: "Preposições de lugar: acusativo ou dativo", short: "in, an, auf…: movimento (wohin?) = acusativo; posição (wo?) = dativo.",
      body: ["As preposições in, an, auf, über, unter, vor, hinter, neben e zwischen pedem acusativo quando há movimento para um lugar (wohin?) e dativo quando indicam posição (wo?).",
        "“Legen Sie sich auf den Rücken” (movimento, acusativo) × “Sie liegen auf dem Rücken” (posição, dativo)."],
      trap: ["Ich gehe in dem Krankenhaus.", "Ich gehe in das (ins) Krankenhaus."],
      examples: [["Legen Sie sich bitte auf den Rücken.", "Deite-se de costas, por favor."], ["Ich wohne im zweiten Stock.", "Moro no segundo andar."]],
      detect: c => /\b(in|an|auf|über|unter|vor|hinter|neben|zwischen)\s+(den|dem|die|das|der|einen|einem|eine|einer)\b|\b(im|ins|am|ans)\b/.test(low(c))},
    {id: "sie", title: "Tratamento formal: Sie", short: "Sie (com maiúscula) + verbo no plural para pacientes, repartições e desconhecidos.",
      body: ["Com pacientes, colegas mais velhos, chefes e repartições use Sie, sempre com maiúscula, e o verbo na forma de plural (Sie haben, Sie sind). Ihr/Ihnen com maiúscula também são formais.",
        "Du é para amigos, família, crianças e, muitas vezes, colegas próximos. Na dúvida, comece com Sie."],
      trap: ["Hast du Schmerzen? (para um paciente)", "Haben Sie Schmerzen?"],
      examples: [["Wie geht es Ihnen?", "Como o senhor está?"], ["Können Sie mir zeigen, wo es wehtut?", "Pode me mostrar onde dói?"]],
      detect: c => /^\[Sie\]/.test(c.situacao) && /\b(Sie|Ihnen|Ihr\w*)\b/.test(c.frase)},
    {id: "passiv", title: "Voz passiva", short: "werden + particípio: muito comum em textos médicos e burocráticos.",
      body: ["A voz passiva usa werden + particípio no fim: “Der Patient wird operiert” (o paciente está sendo operado). No passado: wurde + particípio.",
        "Relatos clínicos adoram a passiva impessoal: “Fieber wird verneint” (febre é negada)."],
      trap: ["Der Patient ist operiert. (= já está operado)", "Der Patient wird operiert. (= está sendo operado)"],
      examples: [["Fieber, Husten und Atemnot werden verneint.", "Febre, tosse e dispneia são negadas."], ["Wurden Sie schon einmal operiert?", "O senhor já foi operado?"]],
      detect: c => /passiv/.test(alvo(c)) || /\b(wird|werden|wurde|wurden)\b.*\b(ge\w+t|\w+iert|ge\w+en)\b/.test(low(c))},
    {id: "konjunktiv", title: "Konjunktiv II para cortesia", short: "würde, könnte, hätte, wäre: pedidos educados e hipóteses.",
      body: ["Para soar educado, o alemão usa o Konjunktiv II: “Könnten Sie…?”, “Ich hätte gern…”, “Wäre das möglich?”, “Ich würde vorschlagen…”.",
        "Na FSP, com o chefe e com pacientes, essas formas mostram registro adequado."],
      trap: ["Ich will einen Kaffee.", "Ich hätte gern einen Kaffee."],
      examples: [["Könnten Sie bitte den Oberkörper frei machen?", "Poderia tirar a roupa da parte de cima?"], ["Ich würde ein EKG schreiben.", "Eu faria um ECG."]],
      detect: c => /\b(würde|würden|könnte|könnten|hätte|hätten|wäre|wären|sollte|sollten)\b/.test(low(c))},
    {id: "negacao", title: "nicht × kein", short: "kein nega substantivos sem artigo definido; nicht nega o resto.",
      body: ["Use kein (keine, keinen…) para negar substantivos que seriam usados com “ein” ou sem artigo: “Ich habe keine Allergien”.",
        "Use nicht para negar verbos, adjetivos e substantivos com artigo definido: “Das weiß ich nicht”, “Die Heizung funktioniert nicht”."],
      trap: ["Ich habe nicht Fieber.", "Ich habe kein Fieber."],
      examples: [["Allergien sind nicht bekannt.", "Alergias não conhecidas."], ["Nein, Fieber habe ich nicht.", "Não, febre eu não tenho."]],
      detect: c => /\b(nicht|kein|keine|keinen|keinem|keiner)\b/.test(low(c))},
    {id: "falsos", title: "Falsos amigos", short: "Palavras que parecem português, mas significam outra coisa.",
      body: ["Alguns falsos amigos frequentes: bekommen = receber (não “tornar-se”); eventuell = talvez; aktuell = atual, recente; Rezept = receita (médica ou culinária); Gymnasium = ensino médio; sensibel = sensível (emocionalmente); Prospekt = folheto; Tasse = xícara.",
        "Na dúvida, confira na tradução da frase."],
      trap: ["Ich bekomme Arzt. (querendo dizer “vou virar médico”)", "Ich werde Arzt."],
      examples: [["Wann bekomme ich die Bankkarte?", "Quando recebo o cartão?"], ["Brauche ich dafür ein Rezept?", "Preciso de receita para isso?"]],
      detect: c => /\b(bekomme|bekommst|bekommt|bekommen|eventuell|aktuell|rezept|gymnasium|sensibel|prospekt|tasse)\b/.test(low(c))},
    {id: "imperativ", title: "Imperativo: pedidos e instruções", short: "Sie: verbo + Sie (Nehmen Sie…). du: verbo sem -st e sem du (Nimm…!).",
      body: ["Formal: o verbo vai para o início e o Sie vem logo depois: “Kommen Sie bitte herein”, “Nehmen Sie die Tabletten nach dem Essen”. Sem o Sie, a frase fica errada.",
        "Informal (du): parta do presente com du e tire o -st e o pronome: du kommst → Komm!, du machst → Mach!. Verbos com troca e → i mantêm o i (nimm, gib, lies, iss), mas os com a → ä perdem o trema (du fährst → Fahr!). Com ihr: Kommt!, Macht!. sein é irregular: Sei ruhig! / Seien Sie bitte pünktlich.",
        "Com “bitte” o imperativo fica educado; sem ele, pode soar ríspido."],
      trap: ["Nehmen die Tabletten nach dem Essen.", "Nehmen Sie die Tabletten nach dem Essen."],
      examples: [["Machen Sie bitte den Mund auf.", "Abra a boca, por favor."], ["Komm doch mit!", "Vem junto!"]],
      detect: c => {
        const s = low(c);
        if (/imperativ/.test(alvo(c))) return true;
        if (/\?\s*$/.test(c.frase)) return false;
        return /^(bitte\s+)?\p{L}+en\s+sie\b/u.test(s) && !/^(sie|die|wie)\b/.test(s)
          || /^(bitte\s+)?(komm|geh|mach|nimm|gib|sag|hör|schau|wart|warte|ruf|lies|iss|trink|hilf|sei|bleib|setz|zeig|vergiss|pass|lass|heb|öffne|schreib|bring|frag|fahr|kauf|probier|trainiere|leg|steh|atme|erzähl|hol|such|melde|beeil)\b/.test(s);
      }},
    {id: "possessiv", title: "Possessivos: mein, dein, sein, ihr…", short: "Seguem as terminações de ein: mein Bruder, meine Schwester, meinen Bruder (acusativo).",
      body: ["mein (meu), dein (teu/seu, com du), sein (dele), ihr (dela ou deles), unser (nosso), euer (de vocês) e Ihr (do senhor/da senhora, com maiúscula). A terminação depende da coisa possuída, como em ein/eine: mein Vater, meine Mutter, mein Kind, meine Eltern.",
        "Em português, “seu” serve para tudo; em alemão, a escolha depende do dono: sein Auto (o carro dele), ihr Auto (o carro dela), Ihr Auto (o carro do senhor). No acusativo masculino, como einen: Ich besuche meinen Bruder."],
      trap: ["Das ist sein Tochter. (falando da filha dela)", "Das ist ihre Tochter."],
      examples: [["Meine Eltern wohnen in Brasilien.", "Meus pais moram no Brasil."], ["Haben Sie Ihre Versichertenkarte dabei?", "O senhor está com o seu cartão do plano de saúde?"]],
      detect: c => /possessiv/.test(alvo(c)) || /(?:^|[\s(„"])(?:[Mm]ein|[Dd]ein|[Ss]ein|[Ii]hr|[Uu]nser|[Ee]uer|[Ee]ur)(?:e|en|em|er|es)?\s+(?:\p{Ll}+(?:e|en|er|es|em)\s+)?[A-ZÄÖÜ]\p{L}/u.test(c.frase)},
    {id: "wfragen", title: "Wo, wohin e woher", short: "wo = onde (lugar), wohin = para onde (destino), woher = de onde (origem).",
      body: ["O português usa “onde” para quase tudo; o alemão separa: Wo wohnst du? (onde) · Wohin fährst du? (para onde) · Woher kommst du? (de onde).",
        "A resposta segue a pergunta: wo → in/an/auf + dativo (in der Stadt); wohin → in/an/auf + acusativo, nach ou zu (in die Stadt, nach Berlin, zum Arzt); woher → aus ou von (aus Brasilien, vom Arzt). Na fala, wohin e woher às vezes se partem: Wo fährst du hin? Wo kommst du her?"],
      trap: ["Wo gehst du?", "Wohin gehst du?"],
      examples: [["Woher kommen Sie?", "De onde o senhor é?"], ["Wohin soll ich den Befund schicken?", "Para onde devo mandar o laudo?"]],
      detect: c => /(^|[.?!]\s+)(wo|wohin|woher)\b|\b(wohin|woher)\b/.test(low(c))},
    {id: "praeteritum", title: "Passado de sein, haben e dos modais", short: "Na fala, sein, haben e os modais usam o Präteritum: Ich war krank. Ich hatte Fieber. Ich konnte nicht.",
      body: ["Para a maioria dos verbos, o passado falado é o Perfekt (Ich habe gearbeitet). Mas sein, haben e os modais quase sempre vão para o Präteritum: ich war, du warst, wir waren · ich hatte, du hattest, wir hatten · ich konnte, musste, wollte, durfte.",
        "Na 1ª e na 3ª pessoa do singular a forma é a mesma: ich war / er war, ich hatte / sie hatte. Em livros e notícias, todos os verbos aparecem no Präteritum (ging, kam, sagte); na conversa, só esses."],
      trap: ["Ich habe krank gewesen.", "Ich war krank."],
      examples: [["Gestern hatte ich keine Zeit.", "Ontem eu não tive tempo."], ["Waren Sie schon einmal im Krankenhaus?", "O senhor já esteve no hospital?"]],
      detect: c => /\b(war|warst|waren|wart|hatte|hattest|hatten|hattet|konnte|konntest|konnten|musste|musstest|mussten|wollte|wolltest|wollten|durfte|durftest|durften)\b/.test(low(c))},
    {id: "konnektoren", title: "und, aber, oder, denn, sondern", short: "Esses conectores não mudam a ordem: depois deles vêm sujeito e verbo normalmente.",
      body: ["und (e), aber (mas), oder (ou), denn (pois, porque) e sondern (mas sim, depois de uma negação) ligam duas orações principais e ficam na “posição zero”: não contam para a regra do verbo em 2º lugar.",
        "Compare: Ich bleibe zu Hause, denn ich bin krank (ordem normal) × …, weil ich krank bin (verbo no fim). sondern só aparece depois de nicht ou kein: Nicht heute, sondern morgen. Antes de aber, denn e sondern vai vírgula."],
      trap: ["Ich komme nicht, denn bin ich krank.", "Ich komme nicht, denn ich bin krank."],
      examples: [["Ich habe Hunger, aber keine Zeit.", "Estou com fome, mas sem tempo."], ["Der Termin ist nicht heute, sondern morgen.", "A consulta não é hoje, e sim amanhã."]],
      detect: c => /(^|[,;]\s*)(aber|denn|sondern)\s/.test(low(c)) || /,\s*(und|oder)\s/.test(low(c))},
    {id: "komparativ", title: "Comparativo e superlativo", short: "-er + als (größer als); igualdade: so … wie; superlativo: am -sten.",
      body: ["O comparativo acrescenta -er ao adjetivo e usa als: Berlin ist größer als München. Muitos adjetivos curtos ganham trema: alt → älter, groß → größer, jung → jünger, warm → wärmer.",
        "Igualdade: so … wie (Das ist so teuer wie hier). Superlativo: am + -sten (am schnellsten, am wärmsten). Irregulares frequentes: gut → besser → am besten; gern → lieber → am liebsten; viel → mehr → am meisten."],
      trap: ["Berlin ist mehr groß wie München.", "Berlin ist größer als München."],
      examples: [["Ich trinke lieber Tee als Kaffee.", "Prefiro chá a café."], ["Heute geht es mir besser.", "Hoje estou melhor."]],
      detect: c => /comparativ|komparativ|superlativ/.test(alvo(c)) || /\b\p{L}+er\s+als\b|\bso\s+\p{L}+\s+wie\b/u.test(low(c))
        || /\b(lieber|besser|größer|kleiner|älter|jünger|teurer|billiger|schneller|langsamer|wärmer|kälter|am liebsten|am besten|am meisten|am \p{L}+sten)\b/u.test(low(c))},
    {id: "adjektiv", title: "Terminação do adjetivo", short: "Depois de sein o adjetivo não muda (Das Auto ist neu); antes do substantivo, ganha terminação (ein neues Auto).",
      body: ["Depois de sein, werden e bleiben, o adjetivo fica sem terminação: Die Wohnung ist hell. Antes do substantivo, ele sempre ganha uma: die helle Wohnung, eine helle Wohnung.",
        "Regra prática para começar: depois de der/die/das no nominativo, a terminação é -e (der neue Kollege); depois de ein, o adjetivo mostra o gênero que o artigo não mostrou (ein neuer Kollege, ein neues Auto, eine neue Stelle). No dativo e no plural com artigo, quase sempre -en: mit dem neuen Kollegen, die neuen Kollegen."],
      trap: ["Ich habe eine neu Wohnung.", "Ich habe eine neue Wohnung."],
      examples: [["Ich suche eine kleine Wohnung.", "Procuro um apartamento pequeno."], ["Ich habe einen neuen Job.", "Tenho um emprego novo."]],
      detect: c => /declina|terminação do adjetivo|adjetivo antes|adjektivdekl/.test(alvo(c))
        || /(?:^|\s)(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein\p{L}*|mein\p{L}*|dein\p{L}*|sein\p{L}*|ihr\p{L}*|Ihr\p{L}*|unser\p{L}*|dies\p{L}*)\s+\p{Ll}\p{L}*(?:e|en|er|es|em)\s+[A-ZÄÖÜ]\p{L}/u.test(c.frase)},
    {id: "reflexiv", title: "Verbos reflexivos (sich)", short: "sich freuen, sich fühlen, sich setzen…: o pronome acompanha o sujeito (ich freue mich, du freust dich).",
      body: ["Alguns verbos vêm com um pronome que se refere ao próprio sujeito: ich freue mich, du freust dich, er/sie freut sich, wir freuen uns, ihr freut euch, Sie freuen sich.",
        "Muitos também são reflexivos em português (sentar-se, lembrar-se), mas nem todos: sich beeilen (apressar-se), sich erholen (recuperar-se), sich fühlen (sentir-se), sich anmelden (inscrever-se). Quando já há outro objeto, como uma parte do corpo, o pronome vai para o dativo: Ich wasche mir die Hände."],
      trap: ["Ich fühle gut.", "Ich fühle mich gut."],
      examples: [["Setzen Sie sich bitte.", "Sente-se, por favor."], ["Ich freue mich auf das Wochenende.", "Estou ansioso pelo fim de semana."]],
      // O pronome precisa combinar com o sujeito (ich … mich), senão é objeto comum (“Das freut mich”).
      detect: c => {
        const s = low(c).replace(/\b(für|ohne|gegen|um|durch|an|auf|über|mit|zu|bei|von)\s+(mich|dich|uns|euch)\b/g, "");
        return /reflexiv/.test(alvo(c)) || /\bsich\b/.test(s) || (/\bich\b/.test(s) && /\bmich\b/.test(s)) || (/\bdu\b/.test(s) && /\bdich\b/.test(s))
          || (/\bwir\b/.test(s) && /\buns\b/.test(s)) || (/\bihr\b/.test(s) && /\beuch\b/.test(s)) || /^\p{L}+\s+dich\b(?!.*\?)/u.test(s);
      }},
    // ---------- A2 ----------
    {id: "indirekt", title: "Perguntas indiretas", short: "Weißt du, wann …? · Ich frage mich, ob …: a pergunta vira subordinada e o verbo vai para o fim.",
      body: ["Quando uma pergunta fica dentro de outra frase, ela vira subordinada: o verbo conjugado vai para o fim. Com palavra interrogativa, ela mesma abre a oração (Wann kommt der Zug? → Weißt du, wann der Zug kommt?).",
        "Pergunta de sim/não usa ob (= se): Kommt er? → Ich weiß nicht, ob er kommt. Em português “se” serve para ob e wenn; em alemão, “se” de pergunta é sempre ob. É o jeito mais educado de perguntar: Können Sie mir sagen, wo die Station ist?"],
      trap: ["Können Sie mir sagen, wo ist die Apotheke?", "Können Sie mir sagen, wo die Apotheke ist?"],
      examples: [["Weißt du, wann der Kurs anfängt?", "Você sabe quando o curso começa?"], ["Ich weiß nicht, ob ich morgen Zeit habe.", "Não sei se amanhã tenho tempo."]],
      detect: c => /pergunta indireta|\bob\b.*indiret|indireta/.test(alvo(c))
        || /\b(weiß|weißt|wissen|wisst|frage|fragst|fragt|fragen|sag|sagen|erklären|zeigen|verstehe|überlege|ahnung|heraus)\b[^.?!]*,\s*(ob|wann|wo|wohin|woher|was|warum|wie|wer|wen|wem|welche\p{L}*|wieso|weshalb)\s/u.test(low(c))},
    {id: "daworter", title: "Verbos com preposição: da- e wo-", short: "warten auf → Worauf wartest du? · Ich warte darauf. Para coisas, da-/wo- + preposição.",
      body: ["Muitos verbos e adjetivos vêm com uma preposição fixa: warten auf, sich freuen auf/über, denken an, sich interessieren für, Angst haben vor, zufrieden sein mit. Aprenda o verbo com a preposição e o caso.",
        "Para perguntar por uma coisa, use wo(r)- + preposição (Worauf wartest du? Wofür interessierst du dich?); para retomar uma coisa, da(r)- + preposição (Ich warte darauf. Ich denke oft daran). Com pessoas, fica a preposição + pronome: Auf wen wartest du? — Auf ihn. O r entra antes de vogal: darauf, woran, darüber."],
      trap: ["Ich warte auf es.", "Ich warte darauf."],
      examples: [["Worüber habt ihr gesprochen?", "Sobre o que vocês conversaram?"], ["Ich freue mich schon darauf.", "Já estou ansioso por isso."]],
      detect: c => /verbo \+ prepos|verbos com prepos|adjetivo \+ prepos|\bda-|\bwo-|da\(r\)|wo\(r\)/.test(alvo(c))
        || /\b(daran|darauf|daraus|dafür|dagegen|darüber|darum|darunter|davon|davor|dazu|woran|worauf|woraus|wofür|wogegen|worüber|worum|wovon|wovor|wozu|womit|wonach)\b/.test(low(c))},
    {id: "relativ", title: "Oração relativa", short: "Der Mann, der dort steht … · das Buch, das ich lese …: pronome relativo e verbo no fim.",
      body: ["A oração relativa descreve um substantivo e começa, depois da vírgula, com um pronome relativo que parece o artigo: der, die, das, plural die. O gênero vem do substantivo; o caso, da função dentro da relativa. O verbo vai para o fim.",
        "Nominativo: der Arzt, der mir hilft · acusativo: der Arzt, den ich kenne · dativo: der Arzt, dem ich danke (plural: denen) · com preposição, ela vem antes: der Arzt, mit dem ich spreche. Em português “que” serve para tudo; em alemão é preciso escolher a forma."],
      trap: ["Der Kollege, das ich getroffen habe, ist nett.", "Der Kollege, den ich getroffen habe, ist nett."],
      examples: [["Das ist die Ärztin, die mich operiert hat.", "Esta é a médica que me operou."], ["Die Stadt, in der ich wohne, ist klein.", "A cidade em que moro é pequena."]],
      detect: c => {
        if (/relativ/.test(alvo(c))) return true;
        if (/^(Sehr geehrte|Liebe|Lieber|Hallo)\b/.test(c.frase)) return false;
        const m =c.frase.match(/,\s*(?:(?:mit|in|an|auf|bei|von|zu|für|über|um|aus|nach|unter|vor|neben|hinter|gegen|ohne|durch)\s+)?(der|die|das|den|dem|denen|deren|dessen)\s+([^,.!?;:]+)/);
        if (!m) return false;
        const rest = m[2].trim().split(/\s+/), first = rest[0], last = rest[rest.length - 1];
        // “…, das ist gut”, “…, das mache ich” e “…, die Kinder …” não são relativas: a relativa termina no verbo.
        if (rest.length < 2 || /^(ist|sind|war|waren|hat|haben|wird|kann|muss|gibt|finde|weiß|stimmt|geht|macht|mache|glaube)$/.test(first)) return false;
        if (/^[A-ZÄÖÜ]/.test(first) && !/^(Sie|Ihnen)$/.test(first)) return false;
        // “…, den vorgeschlagenen Zeitplan …”: artigo + adjetivo + substantivo, não pronome relativo.
        if (/^(anderen|einen|beiden|meisten)$/.test(first) || /^\p{Ll}+(e|en|er|es|em)$/u.test(first) && /^[A-ZÄÖÜ]/.test(rest[1] || "") && !/^(Sie|Ihnen)$/.test(rest[1])) return false;
        return /^\p{Ll}/u.test(last) && !/^(ich|du|er|sie|es|wir|ihr|man|auch|nicht|gern|so|doch|mal|schon|dann|jetzt|heute|morgen|hier|da|dort|immer|noch|sehr|gut)$/.test(last);
      }},
    {id: "alswenn", title: "als × wenn (quando)", short: "als = uma vez no passado (Als ich Kind war …); wenn = sempre que, ou no presente/futuro.",
      body: ["Os dois traduzem “quando” e mandam o verbo para o fim. als é para um fato único no passado: Als ich nach Deutschland kam, konnte ich kein Deutsch. wenn é para o que se repete (também no passado: Immer wenn ich krank war, …), para o presente e o futuro: Wenn ich fertig bin, rufe ich dich an.",
        "wenn também quer dizer “se” (condição): Wenn es regnet, bleiben wir zu Hause. Para “se” de pergunta, use ob. E als também é o “do que” do comparativo (größer als) e o “como” de função (als Arzt)."],
      trap: ["Wenn ich ein Kind war, habe ich in Recife gewohnt.", "Als ich ein Kind war, habe ich in Recife gewohnt."],
      examples: [["Als ich klein war, wollte ich Arzt werden.", "Quando eu era pequeno, queria ser médico."], ["Wenn ich Zeit habe, lese ich gern.", "Quando tenho tempo, gosto de ler."]],
      detect: c => {
        if (/\bals\b.*wenn|\bwenn\b.*\bals\b|als temporal|als \(quando|als = quando/.test(alvo(c))) return true;
        // “niedriger, als ich dachte” é comparativo, não “quando”.
        const s = low(c).replace(/\b(\p{L}+er|mehr|weniger|anders|lieber)\s*,\s*als\b/gu, "");
        return /(^|,\s*)(als|wenn)\s+(ich|du|er|sie|es|wir|ihr|man|mein\p{L}*|dein\p{L}*|unser\p{L}*|der|die|das)\b/u.test(s);
      }},
    {id: "umzu", title: "Finalidade: um … zu e damit", short: "Mesmo sujeito: um … zu + infinitivo. Sujeitos diferentes: damit + verbo no fim.",
      body: ["Para dizer para que algo serve, o alemão usa um … zu + infinitivo no fim: Ich lerne Deutsch, um in Deutschland zu arbeiten. Com verbo separável, o zu entra no meio: um dich anzurufen.",
        "um … zu só funciona quando o sujeito é o mesmo nas duas partes. Se muda, use damit + oração com verbo no fim: Ich spreche langsam, damit der Patient mich versteht. A pergunta é Wozu? (para quê?). Não confunda com o “para” de destino (für, zu, nach)."],
      trap: ["Ich lerne Deutsch für in Deutschland arbeiten.", "Ich lerne Deutsch, um in Deutschland zu arbeiten."],
      examples: [["Ich spare Geld, um ein Auto zu kaufen.", "Economizo dinheiro para comprar um carro."], ["Ich erkläre es langsam, damit Sie alles verstehen.", "Explico devagar para que o senhor entenda tudo."]],
      detect: c => /um … zu|um \.\.\. zu|\bdamit\b.*finalidade|finalidade/.test(alvo(c))
        || /(^|,\s*)um\s[^,.!?]*\bzu\s+\p{Ll}+n\s*[,.!?]|(^|,\s*)um\s[^,.!?]*\s\p{Ll}+zu\p{Ll}+en\s*[,.!?]|,\s*damit\s/u.test(low(c))},
    {id: "doppelkonj", title: "Conjunções duplas", short: "entweder … oder, sowohl … als auch, weder … noch, nicht nur … sondern auch, je … desto.",
      body: ["Algumas conjunções vêm em dupla: entweder … oder (ou … ou), sowohl … als auch (tanto … quanto), weder … noch (nem … nem), nicht nur … sondern auch (não só … mas também), zwar … aber (é verdade que … mas).",
        "je + comparativo … desto + comparativo = quanto mais …, mais …: Je mehr ich übe, desto besser spreche ich. Depois de je o verbo vai para o fim; depois de desto vem o verbo logo em seguida. weder … noch já é negativo: não use nicht junto."],
      trap: ["Ich trinke weder nicht Kaffee noch Tee.", "Ich trinke weder Kaffee noch Tee."],
      examples: [["Wir fahren entweder mit dem Zug oder mit dem Auto.", "Vamos ou de trem ou de carro."], ["Er spricht nicht nur Deutsch, sondern auch Englisch.", "Ele fala não só alemão, mas também inglês."]],
      detect: c => /conjun[cç][aã]o dupla|conjun[cç][oõ]es duplas/.test(alvo(c))
        || /\bentweder\b.*\boder\b|\bsowohl\b.*\bals auch\b|\bweder\b.*\bnoch\b|\bnicht nur\b.*\bsondern auch\b|\bzwar\b.*\baber\b|\bje\s+\p{L}+er\b.*\bdesto\b/u.test(low(c))},
    {id: "zweiobjekt", title: "Dois objetos: a quem e o quê", short: "Ich gebe dem Kind den Ball · Ich gebe ihn ihm: com substantivos, dativo antes; com pronomes, acusativo antes.",
      body: ["Verbos como geben, schenken, zeigen, schicken, bringen, erklären e empfehlen têm dois objetos: a pessoa no dativo (a quem) e a coisa no acusativo (o quê): Ich schenke meiner Mutter einen Schal.",
        "Ordem: com dois substantivos, primeiro o dativo (meiner Mutter einen Schal). Com um pronome, ele vem antes do substantivo (Ich schenke ihr einen Schal · Ich schenke ihn meiner Mutter). Com dois pronomes, o acusativo vem primeiro: Ich schenke ihn ihr. Em português pomos o “a quem” no fim; em alemão, não."],
      trap: ["Ich gebe ihm es.", "Ich gebe es ihm."],
      examples: [["Kannst du mir das Salz geben?", "Você me passa o sal?"], ["Ich zeige es Ihnen gleich.", "Já vou mostrar ao senhor."]],
      detect: c => {
        if (/dois objetos|dois pronomes|dativo \+ acusativo|dativo \(pessoa\)|pronomes: es/.test(alvo(c))) return true;
        const verb = "(gebe|gibst|gibt|geben|gib|schenke|schenkst|schenkt|schenken|zeige|zeigst|zeigt|zeigen|schicke|schickst|schickt|schicken|bringe|bringst|bringt|bringen|bring|erkläre|erklärst|erklärt|erklären|empfehle|empfiehlst|empfiehlt|empfehlen|leihe|leihst|leiht|leihen|kaufe|kaufst|kauft|gegeben|geschenkt|gezeigt|geschickt|gebracht|empfohlen|geliehen|gekauft)";
        // Só a oração principal: “…, warum sie dir wichtig ist” não conta.
        const main = c.frase.split(/,\s*(?=(?:warum|was|wie|wo|wann|dass|ob|weil|wenn|als|der|die|das|den|dem)\b)/)[0];
        // Dois pronomes (es ihm, ihn ihr) — “Sie” com maiúscula no meio da frase é o formal, não “sie”.
        if (/\b(es|ihn|sie)\s+(mir|dir|ihm|ihr|uns|euch|ihnen|Ihnen)\b/.test(main) && new RegExp("\\b" + verb + "\\b", "i").test(main)) return true;
        // Verbo + dativo (pronome) + acusativo: Ich schenke ihr einen Schal · Zeigen Sie mir bitte die Stelle.
        return new RegExp("\\b" + verb + "\\s+(?:\\p{L}+\\s+)?(?:Sie\\s+)?(mir|dir|ihm|ihr|uns|euch|ihnen|Ihnen)\\s+(?:bitte\\s+|mal\\s+|doch\\s+|morgen\\s+|heute\\s+)?(den|die|das|einen|eine|ein|meinen|meine|mein|deinen|deine|dein|seinen|seine|ihren|ihre|unseren|unsere|es|ihn)\\b", "iu").test(main);
      }},
    {id: "deshalb", title: "deshalb, trotzdem, dann: inversão", short: "Esses advérbios ocupam a 1ª posição: deshalb bleibe ich zu Hause (verbo logo depois).",
      body: ["deshalb/deswegen/daher (por isso), trotzdem (mesmo assim), dann (então), außerdem (além disso) e sonst (senão) são advérbios, não conjunções: quando abrem a oração, ocupam a 1ª posição e o verbo vem logo em seguida, antes do sujeito.",
        "Compare: Ich bin krank, deshalb bleibe ich zu Hause (advérbio: inversão) × …, weil ich krank bin (verbo no fim) × …, denn ich bin krank (ordem normal). trotzdem é o par de obwohl: Es regnet, trotzdem gehen wir spazieren = Obwohl es regnet, gehen wir spazieren."],
      trap: ["Ich bin müde, deshalb ich gehe ins Bett.", "Ich bin müde, deshalb gehe ich ins Bett."],
      examples: [["Es war spät, trotzdem hat er noch gearbeitet.", "Era tarde; mesmo assim ele ainda trabalhou."], ["Der Bus kam nicht, deswegen bin ich zu Fuß gegangen.", "O ônibus não veio; por isso fui a pé."]],
      detect: c => /deshalb|trotzdem|deswegen/.test(alvo(c)) || /\b(deshalb|deswegen|daher|trotzdem|sonst)\s+\p{L}+/u.test(low(c))},
    // ---------- B1 (25/10/2026, escrito pelo Claude: revisar com o tutor) ----------
    {id: "obwohl", title: "obwohl × trotzdem (embora × mesmo assim)", short: "obwohl abre oração com o verbo no fim; trotzdem é advérbio e puxa o verbo para logo depois dele.",
      body: ["obwohl = embora, apesar de que. É conjunção de subordinada: o verbo conjugado vai para o fim. Obwohl ich müde bin, lerne ich noch. Se a oração com obwohl vem primeiro, a principal começa pelo verbo (…, lerne ich noch).",
        "trotzdem diz a mesma coisa pelo outro lado: Ich bin müde. Trotzdem lerne ich noch. É advérbio: ocupa a 1ª posição e o verbo vem logo depois. Em português “embora” pede subjuntivo; em alemão o verbo fica no indicativo, só muda de lugar."],
      trap: ["Obwohl ich bin müde, ich lerne noch.", "Obwohl ich müde bin, lerne ich noch."],
      examples: [["Obwohl es regnet, gehen wir spazieren.", "Embora esteja chovendo, vamos passear."], ["Er hat Fieber. Trotzdem will er arbeiten.", "Ele está com febre. Mesmo assim quer trabalhar."]],
      detect: c => /obwohl/.test(alvo(c)) || /\bobwohl\b/.test(low(c))},
    {id: "temporal", title: "nachdem, bevor, während, seitdem, sobald", short: "Conjunções de tempo: abrem oração com o verbo no fim. Com nachdem, o que veio antes vai num tempo anterior.",
      body: ["Todas mandam o verbo conjugado para o fim: bevor (antes que), nachdem (depois que), während (enquanto), seitdem ou seit (desde que), sobald (assim que), bis (até que). Bevor wir essen, waschen wir die Hände.",
        "nachdem fala do que aconteceu antes: com a principal no presente, use o Perfekt (Nachdem ich gegessen habe, gehe ich los); com a principal no passado, o Plusquamperfekt (Nachdem ich gegessen hatte, ging ich los). Em português dizemos “antes de comer”; em alemão é uma oração completa, com sujeito. während e bis também são preposições (während der Arbeit, bis morgen)."],
      trap: ["Bevor ich gehe ins Bett, lese ich noch.", "Bevor ich ins Bett gehe, lese ich noch."],
      examples: [["Sobald ich zu Hause bin, rufe ich dich an.", "Assim que eu chegar em casa, te ligo."], ["Während Sie warten, können Sie den Fragebogen ausfüllen.", "Enquanto o senhor espera, pode preencher o questionário."]],
      detect: c => /\b(nachdem|bevor|seitdem|sobald)\b|während \(conjun/.test(alvo(c))
        || /(^|,\s*)(nachdem|bevor|seitdem|sobald)\s/.test(low(c)) || /(^|,\s*)(während|seit|bis)\s+(ich|du|er|sie|es|wir|ihr|man)\s/.test(low(c))},
    {id: "plusquam", title: "Plusquamperfekt: o passado antes do passado", short: "hatte/war + particípio: o que já tinha acontecido antes de outro fato no passado.",
      body: ["Forma-se como o Perfekt, mas com haben e sein no Präteritum: ich hatte gegessen (eu tinha comido), ich war gegangen (eu tinha ido). Quem usa sein no Perfekt usa war no Plusquamperfekt.",
        "Serve para o que aconteceu antes de outro fato passado, muito com nachdem e als: Als ich ankam, hatte die Besprechung schon angefangen. É o nosso “tinha feito”; o erro comum é trocar hatte e war (ich hatte gegangen)."],
      trap: ["Als wir ankamen, hatte der Zug schon abgefahren.", "Als wir ankamen, war der Zug schon abgefahren."],
      examples: [["Nachdem ich gegessen hatte, bin ich spazieren gegangen.", "Depois de comer, fui passear."], ["Der Patient hatte die Tabletten schon genommen.", "O paciente já tinha tomado os comprimidos."]],
      detect: c => /plusquamperfekt/.test(alvo(c)) || lastAux(low(c), /^(hatte|hattest|hatten|hattet|war|warst|waren|wart)$/)},
    {id: "zuinf", title: "zu + infinitivo", short: "Depois de muitos verbos e expressões, o infinitivo vai para o fim com zu: Ich versuche, pünktlich zu sein.",
      body: ["Verbos como versuchen, vergessen, anfangen, aufhören, vorhaben e hoffen, e expressões como Zeit haben, Lust haben, es ist wichtig, es fällt mir schwer, pedem zu + infinitivo no fim: Ich habe keine Zeit, heute zu kochen. Com verbo separável, o zu entra no meio: anzurufen, mitzubringen.",
        "Modais (können, müssen, wollen…), werden e lassen nunca levam zu. ohne … zu (sem) e statt … zu (em vez de) seguem a mesma regra: Er ist gegangen, ohne zu bezahlen. brauchen + nicht/nur … zu = não precisar / só precisar: Sie brauchen nicht zu warten. Em português o infinitivo vem logo depois (tento chegar cedo); em alemão vai para o fim."],
      trap: ["Ich habe vergessen dich anrufen.", "Ich habe vergessen, dich anzurufen."],
      examples: [["Es ist wichtig, genug zu trinken.", "É importante beber o suficiente."], ["Sie brauchen nichts mitzubringen.", "O senhor não precisa trazer nada."]],
      detect: c => /infinitiv mit zu|\+ zu\b|ohne … zu|statt … zu|brauchen … zu/.test(alvo(c))
        || (!/(^|,\s*)um\s/.test(low(c)) && /\bzu\s+\p{Ll}+(en|ern|eln)\s*($|[,.!?])|\b(an|auf|aus|ein|mit|ab|vor|zurück|nach|weg|teil|fest|los|vorbei|her|hin)zu\p{Ll}+en\b/u.test(c.frase))},
    {id: "futur", title: "Futur I: werden + infinitivo", short: "werden no 2º lugar e o infinitivo no fim: Ich werde morgen anrufen. Também serve para suposições.",
      body: ["O futuro com werden: werden conjugado no 2º lugar e o infinitivo no fim. Nächstes Jahr werde ich nach Deutschland ziehen. No dia a dia o alemão usa muito o presente com uma palavra de tempo (Morgen rufe ich an); o Futur deixa o plano, a promessa ou o aviso mais claros.",
        "Com wohl ou wahrscheinlich, vira suposição sobre o agora: Er wird wohl krank sein (ele deve estar doente). Não confunda: werden + substantivo ou adjetivo = tornar-se (Ich werde Arzt); werden + particípio = passiva (Sie werden operiert)."],
      trap: ["Ich werde anrufen dich morgen.", "Ich werde dich morgen anrufen."],
      examples: [["Es wird ein bisschen wehtun.", "Vai doer um pouco."], ["Wir werden Sie morgen früh operieren.", "Vamos operar o senhor amanhã cedo."]],
      detect: c => {
        if (/futur i\b|futur 1|werden \+ inf/.test(alvo(c))) return true;
        // Oração principal: werden no 1º ou 2º lugar e infinitivo no fim (sem modal no fim, que seria passiva: “geklärt werden müssen”).
        return c.frase.split(/[,;]/).some(part => {
          const w = part.replace(/[.!?…„“"]/g, " ").trim().split(/\s+/), end = w[w.length - 1] || "", k = w.findIndex(x => /^(werde|wirst|wird|werden|werdet)$/i.test(x));
          // Sujeito pronome logo antes ou depois de werden (a passiva costuma ter substantivo: “wird eine Kontrolle empfohlen”),
          // e o fim não pode ser particípio forte com prefixo inseparável (empfohlen, entschieden, beschrieben).
          const pron = /^(ich|du|er|sie|es|wir|ihr|man)$/i;
          if (k < 0 || !(pron.test(w[k - 1] || "") || pron.test(w[k + 1] || ""))) return false;
          if (/^(be|emp|ent|er|ver|zer)\p{Ll}*(ieben|ieden|ochen|ohlen|ossen|unden|ungen|iehen|ogen|orben|ommen|eben|essen|alten|angen|assen|oren)$/u.test(end)) return false;
          return k >= 0 && k <= 3 && w.length >= 3 && /^\p{Ll}{3,}en$/u.test(end) && !/^(können|müssen|sollen|dürfen|wollen|werden)$/.test(end)
            && (!/^ge/.test(end) || ["gehen", "geben"].includes(end)) && !/^(ab|an|auf|aus|ein|mit|vor|zu|nach|weg|zurück|fest|los|vorbei)ge\p{Ll}+en$/u.test(end);
        });
      }},
    {id: "konj2verg", title: "Konjunktiv II no passado: hätte/wäre + particípio", short: "O que teria acontecido: Ich hätte angerufen · Ich wäre gekommen · Ich hätte kommen sollen.",
      body: ["Para o que não aconteceu (irreal no passado): hätte ou wäre + particípio no fim. A escolha entre hätte e wäre é a mesma do Perfekt: Ich hätte dich angerufen · Wir wären früher gekommen. Wenn ich das gewusst hätte, … = se eu tivesse sabido, …",
        "Com modal, aparecem dois infinitivos no fim e o auxiliar é sempre hätte: Ich hätte früher kommen sollen (eu devia ter vindo antes) · Sie hätten mich anrufen können (o senhor podia ter me ligado). É o “teria feito” e o “devia ter feito” do português."],
      trap: ["Wir hätten früher gekommen.", "Wir wären früher gekommen."],
      examples: [["Hätten Sie früher angerufen, hätten wir einen Termin gehabt.", "Se o senhor tivesse ligado antes, teríamos tido um horário."], ["Du hättest mir das sagen sollen.", "Você devia ter me dito isso."]],
      detect: c => /konjunktiv ii no passado|konjunktiv ii passado/.test(alvo(c)) || lastAux(low(c), /^(hätte|hättest|hätten|hättet|wäre|wärst|wären|wärt)$/, true)},
    {id: "passiv2", title: "Passiva com modal e no Perfekt", short: "muss gemacht werden · ist gemacht worden: werden vai para o fim, e no Perfekt vira worden (sem ge-).",
      body: ["Com modal, a passiva termina em particípio + werden: Der Verband muss gewechselt werden · Das kann morgen gemacht werden. O modal fica no 2º lugar, como sempre.",
        "No Perfekt, a passiva usa sein + particípio + worden: Der Befund ist schon geschrieben worden. É worden, nunca geworden (geworden é o Perfekt de werden = tornar-se: Er ist Arzt geworden). No Arztbrief isso aparece o tempo todo."],
      trap: ["Der Patient ist gestern operiert geworden.", "Der Patient ist gestern operiert worden."],
      examples: [["Die Wunde muss jeden Tag kontrolliert werden.", "A ferida precisa ser controlada todo dia."], ["Ihr Antrag ist schon bearbeitet worden.", "O seu pedido já foi processado."]],
      detect: c => /passiv com modal|passiv perfekt|passiva com modal/.test(alvo(c)) || /\bworden\b/.test(low(c))
        || /\b(muss|müssen|musst|kann|können|kannst|darf|dürfen|soll|sollen|sollte|sollten|musste|mussten|konnte|konnten)\b[^,.!?]*\s(\p{Ll}*ge\p{Ll}+(t|en)|\p{Ll}+iert)\s+werden\b/u.test(low(c))},
    {id: "ndekl", title: "n-Deklination: den Patienten, dem Kollegen", short: "Alguns masculinos ganham -n ou -en fora do nominativo: der Patient → den, dem, des Patienten.",
      body: ["Um grupo de masculinos ganha -(e)n em todos os casos, menos no nominativo singular: der Patient → den Patienten, dem Patienten, des Patienten. São sobretudo pessoas e animais: der Kollege, der Kunde, der Junge, der Nachbar, der Mensch, der Student, der Praktikant, der Assistent, der Tourist, der Zeuge.",
        "der Herr ganha só -n no singular (Ich habe Herrn Becker angerufen) e -en no plural (meine Herren). No hospital é constante: Ich untersuche den Patienten · Ich spreche mit dem Kollegen. Em português nada muda, por isso é fácil esquecer o -en."],
      trap: ["Ich untersuche jetzt den Patient.", "Ich untersuche jetzt den Patienten."],
      examples: [["Kennen Sie Herrn Wagner?", "O senhor conhece o senhor Wagner?"], ["Ich frage mal den Kollegen.", "Vou perguntar ao colega."]],
      detect: c => /n-deklination/.test(alvo(c)) || /\bHerrn\b/.test(c.frase)
        || /\b(den|dem|des|einen|einem|eines|diesen|diesem|jeden|jedem|keinen|keinem|meinen|meinem|deinen|deinem|seinen|seinem|ihren|ihrem|Ihren|Ihrem|unseren|unserem)\s+(\p{Ll}+en\s+)?(Patienten|Kollegen|Kunden|Studenten|Praktikanten|Assistenten|Touristen|Polizisten|Nachbarn|Menschen|Jungen|Zeugen|Experten|Neffen)\b/u.test(c.frase)},
    {id: "lassen", title: "lassen + infinitivo: mandar fazer", short: "lassen + infinitivo no fim (sem zu) = mandar fazer ou deixar: Ich lasse das Auto reparieren.",
      body: ["lassen com outro verbo no infinitivo, sem zu, quer dizer mandar fazer (Ich lasse mir die Haare schneiden = corto o cabelo no salão) ou deixar (Lass mich das machen = deixa que eu faço). O infinitivo vai para o fim. Lass uns … = vamos …",
        "No Perfekt, aparecem dois infinitivos no fim: Ich habe das Auto reparieren lassen. sich lassen + infinitivo = dá para fazer: Das lässt sich leicht erklären. Em português dizemos “mandei consertar”; em alemão o erro típico é pôr zu antes do infinitivo."],
      trap: ["Ich lasse das Auto zu reparieren.", "Ich lasse das Auto reparieren."],
      examples: [["Lassen Sie Ihren Blutdruck regelmäßig kontrollieren.", "Mande medir a sua pressão regularmente."], ["Lass uns morgen weiterreden.", "Vamos continuar a conversa amanhã."]],
      detect: c => /lassen \+ inf|mandar fazer|sich lassen/.test(alvo(c))
        || /\s\p{Ll}+en\s+lassen\s*[.!?]?$/u.test(c.frase)
        || (/\b(lass|lasse|lässt|lasst|lassen|ließ|ließen)\b[^,.!?;]*\s\p{Ll}+en\s*[.!?]?$/iu.test(c.frase) && !/\s(offen|liegen|stehen)\s*[.!?]?$/.test(c.frase))},
    {id: "indem", title: "indem e sodass: como e com que resultado", short: "indem = fazendo (o meio); sodass = de modo que (a consequência). Os dois mandam o verbo para o fim.",
      body: ["indem responde “como?”: Sie können den Blutdruck senken, indem Sie weniger Salz essen (comendo menos sal). Em português usamos o gerúndio; em alemão é uma oração com sujeito e o verbo no fim.",
        "sodass (ou so …, dass) responde “e o que aconteceu?”: Es hat stark geregnet, sodass das Spiel ausgefallen ist. Com so + adjetivo: Ich war so müde, dass ich sofort eingeschlafen bin. As duas são conjunções de subordinada: verbo conjugado no fim."],
      trap: ["Sie lernen schneller, indem Sie sprechen jeden Tag.", "Sie lernen schneller, indem Sie jeden Tag sprechen."],
      examples: [["Ich lerne Vokabeln, indem ich sie laut wiederhole.", "Aprendo vocabulário repetindo em voz alta."], ["Er hatte hohes Fieber, sodass wir ihn aufgenommen haben.", "Ele estava com febre alta, de modo que o internamos."]],
      detect: c => /indem|sodass|so …, dass/.test(alvo(c)) || /\bindem\b|\bsodass\b|\bso\s+\p{L}+,\s*dass\b/u.test(low(c))},
    // ---------- B2 (25/10/2026, escrito pelo Claude: revisar com o tutor) ----------
    {id: "konj1", title: "Konjunktiv I: o que outra pessoa disse", short: "er sei, er habe, man werde: o discurso indireto do jornal, do laudo e da passagem de caso.",
      body: ["Para contar o que outra pessoa disse sem assumir que é verdade, o alemão escrito usa o Konjunktiv I: Der Patient gibt an, er habe seit gestern Fieber. Laut Bericht sei die Operation gut verlaufen. Forma-se com a raiz do infinitivo + e: er habe, er komme, er könne, man werde; sein é irregular: ich sei, er sei, sie seien.",
        "Onde o Konjunktiv I é igual ao presente (sie haben, wir kommen), usa-se o Konjunktiv II (sie hätten, wir kämen) ou würde. Na fala, muita gente usa o indicativo (Er sagt, er hat Fieber); no Arztbrief, no jornal e na prova escrita, o Konjunktiv I é o esperado. Em português usamos só “disse que tinha”."],
      trap: ["Der Patient berichtet, er hat seit drei Tagen Fieber.", "Der Patient berichtet, er habe seit drei Tagen Fieber."],
      examples: [["Die Patientin gibt an, sie sei gestern gestürzt.", "A paciente relata que caiu ontem."], ["Der Minister sagte, man werde die Wartezeiten verkürzen.", "O ministro disse que vão reduzir as filas."]],
      detect: c => /konjunktiv i\b|discurso indireto/.test(alvo(c)) && !/konjunktiv ii/.test(alvo(c))
        || (/(?<!\b(ich|du|wir|ihr)\s)\b(er|sie|es|man)\s+(sei|habe|werde|könne|müsse|solle|dürfe|wolle|nehme|komme|gebe)\b/.test(low(c)) && !/\bes sei denn\b/.test(low(c)))
        || /(^|,\s*|\bdass\s+)(der|die|das|ihr|sein|mein)\s+\p{Lu}\p{Ll}+\s+(sei|seien|habe|werde|könne|müsse|nehme)\b(?!\s+ich\b)/u.test(c.frase)},
    {id: "partizip", title: "Partizipialattribut: o adjetivo que vira oração", short: "der gestern aufgenommene Patient = o paciente que foi internado ontem. Tudo fica entre o artigo e o substantivo.",
      body: ["O alemão escrito põe uma oração inteira antes do substantivo, usando o particípio como adjetivo: der gestern aufgenommene Patient (o paciente que foi internado ontem), die seit Tagen zunehmende Luftnot (a falta de ar que aumenta há dias). O particípio leva a terminação de adjetivo (-e, -en, -er…).",
        "Particípio II (aufgenommen) = algo que foi feito; particípio I (zunehmend, do infinitivo + d) = algo que está acontecendo. Para ler, comece pelo artigo, pule até o substantivo e depois volte: der … Patient → que paciente? o … aufgenommene. Em português isso vira oração com “que”; no Arztbrief e nos textos da prova é muito comum."],
      trap: ["Der gestern aufgenommen Patient hat Fieber.", "Der gestern aufgenommene Patient hat Fieber."],
      examples: [["Die vom Hausarzt verordneten Tabletten haben nicht geholfen.", "Os comprimidos receitados pelo médico de família não ajudaram."], ["Bei zunehmender Luftnot melden Sie sich bitte sofort.", "Se a falta de ar aumentar, avise imediatamente."]],
      detect: c => /partizipialattribut|particípio como adjetivo/.test(alvo(c))
        || /\b([Dd]er|[Dd]ie|[Dd]as|[Dd]en|[Dd]em|[Dd]es|[Ee]in|[Ee]ine|[Ee]inen|[Ee]inem|[Ee]iner|[Ee]ines|[Bb]ei|[Mm]it)\s+([\p{L}\d-]+\s+){0,4}(\p{Ll}+end|\p{Ll}*ge\p{Ll}+t|\p{Ll}*ge\p{Ll}+en|\p{Ll}+iert|(be|ver|er|ent|emp|zer)\p{Ll}{3,}t)(e|en|er|es|em)\s+(?!Sie\b|Ihnen\b|Ihr\b|Ihre\b)\p{Lu}/u.test(c.frase)
          && /\b([Dd]er|[Dd]ie|[Dd]as|[Dd]en|[Dd]em|[Dd]es|[Ee]in|[Ee]ine|[Ee]inen|[Ee]inem|[Ee]iner|[Ee]ines|[Bb]ei|[Mm]it)\s+(([\p{L}\d-]+\s+){1,4}(\p{Ll}*ge\p{Ll}+t|\p{Ll}*ge\p{Ll}+en|\p{Ll}+iert|(be|ver|er|ent|emp|zer)\p{Ll}{3,}t)|\p{Ll}+end)(e|en|er|es|em)\s+(?!Sie\b|Ihnen\b|Ihr\b|Ihre\b)\p{Lu}/u.test(c.frase)},
    {id: "nominal", title: "Nominalização: o estilo do laudo", short: "zur Abklärung (para esclarecer), nach Normalisierung (depois que normalizou), bei Verschlechterung (se piorar).",
      body: ["O alemão formal troca orações por substantivos: em vez de um … zu abzuklären, zur Abklärung; em vez de nachdem sich die Werte normalisiert hatten, nach Normalisierung der Werte; em vez de wenn es schlechter wird, bei Verschlechterung. O verbo vira substantivo em -ung (quase sempre feminino) e o que era objeto vai para o genitivo.",
        "Pares úteis: zur (um … zu), nach (nachdem), bei (wenn), vor (bevor), wegen ou aufgrund (weil), trotz (obwohl). No Arztbrief e na apresentação do caso isso é o normal: Die Aufnahme erfolgte zur Abklärung von Thoraxschmerzen. Na conversa com o paciente, volte às orações: é mais claro."],
      trap: ["Die Aufnahme erfolgte für abzuklären die Schmerzen.", "Die Aufnahme erfolgte zur Abklärung der Schmerzen."],
      examples: [["Nach Rücksprache mit dem Oberarzt wurde die Therapie angepasst.", "Depois de conversar com o Oberarzt, a terapia foi ajustada."], ["Bei Verschlechterung des Zustands bitte sofort den Arzt rufen.", "Se o estado piorar, chamar o médico imediatamente."]],
      // Só o padrão do laudo, sem artigo: “zur Abklärung”, “nach Rücksprache”, “bei Verschlechterung” (não “bei der Planung”).
      detect: c => /nominaliza/.test(alvo(c))
        || /\b(zur|nach|bei|vor|aufgrund)\s+(?!Verfügung\b|Sprache\b|Kenntnis\b|Diskussion\b)\p{Lu}\p{Ll}*(ung|ierung)\s+(des|der|eines|einer|von)\b/u.test(c.frase)
        || /\b(zur Abklärung|zur Überwachung|zur Behandlung|zur Kontrolle von|nach Rücksprache|nach Absprache|bei Verschlechterung|bei Bedarf|nach Normalisierung|nach Entlassung|bei Aufnahme|vor Beginn|nach Abschluss)\b/.test(c.frase)},
    {id: "vermutung", title: "Suposição e relato: dürfte, muss, soll, will, wird … haben", short: "Modais que dizem o quanto você tem certeza (muss, dürfte, könnte) ou de quem é a informação (soll, will).",
      body: ["Suposição, da mais certa à menos certa: muss (com certeza: Er muss krank sein), dürfte (provavelmente: Das dürfte die Ursache sein), wird wohl (deve ser: Er wird wohl schlafen), könnte (talvez: Es könnte eine Allergie sein). Sobre o passado, o infinitivo vira particípio + haben/sein: Er muss gestürzt sein · Er wird den Termin vergessen haben (Futur II).",
        "Relato: soll = dizem que (Der neue Chefarzt soll sehr streng sein); will = ele afirma, sem prova (Er will nichts gegessen haben). Em português dizemos “deve ter caído”, “dizem que é”, “ele diz que não comeu”; em alemão o modal faz isso sozinho."],
      trap: ["Er muss sein gestürzt.", "Er muss gestürzt sein."],
      examples: [["Bei der Temperatur muss er mehrere Stunden draußen gelegen haben.", "Com essa temperatura, ele deve ter ficado horas lá fora."], ["Der Infarkt dürfte schon einige Jahre zurückliegen.", "O infarto deve ter sido há alguns anos."]],
      detect: c => /futur ii|suposição|boato|afirma \(sem|dedução/.test(alvo(c)) || /\bdürften?\b/.test(low(c))
        || /\b(muss|müssen|soll|sollen|will|wollen|könnte|könnten|wird|werden)\b[^,.;!?]*\s(\p{Ll}*ge\p{Ll}+(t|en)|\p{Ll}+iert)\s+(haben|sein)\s*[.!?,;]?\s*$/u.test(low(c).split(/[,;]/).pop())},
    {id: "passivers", title: "Substitutos da passiva: lässt sich, ist zu, -bar", short: "Das lässt sich erklären · Das ist zu beachten · Das ist behandelbar: três jeitos de dizer “pode/deve ser feito”.",
      body: ["Além de werden + particípio, o alemão tem atalhos para “pode ser feito”: sich lassen + infinitivo (Das lässt sich leicht erklären = isso pode ser explicado facilmente) e adjetivos em -bar (behandelbar = tratável, erreichbar = alcançável, sichtbar = visível).",
        "sein + zu + infinitivo diz “pode” ou “deve ser feito”, conforme o contexto: Die Tabletten sind nüchtern einzunehmen (devem ser tomados em jejum) · Das ist kaum zu glauben (é difícil de acreditar). Com verbo separável, o zu entra no meio (einzunehmen). Nas bulas, avisos e laudos isso aparece o tempo todo."],
      trap: ["Die Tabletten sind nüchtern einnehmen.", "Die Tabletten sind nüchtern einzunehmen."],
      examples: [["Das Problem lässt sich leider nicht schnell lösen.", "O problema infelizmente não pode ser resolvido rápido."], ["Der Tumor ist gut behandelbar.", "O tumor é bem tratável."]],
      detect: c => /passiversatz|sich lassen|sein \+ zu|ist zu \+|-bar/.test(alvo(c)) || /\b(lässt|lassen)\s+sich\b/.test(low(c))
        || /\b(ist|sind|war|waren)\b[^,.;!?]*\s(zu\s+\p{Ll}+en|\p{Ll}+zu\p{Ll}+en)\s*[.!?,]/u.test(c.frase)
        || (/\b\p{Ll}{3,}bar(e|en|er|es|em)?\b/u.test(low(c)) && !/\b(vereinbar|dankbar|wunderbar|offenbar|scheinbar|unmittelbar|sonderbar|furchtbar|nachbar|fruchtbar|kostbar|unfehlbar)\p{Ll}*\b/u.test(low(c)))},
    {id: "genpraep", title: "Preposições com genitivo: aufgrund, infolge, hinsichtlich", short: "aufgrund des Befunds, innerhalb einer Woche, hinsichtlich der Therapie: o registro formal pede genitivo.",
      body: ["Algumas preposições pedem genitivo: aufgrund (por causa de), infolge (em consequência de), hinsichtlich e bezüglich (quanto a), angesichts (diante de), innerhalb e außerhalb (dentro/fora de), anhand (com base em), anstelle (no lugar de), mithilfe (com a ajuda de). Também trotz, wegen, statt e während, que na fala às vezes vão com dativo.",
        "No genitivo, o artigo vira des (masculino e neutro, e o substantivo ganha -s/-es) ou der (feminino e plural): aufgrund des Befundes, innerhalb der nächsten Tage. Em textos formais, no Arztbrief e em cartas a órgãos, use o genitivo; aufgrund e infolge nunca vão com dativo."],
      trap: ["Aufgrund dem schlechten Wetter fällt der Ausflug aus.", "Aufgrund des schlechten Wetters fällt der Ausflug aus."],
      examples: [["Innerhalb einer Woche erhalten Sie den Befund.", "Em até uma semana o senhor recebe o laudo."], ["Angesichts der Laborwerte empfehle ich eine stationäre Aufnahme.", "Diante dos exames, recomendo internação."]],
      detect: c => /\+ genitivo/.test(alvo(c)) && /aufgrund|infolge|hinsichtlich|bezüglich|angesichts|anhand|innerhalb|außerhalb|trotz|wegen|statt|während|mithilfe|anstelle/.test(alvo(c))
        || /\b(aufgrund|infolge|hinsichtlich|bezüglich|angesichts|anhand|innerhalb|außerhalb|anstelle|mithilfe|zugunsten)\s+(des|der|eines|einer|meines|meiner|seines|seiner|ihres|ihrer|unseres|unserer|dieses|dieser|jedes|jeder)\b/i.test(c.frase)},
    {id: "fvg", title: "Funktionsverbgefüge: in Frage kommen, zur Verfügung stehen", short: "Substantivo + verbo “vazio” que juntos dizem uma coisa só: in Anspruch nehmen = usar, zur Verfügung stehen = estar disponível.",
      body: ["No alemão formal, muitos verbos simples viram um substantivo + um verbo de apoio: in Frage kommen (ser possível, ser opção), zur Verfügung stehen (estar disponível), in Anspruch nehmen (usar, recorrer a), zum Ausdruck bringen (expressar), Rücksicht nehmen auf (levar em conta), eine Entscheidung treffen (decidir), in Kauf nehmen (aceitar um custo).",
        "O sentido está no substantivo; o verbo só “carrega”. Por isso não dá para traduzir palavra por palavra nem trocar o verbo: é eine Entscheidung treffen, não machen. Aprenda como bloco, com a preposição. Na FSP: Differenzialdiagnostisch kommen eine Lungenembolie und eine Aortendissektion in Frage."],
      trap: ["Wir müssen heute eine Entscheidung machen.", "Wir müssen heute eine Entscheidung treffen."],
      examples: [["Für Rückfragen stehen wir Ihnen jederzeit zur Verfügung.", "Para dúvidas, estamos à disposição a qualquer momento."], ["Welche Ursachen kommen in Frage?", "Que causas são possíveis?"]],
      detect: c => /funktionsverb/.test(alvo(c))
        || /\b(in frage|infrage|zur verfügung|in anspruch|zum ausdruck|zur sprache|in kauf|zur kenntnis|in betracht|in kraft|zum einsatz|zur diskussion|in verbindung|unter druck|rücksicht nehmen|rücksicht auf|stellung nehmen|stellung zu|bezug nehmen|entscheidung treffen|entscheidung getroffen|maßnahmen ergreifen|kritik üben|in angriff)\b/.test(low(c))},
    {id: "konnektb2", title: "Conectores do B2: sofern, es sei denn, je nachdem, zumal", short: "sofern (desde que), es sei denn (a não ser que), je nachdem (dependendo de), zumal (ainda mais porque), wohingegen (ao passo que).",
      body: ["Esses conectores deixam o argumento preciso: sofern = desde que, contanto que (Ich komme, sofern ich frei habe); zumal = ainda mais porque (Ich bleibe zu Hause, zumal es regnet); wohingegen = ao passo que (Er ist ruhig, wohingegen sie sehr spontan ist). Os três mandam o verbo para o fim, como weil.",
        "es sei denn = a não ser que, mas depois da vírgula a ordem é a de oração principal: Wir operieren morgen, es sei denn, die Werte verschlechtern sich. je nachdem (ob/wie/wann…) = depende de: Je nachdem, wie es Ihnen geht, entlassen wir Sie morgen. geschweige denn = muito menos, depois de negação: Ich kann kaum laufen, geschweige denn rennen."],
      trap: ["Ich komme mit, sofern habe ich Zeit.", "Ich komme mit, sofern ich Zeit habe."],
      examples: [["Sofern keine Komplikationen auftreten, können Sie am Freitag nach Hause.", "Desde que não haja complicações, o senhor pode ir para casa na sexta."], ["Je nachdem, wie die Werte morgen sind, passen wir die Dosis an.", "Dependendo dos exames de amanhã, ajustamos a dose."]],
      detect: c => /sofern|es sei denn|je nachdem|zumal|wohingegen|insofern|geschweige|wenngleich/.test(alvo(c))
        || /\b(sofern|es sei denn|je nachdem|zumal|wohingegen|insofern|geschweige denn|wenngleich|infolgedessen)\b/.test(low(c))}
  ];
})();
/* Tabelas de consulta (tela Gramática → Tabelas). Primeira coluna = rótulo; as demais em alemão. */
const GRAM_TABLES = [
  {title: "Artigo definido", note: "No dativo plural, o substantivo ganha -n (mit den Kindern). No genitivo masculino e neutro, ganha -s ou -es (des Mannes).",
    head: ["", "Masculino", "Feminino", "Neutro", "Plural"],
    rows: [["Nominativo", "der", "die", "das", "die"], ["Acusativo", "den", "die", "das", "die"], ["Dativo", "dem", "der", "dem", "den"], ["Genitivo", "des", "der", "des", "der"]]},
  {title: "Artigo indefinido e kein", note: "ein não tem plural; kein tem: keine, keine, keinen, keiner. mein, dein, sein, ihr, unser… seguem as mesmas terminações.",
    head: ["", "Masculino", "Feminino", "Neutro", "Plural (kein)"],
    rows: [["Nominativo", "ein", "eine", "ein", "keine"], ["Acusativo", "einen", "eine", "ein", "keine"], ["Dativo", "einem", "einer", "einem", "keinen"], ["Genitivo", "eines", "einer", "eines", "keiner"]]},
  {title: "Pronomes pessoais", head: ["", "Nominativo", "Acusativo", "Dativo"],
    rows: [["eu", "ich", "mich", "mir"], ["você (du)", "du", "dich", "dir"], ["ele", "er", "ihn", "ihm"], ["ela", "sie", "sie", "ihr"], ["neutro", "es", "es", "ihm"],
      ["nós", "wir", "uns", "uns"], ["vocês (ihr)", "ihr", "euch", "euch"], ["eles, elas", "sie", "sie", "ihnen"], ["o senhor, a senhora", "Sie", "Sie", "Ihnen"]]},
  {title: "Possessivos", note: "A terminação segue a coisa possuída, como em ein/eine. euer perde o e quando ganha terminação: eure, euren.",
    head: ["", "masc./neutro", "fem./plural", "acusativo masc.", "dativo masc./neutro"],
    rows: [["meu (ich)", "mein", "meine", "meinen", "meinem"], ["teu, seu (du)", "dein", "deine", "deinen", "deinem"], ["dele (er, es)", "sein", "seine", "seinen", "seinem"],
      ["dela (sie)", "ihr", "ihre", "ihren", "ihrem"], ["nosso (wir)", "unser", "unsere", "unseren", "unserem"], ["de vocês (ihr)", "euer", "eure", "euren", "eurem"],
      ["deles (sie)", "ihr", "ihre", "ihren", "ihrem"], ["do senhor (Sie)", "Ihr", "Ihre", "Ihren", "Ihrem"]]},
  {title: "Adjetivo depois de der, die, das", note: "Exemplos: der neue Kollege · die neue Kollegin · mit dem neuen Kollegen.",
    head: ["", "Masculino", "Feminino", "Neutro", "Plural"],
    rows: [["Nominativo", "-e", "-e", "-e", "-en"], ["Acusativo", "-en", "-e", "-e", "-en"], ["Dativo", "-en", "-en", "-en", "-en"], ["Genitivo", "-en", "-en", "-en", "-en"]]},
  {title: "Adjetivo depois de ein, kein, mein…", note: "Onde o artigo não mostra o gênero, o adjetivo mostra: ein neuer Kollege, ein neues Auto. Plural com keine/meine: meine neuen Kollegen.",
    head: ["", "Masculino", "Feminino", "Neutro", "Plural"],
    rows: [["Nominativo", "-er", "-e", "-es", "-en"], ["Acusativo", "-en", "-e", "-es", "-en"], ["Dativo", "-en", "-en", "-en", "-en"], ["Genitivo", "-en", "-en", "-en", "-en"]]},
  {title: "Adjetivo sem artigo", note: "O adjetivo leva a terminação que o artigo teria: guter Wein, mit kaltem Wasser, frische Brötchen.",
    head: ["", "Masculino", "Feminino", "Neutro", "Plural"],
    rows: [["Nominativo", "-er", "-e", "-es", "-e"], ["Acusativo", "-en", "-e", "-es", "-e"], ["Dativo", "-em", "-er", "-em", "-en"], ["Genitivo", "-en", "-er", "-en", "-er"]]},
  {title: "Preposições e caso", head: ["Caso", "Preposições", "Exemplo"],
    rows: [["Acusativo", "für, durch, gegen, ohne, um, bis", "für den Kurs"], ["Dativo", "aus, bei, mit, nach, seit, von, zu, gegenüber", "mit dem Bus"],
      ["Acus. (wohin?) ou dat. (wo?)", "in, an, auf, über, unter, vor, hinter, neben, zwischen", "in die Stadt · in der Stadt"], ["Genitivo", "wegen, während, trotz, statt", "wegen des Wetters"]]},
  {title: "Presente: sein, haben, werden, modais e wissen", head: ["", "ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"],
    rows: [["sein", "bin", "bist", "ist", "sind", "seid", "sind"], ["haben", "habe", "hast", "hat", "haben", "habt", "haben"], ["werden", "werde", "wirst", "wird", "werden", "werdet", "werden"],
      ["können", "kann", "kannst", "kann", "können", "könnt", "können"], ["müssen", "muss", "musst", "muss", "müssen", "müsst", "müssen"], ["wollen", "will", "willst", "will", "wollen", "wollt", "wollen"],
      ["möchten", "möchte", "möchtest", "möchte", "möchten", "möchtet", "möchten"], ["dürfen", "darf", "darfst", "darf", "dürfen", "dürft", "dürfen"], ["sollen", "soll", "sollst", "soll", "sollen", "sollt", "sollen"],
      ["wissen", "weiß", "weißt", "weiß", "wissen", "wisst", "wissen"]]},
  {title: "Verbos que trocam a vogal (du e er/sie/es)", note: "A troca só acontece com du e er/sie/es; wir, ihr e sie seguem o infinitivo (wir essen, ihr fahrt).",
    head: ["", "ich", "du", "er/sie/es", "Perfekt"],
    rows: [["essen", "esse", "isst", "isst", "hat gegessen"], ["nehmen", "nehme", "nimmst", "nimmt", "hat genommen"], ["sprechen", "spreche", "sprichst", "spricht", "hat gesprochen"],
      ["geben", "gebe", "gibst", "gibt", "hat gegeben"], ["helfen", "helfe", "hilfst", "hilft", "hat geholfen"], ["sehen", "sehe", "siehst", "sieht", "hat gesehen"],
      ["lesen", "lese", "liest", "liest", "hat gelesen"], ["treffen", "treffe", "triffst", "trifft", "hat getroffen"], ["vergessen", "vergesse", "vergisst", "vergisst", "hat vergessen"],
      ["fahren", "fahre", "fährst", "fährt", "ist gefahren"], ["schlafen", "schlafe", "schläfst", "schläft", "hat geschlafen"], ["laufen", "laufe", "läufst", "läuft", "ist gelaufen"],
      ["tragen", "trage", "trägst", "trägt", "hat getragen"], ["waschen", "wasche", "wäschst", "wäscht", "hat gewaschen"], ["einladen", "lade ein", "lädst ein", "lädt ein", "hat eingeladen"]]},
  {title: "Perfekt de verbos frequentes", note: "Com sein: movimento de um lugar para outro e mudança de estado (e sein, bleiben, werden). O resto usa haben.",
    head: ["", "Perfekt", "Tradução"],
    rows: [["gehen", "ist gegangen", "ir"], ["kommen", "ist gekommen", "vir"], ["fahren", "ist gefahren", "ir (de veículo)"], ["fliegen", "ist geflogen", "voar"],
      ["aufstehen", "ist aufgestanden", "levantar-se"], ["bleiben", "ist geblieben", "ficar"], ["sein", "ist gewesen", "ser, estar"], ["werden", "ist geworden", "tornar-se"],
      ["passieren", "ist passiert", "acontecer"], ["machen", "hat gemacht", "fazer"], ["arbeiten", "hat gearbeitet", "trabalhar"], ["kaufen", "hat gekauft", "comprar"],
      ["trinken", "hat getrunken", "beber"], ["schreiben", "hat geschrieben", "escrever"], ["finden", "hat gefunden", "achar"], ["bringen", "hat gebracht", "trazer"],
      ["denken", "hat gedacht", "pensar"], ["anrufen", "hat angerufen", "telefonar"], ["bekommen", "hat bekommen", "receber"], ["verstehen", "hat verstanden", "entender"],
      ["studieren", "hat studiert", "estudar (faculdade)"]]},
  // B1 (25/10/2026)
  {title: "Conjunções que mandam o verbo para o fim (B1)", note: "Todas abrem oração subordinada. während, seit e bis também são preposições (während der Arbeit, seit gestern, bis morgen).",
    head: ["", "Conjunção"],
    rows: [["antes que", "bevor"], ["depois que", "nachdem"], ["enquanto", "während"], ["desde que", "seitdem"], ["assim que", "sobald"], ["até que", "bis"],
      ["embora", "obwohl"], ["fazendo (o meio)", "indem"], ["de modo que", "sodass"]]},
  {title: "n-Deklination", note: "Masculinos que ganham -(e)n fora do nominativo singular. Herr ganha só -n no singular e -en no plural.",
    head: ["", "Nominativo", "Acusativo", "Dativo", "Genitivo"],
    rows: [["paciente", "der Patient", "den Patienten", "dem Patienten", "des Patienten"], ["colega", "der Kollege", "den Kollegen", "dem Kollegen", "des Kollegen"],
      ["senhor", "der Herr", "den Herrn", "dem Herrn", "des Herrn"], ["ser humano", "der Mensch", "den Menschen", "dem Menschen", "des Menschen"],
      ["vizinho", "der Nachbar", "den Nachbarn", "dem Nachbarn", "des Nachbarn"], ["cliente", "der Kunde", "den Kunden", "dem Kunden", "des Kunden"]]},
  {title: "Plusquamperfekt e Konjunktiv II no passado", note: "hatte/war = tinha feito; hätte/wäre = teria feito. A escolha entre haben e sein é a mesma do Perfekt.",
    head: ["", "Plusquamperfekt", "Konjunktiv II passado"],
    rows: [["fazer", "hatte gemacht", "hätte gemacht"], ["ir", "war gegangen", "wäre gegangen"], ["vir", "war gekommen", "wäre gekommen"], ["ser, estar", "war gewesen", "wäre gewesen"],
      ["ter", "hatte gehabt", "hätte gehabt"], ["telefonar", "hatte angerufen", "hätte angerufen"], ["acontecer", "war passiert", "wäre passiert"], ["saber", "hatte gewusst", "hätte gewusst"]]},
  // B2 (25/10/2026)
  {title: "Konjunktiv I (discurso indireto)", note: "Onde o Konjunktiv I é igual ao presente (sie haben, wir können), use o Konjunktiv II (sie hätten, wir könnten).",
    head: ["", "sein", "haben", "werden", "können"],
    rows: [["ich", "sei", "hätte", "würde", "könne"], ["du", "seist", "habest", "werdest", "könnest"], ["er, sie, es, man", "sei", "habe", "werde", "könne"],
      ["wir", "seien", "hätten", "würden", "könnten"], ["sie, Sie", "seien", "hätten", "würden", "könnten"]]},
  {title: "Preposições com genitivo e Funktionsverbgefüge", note: "aufgrund, infolge, hinsichtlich, angesichts e innerhalb pedem genitivo. Os blocos da direita se aprendem inteiros, com a preposição.",
    head: ["", "Alemão"],
    rows: [["por causa de", "aufgrund"], ["em consequência de", "infolge"], ["quanto a", "hinsichtlich"], ["diante de", "angesichts"], ["dentro de (prazo)", "innerhalb"],
      ["ser uma possibilidade", "in Frage kommen"], ["estar à disposição", "zur Verfügung stehen"], ["usar, recorrer a", "in Anspruch nehmen"], ["decidir", "eine Entscheidung treffen"], ["levar em conta", "Rücksicht nehmen"]]}
];
/* Motivos de erro que o aluno pode marcar e os tópicos de gramática ligados a cada um. */
const ERROR_REASONS = [
  {id: "vocab", label: "Vocabulário", topics: ["falsos", "wfragen", "daworter", "alswenn", "fvg", "nominal"]},
  {id: "ordem", label: "Ordem das palavras", topics: ["v2", "nebensatz", "modal", "trennbar", "konnektoren", "deshalb", "indirekt", "relativ", "umzu", "doppelkonj", "obwohl", "temporal", "zuinf", "indem", "konnektb2", "partizip"]},
  {id: "genero", label: "Gênero/artigo", topics: ["genero", "possessiv", "adjektiv"]},
  {id: "caso", label: "Caso", topics: ["akkusativ", "dativ", "praep", "genitiv", "adjektiv", "zweiobjekt", "relativ", "ndekl", "genpraep"]},
  {id: "verbo", label: "Verbo/conjugação", topics: ["perfekt", "praeteritum", "modal", "trennbar", "imperativ", "reflexiv", "konjunktiv", "passiv", "plusquam", "futur", "konj2verg", "passiv2", "lassen", "konj1", "vermutung", "passivers"]},
  {id: "pronuncia", label: "Pronúncia", topics: []},
  {id: "travei", label: "Travei", topics: []}
];
/* Rodada 4 da Gramática (24/10/2026, escrito pelo Claude: revisar com o tutor). Para cada tópico:
   pt = a frase em português que leva ao erro da armadilha; clinic = [alemão, tradução, para que serve no hospital/na FSP]. */
const GRAM_EXTRA = {
  v2: {pt: "Hoje eu trabalho.", clinic: ["Heute Nacht habe ich schlecht geschlafen.", "Esta noite dormi mal.", "O paciente começa pelo tempo; o verbo continua em 2º lugar."]},
  nebensatz: {pt: "Aprendo alemão porque quero trabalhar na Alemanha.", clinic: ["Ich glaube, dass Sie eine Lungenentzündung haben.", "Acho que o senhor está com pneumonia.", "Ao comunicar o diagnóstico: dass manda haben para o fim."]},
  trennbar: {pt: "Eu ligo para você amanhã.", clinic: ["Atmen Sie bitte tief ein.", "Respire fundo, por favor.", "No exame físico: einatmen se separa e o ein fecha a frase."]},
  modal: {pt: "Posso vir amanhã.", clinic: ["Sie dürfen heute nichts mehr essen.", "O senhor não pode comer mais nada hoje.", "Jejum antes de exame: dürfen no 2º lugar, essen no fim."]},
  perfekt: {pt: "Eu fui de carro para Berlim.", clinic: ["Sind Sie gestürzt?", "O senhor caiu?", "Anamnese de trauma: stürzen é mudar de lugar, então usa sein."]},
  genero: {pt: "a ponte, o sangue, a dor", clinic: ["das Blut, der Schmerz, das Herz", "o sangue, a dor, o coração", "O gênero não segue o português: o sangue é neutro, a dor é masculina."]},
  akkusativ: {pt: "Tenho um horário.", clinic: ["Ich verschreibe Ihnen einen Hustensaft.", "Vou receitar um xarope para a tosse.", "Na receita: o objeto masculino vira einen."]},
  dativ: {pt: "Eu ajudo você.", clinic: ["Ich helfe Ihnen gleich.", "Já vou ajudar o senhor.", "helfen pede dativo: Ihnen, nunca Sie."]},
  genitiv: {pt: "a atividade do seu coração", clinic: ["Die Ursache der Schmerzen ist noch unklar.", "A causa das dores ainda não está clara.", "No laudo e na apresentação do caso: genitivo plural com der."]},
  praep: {pt: "Eu vou no hospital.", clinic: ["Der Schmerz strahlt in den linken Arm aus.", "A dor irradia para o braço esquerdo.", "Para onde a dor vai: acusativo (in den Arm). Onde ela está: dativo (Schmerzen im Bauch)."]},
  sie: {pt: "Você tem dor? (para um paciente)", clinic: ["Wie kann ich Ihnen helfen?", "Como posso ajudar o senhor?", "Com pacientes, sempre Sie e Ihnen, com maiúscula."]},
  passiv: {pt: "O paciente está sendo operado.", clinic: ["Es wurde ein EKG geschrieben.", "Foi feito um ECG.", "No Arztbrief: a passiva diz o que foi feito sem dizer quem fez."]},
  konjunktiv: {pt: "Eu quero um café.", clinic: ["Könnten Sie sich bitte hinlegen?", "O senhor poderia se deitar, por favor?", "Pedido educado ao paciente: könnten + infinitivo no fim."]},
  negacao: {pt: "Eu não tenho febre.", clinic: ["Ich habe keine Allergien.", "Não tenho alergias.", "Na anamnese: kein nega o substantivo (Allergien, Fieber, Schmerzen)."]},
  falsos: {pt: "Eu vou virar médico.", clinic: ["Die Patientin bekommt eine Infusion.", "A paciente recebe uma infusão.", "bekommen = receber, nunca “virar” (isso é werden)."]},
  imperativ: {pt: "Tome os comprimidos depois de comer.", clinic: ["Machen Sie bitte den Oberkörper frei.", "Tire a roupa da cintura para cima, por favor.", "No exame físico: verbo + Sie, e o frei fecha a frase."]},
  possessiv: {pt: "Essa é a filha dela.", clinic: ["Ist das Ihre Tochter?", "Essa é a filha do senhor?", "Ihre com maiúscula = do senhor/da senhora; ihre = dela."]},
  wfragen: {pt: "Aonde você vai?", clinic: ["Wohin strahlt der Schmerz aus?", "Para onde a dor irradia?", "Ao caracterizar a dor: wohin = para onde; wo = onde."]},
  praeteritum: {pt: "Eu estive doente.", clinic: ["Hatten Sie schon einmal eine Operation?", "O senhor já fez alguma cirurgia?", "Na anamnese: haben e sein no Präteritum (hatten, waren)."]},
  konnektoren: {pt: "Não venho, porque estou doente.", clinic: ["Der Patient hat Fieber, aber keinen Husten.", "O paciente tem febre, mas não tem tosse.", "Na apresentação do caso: aber não muda a ordem."]},
  komparativ: {pt: "Berlim é maior que Munique.", clinic: ["Sind die Schmerzen stärker als gestern?", "As dores estão mais fortes que ontem?", "Evolução dos sintomas: stärker als, nunca “mehr stark wie”."]},
  adjektiv: {pt: "Tenho um apartamento novo.", clinic: ["Haben Sie starke Schmerzen?", "O senhor tem dores fortes?", "Sem artigo, o adjetivo leva a terminação: starke Schmerzen."]},
  reflexiv: {pt: "Eu me sinto bem.", clinic: ["Wie fühlen Sie sich heute?", "Como o senhor se sente hoje?", "sich fühlen precisa do pronome: Sie … sich."]},
  indirekt: {pt: "Pode me dizer onde fica a farmácia?", clinic: ["Können Sie mir sagen, seit wann Sie Schmerzen haben?", "Pode me dizer desde quando tem dor?", "Pergunta educada na anamnese: o verbo vai para o fim."]},
  daworter: {pt: "Eu espero por isso.", clinic: ["Haben Sie Angst davor?", "O senhor tem medo disso?", "Angst vor + uma coisa = davor."]},
  relativ: {pt: "O colega que eu encontrei é simpático.", clinic: ["Das ist das Medikament, das Sie jeden Tag nehmen.", "Esse é o remédio que o senhor toma todo dia.", "O relativo segue o gênero: das Medikament → das."]},
  alswenn: {pt: "Quando eu era criança, morei em Recife.", clinic: ["Als die Schmerzen anfingen, waren Sie zu Hause?", "Quando as dores começaram, o senhor estava em casa?", "Uma vez no passado: als."]},
  umzu: {pt: "Aprendo alemão para trabalhar na Alemanha.", clinic: ["Wir machen ein Röntgenbild, um eine Lungenentzündung auszuschließen.", "Vamos fazer um raio X para descartar pneumonia.", "Explicar a conduta: um … zu + infinitivo."]},
  doppelkonj: {pt: "Não bebo nem café nem chá.", clinic: ["Sie haben weder Fieber noch Husten.", "O senhor não tem nem febre nem tosse.", "weder … noch já nega: sem nicht nem kein."]},
  zweiobjekt: {pt: "Eu dou isso a ele.", clinic: ["Ich erkläre es Ihnen gleich.", "Já explico isso ao senhor.", "Dois pronomes: o acusativo (es) vem antes do dativo (Ihnen)."]},
  // B1 (25/10/2026)
  obwohl: {pt: "Embora esteja melhor, o senhor precisa tomar os comprimidos.", clinic: ["Obwohl Sie sich besser fühlen, nehmen Sie das Antibiotikum bitte bis zum Ende.", "Embora o senhor se sinta melhor, tome o antibiótico até o fim, por favor.", "Adesão ao tratamento: obwohl manda fühlen para o fim e a principal começa pelo verbo."]},
  temporal: {pt: "Antes de comer, tome o comprimido.", clinic: ["Bitte essen Sie nichts, bevor wir Blut abnehmen.", "Por favor, não coma nada antes de colhermos o sangue.", "Preparo de exame: bevor + oração completa com o verbo no fim, não “antes de + infinitivo”."]},
  plusquam: {pt: "As dores tinham começado dois dias antes.", clinic: ["Die Beschwerden hatten zwei Tage vor der Aufnahme begonnen.", "As queixas tinham começado dois dias antes da internação.", "Na anamnese e no Arztbrief: o que veio antes da internação vai no Plusquamperfekt."]},
  zuinf: {pt: "Esqueci de tomar o remédio.", clinic: ["Haben Sie vergessen, die Tabletten zu nehmen?", "O senhor esqueceu de tomar os comprimidos?", "Adesão: vergessen pede vírgula e zu + infinitivo no fim."]},
  futur: {pt: "Vai doer um pouco.", clinic: ["Es wird kurz ein bisschen wehtun.", "Vai doer um pouquinho, rapidinho.", "Antes de uma punção: avisar o que vai acontecer com werden + infinitivo no fim."]},
  konj2verg: {pt: "O senhor devia ter vindo antes.", clinic: ["Sie hätten früher kommen sollen, aber gut, dass Sie jetzt da sind.", "O senhor devia ter vindo antes, mas que bom que está aqui agora.", "Sem culpar o paciente: hätten … sollen, com os dois infinitivos no fim."]},
  passiv2: {pt: "O paciente foi operado ontem.", clinic: ["Der Patient ist gestern operiert worden.", "O paciente foi operado ontem.", "Na passagem de plantão e no Arztbrief: worden, nunca geworden."]},
  ndekl: {pt: "Pode olhar o paciente do quarto 3?", clinic: ["Können Sie sich den Patienten in Zimmer 3 ansehen?", "Pode dar uma olhada no paciente do quarto 3?", "Com colegas: den Patienten, dem Patienten; o -en não pode faltar."]},
  lassen: {pt: "Mande medir a pressão na farmácia.", clinic: ["Lassen Sie Ihren Blutdruck in der Apotheke messen.", "Mande medir a sua pressão na farmácia.", "Orientação ao paciente: lassen + infinitivo no fim, sem zu."]},
  // B2 (25/10/2026)
  konj1: {pt: "O paciente diz que tem febre há três dias.", clinic: ["Der Patient gibt an, er habe seit drei Tagen Fieber.", "O paciente relata ter febre há três dias.", "Anamnese no Arztbrief: o que o paciente contou vai no Konjunktiv I (er habe, er sei)."]},
  partizip: {pt: "O paciente que foi internado ontem está melhor.", clinic: ["Der gestern aufgenommene Patient ist heute fieberfrei.", "O paciente internado ontem está hoje sem febre.", "Passagem de plantão e Arztbrief: o particípio com terminação antes do substantivo."]},
  nominal: {pt: "Ele foi internado para esclarecer a dor no peito.", clinic: ["Die Aufnahme erfolgte zur Abklärung thorakaler Schmerzen.", "A internação ocorreu para investigação de dor torácica.", "Primeira frase do Arztbrief: zur Abklärung + genitivo, no lugar de um … zu."]},
  vermutung: {pt: "Ele deve ter caído em casa.", clinic: ["Er muss zu Hause gestürzt sein, die Prellungen sind frisch.", "Ele deve ter caído em casa; as contusões são recentes.", "Raciocínio clínico na apresentação do caso: muss/dürfte + particípio + sein/haben."]},
  passivers: {pt: "Os comprimidos devem ser tomados em jejum.", clinic: ["Die Tabletten sind morgens nüchtern einzunehmen.", "Os comprimidos devem ser tomados de manhã em jejum.", "Prescrição e bula: sein + zu + infinitivo, com o zu no meio do separável."]},
  genpraep: {pt: "Por causa dos exames, recomendo internação.", clinic: ["Aufgrund der erhöhten Entzündungswerte empfehlen wir eine stationäre Aufnahme.", "Devido aos marcadores inflamatórios elevados, recomendamos internação.", "Arztbrief e conversa com o Oberarzt: aufgrund + genitivo, nunca dativo."]},
  fvg: {pt: "Que diagnósticos são possíveis?", clinic: ["Differenzialdiagnostisch kommen eine Lungenembolie und eine Aortendissektion in Frage.", "Como diagnóstico diferencial, entram embolia pulmonar e dissecção de aorta.", "Fallvorstellung na FSP: in Frage kommen = ser uma possibilidade."]},
  konnektb2: {pt: "O senhor pode ir para casa amanhã, desde que a febre não volte.", clinic: ["Sie können morgen nach Hause, sofern das Fieber nicht wiederkommt.", "O senhor pode ir para casa amanhã, desde que a febre não volte.", "Planejamento de alta: sofern + verbo no fim põe a condição."]},
  indem: {pt: "O senhor pode baixar o açúcar comendo menos doce.", clinic: ["Sie können den Zucker senken, indem Sie weniger Süßes essen.", "O senhor pode baixar o açúcar comendo menos doce.", "Mudança de estilo de vida: o gerúndio do português vira indem + verbo no fim."]},
  deshalb: {pt: "Estou cansado, por isso vou para a cama.", clinic: ["Der Blutdruck ist zu hoch, deshalb bleiben Sie heute hier.", "A pressão está alta demais, por isso o senhor fica aqui hoje.", "Depois de deshalb, o verbo vem logo (bleiben Sie)."]}
};
