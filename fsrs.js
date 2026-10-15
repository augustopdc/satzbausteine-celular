"use strict";
/* FSRS-5: modelo de memória usado no agendamento e no otimizador.
   Carregado pela página (antes de app.js) e pelo worker do otimizador (importScripts). */
const FSRS = (() => {
  const DEFAULT_W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
  const BOUNDS = [[0.001, 100], [0.001, 100], [0.001, 100], [0.001, 100], [1, 10], [0.001, 4], [0.001, 4], [0.001, 0.75], [0, 4.5], [0, 0.8],
    [0.001, 3.5], [0.001, 5], [0.001, 0.25], [0.001, 0.9], [0, 4], [0, 1], [1, 6], [0, 2], [0, 2]];
  const DECAY = -0.5, FACTOR = 19 / 81;

  const clampD = d => Math.min(10, Math.max(1, d));
  const clampS = s => Math.min(36500, Math.max(0.1, s));
  const initStability = (w, g) => Math.max(0.1, w[g - 1]);
  const initDifficulty = (w, g) => clampD(w[4] - Math.exp(w[5] * (g - 1)) + 1);
  const retrievability = (elapsed, s) => Math.pow(1 + FACTOR * elapsed / s, DECAY);
  function nextDifficulty(w, d, g) {
    const damped = d + (-w[6] * (g - 3)) * (10 - d) / 9;
    return clampD(w[7] * initDifficulty(w, 4) + (1 - w[7]) * damped);
  }
  function recallStability(w, d, s, r, g) {
    const hard = g === 2 ? w[15] : 1, easy = g === 4 ? w[16] : 1;
    return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard * easy);
  }
  function forgetStability(w, d, s, r) {
    const next = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
    return Math.min(next, s / Math.exp(w[17] * w[18]));
  }
  const shortTermStability = (w, s, g) => s * Math.exp(w[17] * (g - 3 + w[18]));

  /* Próximo estado de memória depois de uma avaliação g (1 = errei … 4 = fácil). */
  function step(w, state, g, elapsed) {
    if (!state) return {s: clampS(initStability(w, g)), d: initDifficulty(w, g)};
    const d = nextDifficulty(w, state.d, g);
    let s;
    if (elapsed <= 0) s = shortTermStability(w, state.s, g);
    else {
      const r = retrievability(elapsed, state.s);
      s = g === 1 ? forgetStability(w, state.d, state.s, r) : recallStability(w, state.d, state.s, r, g);
    }
    return {s: clampS(s), d};
  }
  function interval(stability, retention) {
    const r = Math.min(.97, Math.max(.8, Number(retention) || .9));
    return Math.min(36500, Math.max(1, Math.round(stability / FACTOR * (Math.pow(r, 1 / DECAY) - 1))));
  }
  function validWeights(w) {
    return Array.isArray(w) && w.length === DEFAULT_W.length && w.every((v, i) => Number.isFinite(v) && v >= BOUNDS[i][0] && v <= BOUNDS[i][1]);
  }
  return {DEFAULT_W, BOUNDS, DECAY, FACTOR, clampD, clampS, initStability, initDifficulty, retrievability, nextDifficulty,
    recallStability, forgetStability, shortTermStability, step, interval, validWeights};
})();

/* Otimização dos parâmetros a partir do histórico de revisões.
   sequences: lista de revisões por frase/modo, cada uma [{g, elapsed}] em ordem cronológica. */
FSRS.optimize = function optimize(sequences, options = {}) {
  const {iterations = 160, batchSize = 250, onProgress = null} = options;
  const W0 = FSRS.DEFAULT_W, BOUNDS = FSRS.BOUNDS;
  const scale = W0.map(v => Math.max(0.05, Math.abs(v)));
  // Divide por frase: 80% para ajustar, 20% para validar.
  const train = [], valid = [];
  sequences.forEach((seq, i) => ((i * 2654435761) % 10 < 8 ? train : valid).push(seq));
  const countTerms = seqs => seqs.reduce((n, seq) => n + seq.slice(1).filter(r => r.elapsed > 0).length, 0);
  const nTrain = countTerms(train);
  const lambda = 2 / Math.max(1, nTrain);
  function loss(w, seqs, withPrior) {
    let total = 0, n = 0;
    for (const seq of seqs) {
      let state = null;
      for (const r of seq) {
        if (state && r.elapsed > 0) {
          const p = Math.min(1 - 1e-6, Math.max(1e-6, FSRS.retrievability(r.elapsed, state.s)));
          total -= r.g > 1 ? Math.log(p) : Math.log(1 - p);
          n++;
        }
        state = FSRS.step(w, state, r.g, r.elapsed);
      }
    }
    let value = n ? total / n : 0;
    if (withPrior) for (let i = 0; i < w.length; i++) value += lambda * ((w[i] - W0[i]) / scale[i]) ** 2;
    return value;
  }
  const clampW = w => w.map((v, i) => Math.min(BOUNDS[i][1], Math.max(BOUNDS[i][0], v)));
  let w = W0.slice();
  const m = new Array(w.length).fill(0), v = new Array(w.length).fill(0);
  const lr = 0.03, b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let seed = 12345;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let t = 1; t <= iterations; t++) {
    // Lote aleatório: o custo por iteração não cresce com o histórico.
    const batch = train.length <= batchSize ? train : Array.from({length: batchSize}, () => train[Math.floor(random() * train.length)]);
    const base = loss(w, batch, true);
    const grad = w.map((wi, i) => {
      const h = 1e-3 * scale[i];
      const up = w.slice();
      up[i] = Math.min(BOUNDS[i][1], wi + h);
      const dh = up[i] - wi;
      return dh ? (loss(up, batch, true) - base) / dh : 0;
    });
    w = clampW(w.map((wi, i) => {
      const g = grad[i] * scale[i];
      m[i] = b1 * m[i] + (1 - b1) * g;
      v[i] = b2 * v[i] + (1 - b2) * g * g;
      const mh = m[i] / (1 - b1 ** t), vh = v[i] / (1 - b2 ** t);
      return wi - lr * scale[i] * mh / (Math.sqrt(vh) + eps);
    }));
    if (onProgress && t % 10 === 0) onProgress(t / iterations);
  }
  const all = [...train, ...valid];
  return {
    weights: w,
    trainTerms: nTrain,
    validTerms: countTerms(valid),
    lossDefault: loss(W0, valid.length ? valid : train, false),
    lossOptimized: loss(w, valid.length ? valid : train, false),
    lossDefaultAll: loss(W0, all, false),
    lossOptimizedAll: loss(w, all, false)
  };
};
