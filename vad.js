/* Detector de voz da Conversa: Silero VAD v6 (MIT) rodando na própria tela com o ONNX Runtime Web (MIT), arquivos em
   resources/vad (fora do Git e do instalador). Diz, a cada 32 ms de áudio a 16 kHz, a chance de ser fala humana — barulho,
   batida na mesa e o “tom” do teste não contam, coisa que a regra do volume não sabe. Sem os arquivos (ou se falhar),
   quem chama cai na regra antiga do volume. A parte pura (vadTrack, convBargeAction) é testada em conversa.test.cjs. */
const VAD_FRAME = 512, VAD_RATE = 16000, VAD_FRAME_MS = VAD_FRAME / VAD_RATE * 1000;
/* on = chance para começar a contar fala; off = para continuar (histerese); gapMs = buraco entre palavras que não quebra a fala.
   Com a parceira falando o limiar sobe (o que vaza do alto-falante é fala também). */
const VAD_CFG = {on: .5, onTalking: .6, off: .35, gapMs: 160};
/* Falar por cima da parceira: com ~150 ms de voz ela abaixa o volume (“hesita”); com 500 ms seguidos para de falar.
   “Ja”, “Mhm”, “Genau”, “Ach so” duram menos que isso: ela volta ao volume normal e continua. */
const CONV_BARGE = {duckMs: 150, cutMs: 500, duckVolume: .35};

/* Acompanha a fala quadro a quadro. st = {voiced, start, last}; devolve a duração (ms) da fala contínua até t, 0 se acabou. */
function vadTrack(st, p, t, cfg = VAD_CFG, talking = false) {
  const on = p >= (st.voiced ? cfg.off : (talking ? cfg.onTalking : cfg.on));
  if (on) {
    if (!(st.last > -Infinity) || t - st.last > cfg.gapMs + VAD_FRAME_MS) st.start = t;
    st.last = t;
  }
  st.voiced = on;
  return vadRun(st, t, cfg);
}
function vadRun(st, t, cfg = VAD_CFG) {
  if (!(st.last > -Infinity) || t - st.last > cfg.gapMs + VAD_FRAME_MS) return 0;
  return st.last - st.start + VAD_FRAME_MS;
}
/* O que fazer com a sua voz enquanto ela fala: "cut" (interromper), "duck" (abaixar o volume) ou "none". */
function convBargeAction(runMs) {
  if (runMs >= CONV_BARGE.cutMs) return "cut";
  if (runMs >= CONV_BARGE.duckMs) return "duck";
  return "none";
}

let vadState = {session: null, loading: null, failed: false};
function vadWanted() { return typeof window !== "undefined" && !!window.satzDesktop && settings.convVad !== false; }
/* Carrega o runtime e o modelo uma vez (~0,5 s). Devolve a sessão ou null. */
function vadLoad() {
  if (vadState.session) return Promise.resolve(vadState.session);
  if (vadState.failed || !vadWanted()) return Promise.resolve(null);
  if (vadState.loading) return vadState.loading;
  vadState.loading = (async () => {
    try {
      if (typeof ort === "undefined") await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "vad/ort.wasm.min.js"; s.onload = res; s.onerror = () => rej(new Error("sem o runtime"));
        document.head.append(s);
      });
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = new URL("vad/", location.href).href;
      ort.env.logLevel = "error";
      vadState.session = await ort.InferenceSession.create(new URL("vad/silero_vad_v6.onnx", location.href).href, {executionProviders: ["wasm"]});
      return vadState.session;
    } catch (e) {
      vadState.failed = true;
      if (typeof reportError === "function") reportError("vad", e && e.message || String(e));
      return null;
    } finally { vadState.loading = null; }
  })();
  return vadState.loading;
}
/* Sessão pronta agora, ou null (e começa a carregar para a próxima vez): a escuta não espera o modelo. */
function vadReady() { if (!vadState.session) vadLoad(); return vadState.session; }
/* Um modelo com o próprio estado (um por escuta). run(frame) → chance de fala, 0 a 1. */
function vadModel(session) {
  const ctxLen = 64, zero = () => new ort.Tensor("float32", new Float32Array(2 * 128), [2, 1, 128]);
  let state = zero(), context = new Float32Array(ctxLen);
  const sr = new ort.Tensor("int64", BigInt64Array.from([BigInt(VAD_RATE)]), []);
  return {
    async run(frame) {
      const x = new Float32Array(ctxLen + frame.length);
      x.set(context, 0); x.set(frame, ctxLen);
      context = frame.slice(-ctxLen);
      const out = await session.run({input: new ort.Tensor("float32", x, [1, x.length]), state, sr});
      state = out.stateN;
      return out.output.data[0];
    },
    reset() { state = zero(); context = new Float32Array(ctxLen); }
  };
}
/* Liga o detector a um microfone: onFrame(chance, rms) a cada 32 ms. Devolve {close} ou null se o modelo não estiver pronto. */
async function vadAttach(stream, onFrame) {
  const session = vadReady();
  if (!session) return null;
  try {
    const ctx = new AudioContext({sampleRate: VAD_RATE});
    await ctx.audioWorklet.addModule("vad-worklet.js");
    const src = ctx.createMediaStreamSource(stream), node = new AudioWorkletNode(ctx, "satz-vad"), mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node).connect(mute).connect(ctx.destination);
    const model = vadModel(session);
    let chain = Promise.resolve(), closed = false;
    node.port.onmessage = e => {
      const frame = e.data;
      chain = chain.then(async () => {
        if (closed) return;
        let sum = 0;
        for (const v of frame) sum += v * v;
        const p = await model.run(frame);
        if (!closed) onFrame(p, Math.sqrt(sum / frame.length));
      }).catch(() => {});
    };
    return {close() { closed = true; node.port.onmessage = null; try { src.disconnect(); } catch (e) { /* já solto */ } ctx.close().catch(() => {}); }};
  } catch (e) {
    if (typeof reportError === "function") reportError("vad", e && e.message || String(e));
    return null;
  }
}
