// ============================================================
// main.js  (BOOTSTRAP / CONTROLLER ROOT)
// Punto de entrada ES module. Carga las librerías de negocio,
// inicializa el motor gráfico y expone el modelo en window.SUGOI
// para los módulos IIFE (canvasEngine, simEngine, services, ui).
// ============================================================
import {
  serializeCircuit,
  calculateBOM,
  buildNetlist,
  findShortCircuits,
  buildPinoutMap,
} from './businessLogic.js';
import * as sim from './simEngine.js';

window.SUGOI = window.SUGOI || {};

// Exponer el modelo para los módulos no-ES que ya se cargaron.
window.SUGOI.businessLogic = {
  serializeCircuit,
  calculateBOM,
  buildNetlist,
  findShortCircuits,
  buildPinoutMap,
};

// Exponer el motor de simulación para la UI (IIFE).
// El wrapper ES module ya define window.SUGOI.sim; aquí solo lo
// reforzamos con la API que la UI espera para no romper llamadas.
window.SUGOI.sim = window.SUGOI.sim || {};
const s = window.SUGOI.sim;
Object.assign(s, {
  start: sim.start ? sim.start : s.start,
  stop: sim.stop ? sim.stop : s.stop,
  setSerialHandler: sim.setSerialHandler ? sim.setSerialHandler : s.setSerialHandler,
  setPinChangeHandler: sim.setPinChangeHandler ? sim.setPinChangeHandler : s.setPinChangeHandler,
  parseIntelHex: sim.parseIntelHex ? sim.parseIntelHex : s.parseIntelHex,
  setStrategy: sim.simEngine && sim.simEngine.setStrategy ? sim.simEngine.setStrategy.bind(sim.simEngine) : s.setStrategy,
});

// La UI se registra globalmente (su IIFE devuelve { init, ... })
function boot() {
  try {
    const engine = window.SUGOI.engine;
    if (!engine) {
      console.error('Error crítico de inicialización: canvasEngine.js no inicializado.');
      return;
    }

    // Inicializar el lienzo: contenedor Konva + overlay HTML de wokwi
    engine.init('konva-container', 'wokwi-overlay');

    // Inicializar UI y editor por separado (si uno falla, el otro continúa)
    if (window.SUGOI.ui && window.SUGOI.ui.init) {
      try {
        window.SUGOI.ui.init();
      } catch (uiErr) {
        console.error('Error crítico de inicialización (ui.init):', uiErr);
      }
    }
    if (window.SUGOI.ui && window.SUGOI.ui.initEditor) {
      try {
        window.SUGOI.ui.initEditor();
      } catch (editorErr) {
        console.error('Error crítico de inicialización (ui.initEditor):', editorErr);
      }
    }
  } catch (err) {
    console.error('Error crítico de inicialización:', err);
  }
}

function ensureLoaded() {
  // Esperar a que Konva y los constructores estén disponibles
  if (typeof Konva === 'undefined') {
    setTimeout(ensureLoaded, 50);
    return;
  }
  boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureLoaded);
} else {
  ensureLoaded();
}
