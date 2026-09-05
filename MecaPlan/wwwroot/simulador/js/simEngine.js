// ============================================================
// simEngine.js  (MOTOR DE SIMULACIÓN) — ES module
// Arquitectura Strategy: cambia el motor de simulación según la placa
// seleccionada (AVR328P, RP2040, ESP32).
// - Ejecución C++ → ATmega328P (via avr-gcc WASM)  ← motor por defecto
// - Ejecución MicroPython → Raspberry Pi Pico (via rp2040js CDN)
// - Simulación lógica → ESP32 (warning: no hay emulación offline completa)
// ============================================================

// ============================================================
// Configuración base y rutas de recursos
// ============================================================
const COMPILER_BASE = new URL('/compiler/', location.origin);

// Ruta del bundle rp2040js (MicroPython) desde unpkg CDN.
// Se carga de forma perezosa (lazy) cuando se selecciona una placa RP2040.
const RP2040_JS_URL = 'https://unpkg.com/rp2040js@latest/dist/rp2040js.mjs';

// ============================================================
// parseIntelHex - Helper a nivel de módulo (reutilizado por la
// estrategia AVR). Es lo que exporta el ES module.
// ============================================================
function parseIntelHex(hex) {
  const lines = String(hex || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const mem = new Map();
  let base = 0;

  for (const line of lines) {
    if (!line.startsWith(':')) continue;
    const bytes = [];
    for (let i = 1; i < line.length; i += 2) bytes.push(parseInt(line.substr(i, 2), 16));
    const count = bytes[0];
    const address = (bytes[1] << 8) | bytes[2];
    const type = bytes[3];
    const data = bytes.slice(4, 4 + count);

    if (type === 0x04) {
      base = ((data[0] << 8) | data[1]) << 16;
    } else if (type === 0x00) {
      const abs = base + address;
      data.forEach((b, i) => mem.set(abs + i, b));
    }
  }

  const maxAddr = mem.size ? Math.max(...Array.from(mem.keys())) : 0;
  const words = new Uint16Array(Math.ceil((maxAddr + 2) / 2));
  for (let addr = 0; addr < maxAddr - 1; addr += 2) {
    const lo = mem.get(addr) || 0;
    const hi = mem.get(addr + 1) || 0;
    words[addr / 2] = (hi << 8) | lo; // little-endian AVR word
  }
  return words;
}

// ============================================================
// Patrón Strategy: definición de la interfaz de simulación
// ============================================================

/**
 * SimulationStrategy - Interfaz que define los métodos que debe implementar
 * cada motor de simulación (AVR328P, RP2040, ESP32).
 */
class SimulationStrategy {
  constructor() {
    if (new.target === SimulationStrategy) {
      throw new Error('SimulationStrategy es una clase abstracta.');
    }
  }

  /** Cargar recursos externos (librerías, WASM, etc.) y preparar el motor. */
  async init() { /** sobrescribir en subclasses */ }

  /** Compilar y arrancar la simulación con el código fuente Arduino. */
  async start(source) {
    throw new Error('Método start() no implementado en la estrategia actual.');
  }

  /** Detener la simulación y limpiar recursos. */
  stop() {
    /** sobrescribir en subclasses */
  }

  /** Vincular un handler de cambio de pin desde la UI (ej. encender LED). */
  setPinChangeHandler(fn) {
    /** sobrescribir en subclasses */
  }

  /** Resetear LEDs/estados tras detener la simulación. */
  resetLeds() {
    /** sobrescribir en subclasses */
  }

  /** Señalar que la simulación lógica no está disponible (ej. ESP32 offline). */
  get simulationAvailable() {
    return true;
  }
}

// ============================================================
// Implementaciones concretas de estrategia
// ============================================================

/**
 * Avr328PSimulation - Motor para Arduino Uno / ATmega328P.
 * Carga avr8js + compila con avr-gcc WASM. Este es el motor por defecto.
 */
class Avr328PSimulation extends SimulationStrategy {
  async init() {
    // No requiere carga CDN externa; avr8js viene empaquetada en el Docker.
    // El compilador WASM (/compiler/) ya está servido por nginx.
  }

  async start(source) {
    // Código existente - compilar y crear instancia CPU ATmega328P
    let compileFn = null;
    const minify = async () => {
      if (!compileFn) {
        const mod = await import(
          /* webpackIgnore: true */
          `${location.origin}/compiler/index.js`
        );
        compileFn = mod.compile;
      }

      // Algunos usuarios escriben el sketch sin los includes; el compilador
      // avr-gcc-wasm necesita que Arduino.h esté presente para reconocer
      // pinMode/digitalWrite/delay/etc.
      const src = /#include\s*["<]Arduino.h[">]/.test(source)
        ? source
        : `#include <Arduino.h>\n${source}`;

      const result = await compileFn({ source: src, assetsBase: COMPILER_BASE });
      const hex = result.hex;
      if (!hex) throw new Error('El compilador no devolvió HEX.');

      // Importar AVR8js y crear CPU
      const AVR8 = await import(/* webpackIgnore: true */ `${location.origin}/lib/avr8js.esm.js`);
      const { CPU, AVRTimer, timer0Config, timer1Config, AVRUSART, usart0Config } = AVR8;

      const program = parseIntelHex(hex);
      const cpu = new CPU(program, 2048); // 2KB SRAM

      // Timer0 -> millis/delay()
      try { new AVRTimer(cpu, timer0Config); } catch (e) { console.warn('[sim] timer0:', e.message); }
      // Timer1 -> tone()/millis secundario
      try { new AVRTimer(cpu, timer1Config); } catch (e) { console.warn('[sim] timer1:', e.message); }

      // Serial (UART0)
      try {
        const usart = new AVRUSART(cpu, usart0Config, 16000000);
        usart.onLineTransmit = (line) => { if (window.SUGOI && window.SUGOI.sim && window.SUGOI.sim.onSerialLine) window.SUGOI.sim.onSerialLine(line); };
      } catch (e) { console.warn('[sim] usart:', e.message); }

      // Handlers de pin change (hacia la UI)
      window.SUGOI.sim.setPinChangeHandler((pinName, high) => {
        // Notificar a la UI para encender/apagar LEDs en el canvas
        if (window.SUGOI && window.SUGOI.engine) {
          window.SUGOI.engine.setComponentLightThroughNet(window.SUGOI.pinout, pinName, high);
        }
      });

      // Serial handler
      window.SUGOI.sim.setSerialHandler((line) => {
        if (window.SUGOI && window.SUGOI.sim) window.SUGOI.sim.onSerialLine(line);
      });

      return { ok: true, flashBytes: hex.length / 2 };
    }
    return await minify();
  }
}

/**
 * Rp2040Simulation - Motor para Raspberry Pi Pico.
 * Carga rp2040js desde CDN y ejecuta un entorno MicroPython simplificado.
 * Este módulo está diseñado para ser "lightweight": no intenta emular el
 * SDK completo de C/C++, sino que provee un interprete MicroPython básico
 * para fines educativos.
 */
class Rp2040Simulation extends SimulationStrategy {
  constructor() {
    super();
    this.microPythonModule = null; // instanciado al cargar rp2040js
  }

  /** Carga el bundle rp2040js desde unpkg CDN y crea el contexto de ejecución. */
  async init() {
    if (this.microPythonModule) return; // ya cargado
    try {
      // Dinámico: import() del módulo ESM.
      // Se asume que rp2040js expone una función createMicroPythonEnv() o similar.
      this.microPythonModule = await import(RP2040_JS_URL);
      console.log('[sim] rp2040js cargado OK', this.microPythonModule);
    } catch (e) {
      console.error('[sim] ERROR cargando rp2040js:', e.message);
      // Fallback: marcar que la simulación no está disponible pero continuar
      // con la lógica de pinout/BOM que sí funciona.
      this.microPythonModule = null;
    }
  }

  async start(source) {
    await this.init();
    if (!this.microPythonModule) {
      // No se pudo cargar la librería: mostramos warning en la UI pero
      // el circuito sigue alimentando el cálculo de pinout y BOM.
      if (window.SUGOI && window.SUGOI.engine) {
        window.SUGOI.engine.setComponentLightThroughNet(
          window.SUGOI.pinout,
          null,
          false // apagar LEDs indicadores
        );
      }
      return {
        ok: false,
        error: 'Simulación MicroPython no disponible (rp2040js no cargado). El componente alimentará el cálculo de Pinout y BOM.',
        degraded: true,
      };
    }

    // TODO: integrar ejecuciµn real de MicroPython aquí.
    // Por ahora, indicamos que la simulación se inició pero requiere
    // desarrollo del backend de interpretación de scripts .mpy o .py.
    return {
      ok: true,
      message: 'Entorno MicroPython listo (interfaz placeholder). Cargar binario UF2 para ejecución completa.',
      degraded: true,
    };
  }

  /** No implementamos stop/handlers completos para el primer MVP; */
  stop() {
    this.microPythonModule = null;
  }

  setPinChangeHandler(fn) {
    // En modo MicroPython el handler se conectaría a la UART/ GPIO callback.
    // Por ahora guardamos la referencia para futura expansión.
    if (fn) console.log('[sim] setPinChangeHandler registrado (RP2040 pending)');
  }

  resetLeds() {
    // Apagar indicadores visuales en el canvas
    if (window.SUGOI && window.SUGOI.engine) {
      window.SUGOI.engine.setComponentLightThroughNet(window.SUGOI.pinout, null, false);
    }
  }

  get simulationAvailable() {
    // True si logramos cargar el módulo; false si falló el load.
    return !!this.microPythonModule;
  }
}

/**
 * Esp32Simulation - Marcador de que la simulación lógica completa no está
 * disponible en el navegador (requiere hardware real o nube). El componente
 * sí alimenta el cálculo de pinout y BOM, y muestra una advertencia en la UI.
 */
class Esp32Simulation extends SimulationStrategy {
  constructor() {
    super();
    this.available = false;
  }

  async init() {
    // El ESP32 no tiene emulación offline JS viable en este proyecto.
    // Solo marcaremos el estado; el UI mostrará el warning.
    this.available = false;
  }

  async start(source) {
    // Siempre retornamos degraded = true, UI muestra warning.
    if (!this.available) {
      return {
        ok: false,
        error: 'Simulación lógica no disponible para ESP32 en modo offline. El componente alimentará el cálculo de Pinout y BOM.',
        degraded: true,
      };
    }
    return { ok: true };
  }

  stop() {
    // Nada que limpiar en modo "solo cálculo"
  }

  setPinChangeHandler(fn) {
    // No applicable: sin emulación de pines AVR/GPIO real.
    if (fn) console.log('[sim] setPinChangeHandler ignorado (ESP32 sin emulación)');
  }

  resetLeds() {
    // Asegurar que ningún LED quede "encendido" por error de simulación.
    if (window.SUGOI && window.SUGOI.engine) {
      window.SUGOI.engine.setComponentLightThroughNet(window.SUGOI.pinout, null, false);
    }
  }

  get simulationAvailable() {
    return this.available;
  }
}

// ============================================================
// SimulationContext - El "contexto" que usa una estrategia concreta
// y expone una API unificada para el resto de la aplicación.
// ============================================================
class SimulationContext {
  constructor() {
    this.currentStrategy = new Avr328PSimulation(); // por defecto
    this.strategyName = 'avr328p';
  }

  /** Cambiar la estrategia activa según el tipo de placa seleccionada. */
  async setStrategy(placaType) {
    // Detener la estrategia actual
    this.currentStrategy.stop();

    switch (placaType) {
      case 'esp32_devkit':
        this.currentStrategy = new Esp32Simulation();
        this.strategyName = 'esp32';
        break;

      case 'rp2040':
        this.currentStrategy = new Rp2040Simulation();
        this.strategyName = 'rp2040';
        await this.currentStrategy.init();
        break;

      case 'arduino_uno':
      case 'arduino_nano':
      case 'arduino_mega':
      default:
        this.currentStrategy = new Avr328PSimulation();
        this.strategyName = 'avr328p';
        break;
    }
    console.log(`[sim] Cambiado a estrategia: ${this.strategyName}`);
  }

  /** Delegar start() a la estrategia actual. */
  async start(source) {
    return this.currentStrategy.start(source);
  }

  stop() {
    this.currentStrategy.stop();
  }

  setPinChangeHandler(fn) {
    this.currentStrategy.setPinChangeHandler(fn);
  }

  resetLeds() {
    this.currentStrategy.resetLeds();
  }

  get simulationAvailable() {
    return this.currentStrategy.simulationAvailable;
  }
}

// Instanciar el contexto global único que el resto del código usará.
export const simEngine = new SimulationContext();

// Exportar helper de parseo de HEX que usa la estrategia AVR (puede ser reutilizado)
export { parseIntelHex };

// --- Exponer API global compatibility (mantener compat with window.SUGOI.sim) ---
window.SUGOI_ENGINE_RESET = () => simEngine.stop();

// Exponer methods que el UI actual espera (sin romper APIs externas):
// - setSerialHandler / onSerialLine: delegados a la estrategia actual
// - setPinChangeHandler / onPinChange: delegados
// - setSerialHandler already defined at module level for backward compat
let onSerialLine = null;
let onPinChange = null;

export function setSerialHandler(fn) { onSerialLine = fn; }
export function setPinChangeHandler(fn) { onPinChange = fn; }

// Leyada de puertos en el loop AVR se hará por la estrategia actual; 
// mantemos la firma para no romper llamadas externas.
function readPorts() {
  // En modo Strategy, cada motor maneja su propio readPorts internamente.
  // Este stub mantiene firma para imports externos que lo usen.
  if (window.SUGOI && window.SUGOI.sim && window.SUGOI.sim.onSerialLine) {
    window.SUGOI.sim.onSerialLine('(strategy-handled)');
  }
}

// Mantener compat: window.SUGOI.sim.start/source ya era una llamada global;
// ahora redirige al contexto strategy.
window.SUGOI = window.SUGOI || {};
window.SUGOI.sim = {
  start: async (source) => { const r = await simEngine.start(source); return r; },
  stop: () => { simEngine.stop(); },
  setStrategy: async (placaType) => { await simEngine.setStrategy(placaType); },
  setPinChangeHandler: (fn) => { simEngine.setPinChangeHandler(fn); },
  setSerialHandler: (fn) => { onSerialLine = fn; console.log('[sim] setSerialHandler registrado (legacy)'); },
  resetLeds: () => { simEngine.resetLeds(); },
  simulationAvailable: () => simEngine.simulationAvailable,
};