"use strict";
/* Worker do otimizador FSRS: recebe as sequências de revisões e devolve os parâmetros ajustados. */
importScripts("fsrs.js");
self.onmessage = event => {
  try {
    const result = FSRS.optimize(event.data.sequences, {onProgress: p => self.postMessage({type: "progress", value: p})});
    self.postMessage({type: "done", result});
  } catch (e) {
    self.postMessage({type: "error", message: String(e && e.message || e)});
  }
};
