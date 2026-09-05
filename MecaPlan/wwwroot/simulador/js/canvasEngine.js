// ============================================================
// canvasEngine.js  (VIEW)
// Motor gráfico del simulador sugoi_project.
//   - Konva.Stage con grid, zoom (rueda) y pan (fondo).
//   - wokwi-elements (SVG de placas) renderizados como HTML real
//     en un layer overlay, cuya posición se sincroniza con el stage.
//   - Terminales: nodos Konva clicables que disparan cableado.
//   - Cables: curvas de Bézier cuadráticas con control ortogonal.
//
// Emite eventos DOM ('stage:changed') cuando cambia el estado.
// Expone window.SUGOI.engine para otros módulos.
// ============================================================
(function () {
  'use strict';

  const CONFIG = window.SUGOI_CONFIG || {};
  const GRID = CONFIG.GRID_SIZE || 40;
  const HEADER_H = 26;

  // ---------- Estado del modelo ----------
  const state = { nodes: [], connections: [], components: [] };
  let idCounter = 1;
  const uid = () => `n${idCounter++}`;

  // ---------- Referencias Konva ----------
  let stage, layerWires, layerGrid, layerComponents, layerUI;
  let selectedCompId = null;
  let selectedWireId = null;
  let componentLayerHost = null; // div HTML overlay
  let containerRef = null; // contenedor HTML del stage (para tamaño full-bleed)

  // ---------- Estado de cableado ----------
  let wireFrom = null; // { nodeId }
  let tempWire = null; // Konva.Line de preview
  let draggingComponent = null;

  // ---------- Badges sobre cables (etiquetas de flujo) ----------
  // wireId -> { label: Konva.Label }. Se crean junto a cada cable y se
  // reposicionan al arrastrar componentes o al restaurar el lienzo.
  const wireBadges = new Map(); // wireId -> Konva.Label
  const wireDeleteBtns = new Map(); // wireId -> Konva.Group
  let flowAnimation = null; // Konva.Animation del flujo de señal (Feature 3)

  // ---------- Catálogo de componentes de la paleta ----------
  // Cada entrada define: tipo, etiqueta, wokwi tag, terminales y
  // posible mapeo AVR (solo el Arduino).
  // ---------- Catálogo de componentes de la paleta ----------
  // Cada entrada define: tipo, etiqueta, wokwi tag, terminales y
  // posible mapeo AVR (solo el Arduino Uno: avrPort + bit).
  //
  // Los tags corresponden a los <wokwi-*> reales de la librería
  // wokwi-elements@0.48.3 (cargada vía CDN). Si un tag no estuviera
  // registrado, createWokwiElement() cae a un placeholder etiquetado,
  // pero las terminales siguen siendo totalmente funcionales.

  // Helper: genera terminales repartidos en una fila horizontal.
  function mkRow(total, y, opts) {
    const arr = [];
    const base = (opts && opts.base) || 0;
    const idp = (opts && opts.idPrefix) || 'p';
    for (let i = 0; i < total; i++) {
      const label = opts && opts.labels && opts.labels[i] ? opts.labels[i] : String(base + i);
      arr.push({
        id: idp + (base + i),
        index: base + i,
        x: 12 + i * (opts && opts.step ? opts.step : 22),
        y,
        pinName: label,
        role: (opts && opts.roles && opts.roles[i]) || 't',
      });
    }
    return arr;
  }

  // Helper: genera terminales en una columna vertical.
  function mkCol(total, x, opts) {
    const arr = [];
    const base = (opts && opts.base) || 0;
    const idp = (opts && opts.idPrefix) || 'p';
    for (let i = 0; i < total; i++) {
      const label = opts && opts.labels && opts.labels[i] ? opts.labels[i] : String(base + i);
      arr.push({
        id: idp + (base + i),
        index: base + i,
        x,
        y: 14 + i * (opts && opts.step ? opts.step : 22),
        pinName: label,
        role: (opts && opts.roles && opts.roles[i]) || 't',
      });
    }
    return arr;
  }

  const COMPONENT_DEFS = {
    // ===================== MICROCONTROLADORES =====================
    arduino_uno: {
      label: 'Arduino Uno',
      tag: 'wokwi-arduino-uno',
      w: 300, h: 240,
      terminals: [
        // Columna derecha (digitales 13..0) — pines DENTRO de la caja visual
        { id: 'd13', index: 0,  x: 288, y: 18,  pinName: 'D13', avrPort: 0x25, bit: 5 },
        { id: 'd12', index: 1,  x: 288, y: 34,  pinName: 'D12', avrPort: 0x25, bit: 4 },
        { id: 'd11', index: 2,  x: 288, y: 50,  pinName: 'D11', avrPort: 0x25, bit: 3 },
        { id: 'd10', index: 3,  x: 288, y: 66,  pinName: 'D10', avrPort: 0x25, bit: 2 },
        { id: 'd9',  index: 4,  x: 288, y: 82,  pinName: 'D9',  avrPort: 0x24, bit: 1 },
        { id: 'd8',  index: 5,  x: 288, y: 98,  pinName: 'D8',  avrPort: 0x24, bit: 0 },
        { id: 'd7',  index: 6,  x: 288, y: 114, pinName: 'D7',  avrPort: 0x22, bit: 6 },
        { id: 'd6',  index: 7,  x: 288, y: 130, pinName: 'D6',  avrPort: 0x24, bit: 7 },
        { id: 'd5',  index: 8,  x: 288, y: 146, pinName: 'D5',  avrPort: 0x24, bit: 5 },
        { id: 'd4',  index: 9,  x: 288, y: 162, pinName: 'D4',  avrPort: 0x24, bit: 4 },
        { id: 'd3',  index: 10, x: 288, y: 178, pinName: 'D3',  avrPort: 0x23, bit: 3 },
        { id: 'd2',  index: 11, x: 288, y: 194, pinName: 'D2',  avrPort: 0x23, bit: 2 },
        { id: 'd1',  index: 12, x: 288, y: 210, pinName: 'D1',  avrPort: 0x23, bit: 1 },
        { id: 'd0',  index: 13, x: 288, y: 226, pinName: 'D0',  avrPort: 0x23, bit: 0 },
        // Columna izquierda (alimentación + analógicos)
        { id: 'rst',  index: 26, x: 12, y: 18,  pinName: 'RST',  role: 't' },
        { id: '3v3',  index: 21, x: 12, y: 34,  pinName: '3V3',  role: 'vcc' },
        { id: '5v',   index: 25, x: 12, y: 50,  pinName: '5V',   role: 'vcc' },
        { id: 'gnd',  index: 23, x: 12, y: 66,  pinName: 'GND',  role: 'gnd' },
        { id: 'gnd2', index: 24, x: 12, y: 82,  pinName: 'GND',  role: 'gnd' },
        { id: 'vin',  index: 22, x: 12, y: 98,  pinName: 'VIN',  role: 'vcc' },
        { id: 'aref', index: 20, x: 12, y: 114, pinName: 'AREF', role: 't' },
        { id: 'a0',   index: 19, x: 12, y: 130, pinName: 'A0', avrPort: 0x29, bit: 0 },
        { id: 'a1',   index: 18, x: 12, y: 146, pinName: 'A1', avrPort: 0x29, bit: 1 },
        { id: 'a2',   index: 17, x: 12, y: 162, pinName: 'A2', avrPort: 0x29, bit: 2 },
        { id: 'a3',   index: 16, x: 12, y: 178, pinName: 'A3', avrPort: 0x29, bit: 3 },
        { id: 'a4',   index: 15, x: 12, y: 194, pinName: 'A4', avrPort: 0x29, bit: 4 },
        { id: 'a5',   index: 14, x: 12, y: 210, pinName: 'A5', avrPort: 0x29, bit: 5 },
      ],
      powerPins: { '5v': '5v', gnd: 'gnd', '3v3': '3v3' },
    },
    arduino_nano: {
      label: 'Arduino Nano',
      tag: 'wokwi-arduino-nano',
      w: 240, h: 200,
      terminals: [
        { id: 'd13', index: 0,  x: 12,  y: 18,  pinName: 'D13', avrPort: 0x25, bit: 5 },
        { id: 'd12', index: 1,  x: 12,  y: 34,  pinName: 'D12', avrPort: 0x25, bit: 4 },
        { id: 'd11', index: 2,  x: 12,  y: 50,  pinName: 'D11', avrPort: 0x25, bit: 3 },
        { id: 'd10', index: 3,  x: 12,  y: 66,  pinName: 'D10', avrPort: 0x25, bit: 2 },
        { id: 'd9',  index: 4,  x: 12,  y: 82,  pinName: 'D9',  avrPort: 0x24, bit: 1 },
        { id: 'd8',  index: 5,  x: 12,  y: 98,  pinName: 'D8',  avrPort: 0x24, bit: 0 },
        { id: 'd7',  index: 6,  x: 12,  y: 114, pinName: 'D7',  avrPort: 0x22, bit: 6 },
        { id: 'd6',  index: 7,  x: 12,  y: 130, pinName: 'D6',  avrPort: 0x24, bit: 7 },
        { id: 'd5',  index: 8,  x: 12,  y: 146, pinName: 'D5',  avrPort: 0x24, bit: 5 },
        { id: 'd4',  index: 9,  x: 12,  y: 162, pinName: 'D4',  avrPort: 0x24, bit: 4 },
        { id: 'd3',  index: 10, x: 12,  y: 178, pinName: 'D3',  avrPort: 0x23, bit: 3 },
        { id: 'd2',  index: 11, x: 12,  y: 194, pinName: 'D2',  avrPort: 0x23, bit: 2 },
        { id: 'a0',  index: 12, x: 228, y: 18,  pinName: 'A0',  avrPort: 0x29, bit: 0 },
        { id: 'a1',  index: 13, x: 228, y: 34,  pinName: 'A1',  avrPort: 0x29, bit: 1 },
        { id: 'a2',  index: 14, x: 228, y: 50,  pinName: 'A2',  avrPort: 0x29, bit: 2 },
        { id: 'a3',  index: 15, x: 228, y: 66,  pinName: 'A3',  avrPort: 0x29, bit: 3 },
        { id: 'a4',  index: 16, x: 228, y: 82,  pinName: 'A4',  avrPort: 0x29, bit: 4 },
        { id: 'a5',  index: 17, x: 228, y: 98,  pinName: 'A5',  avrPort: 0x29, bit: 5 },
        { id: '5v',  index: 18, x: 228, y: 114, pinName: '5V',  role: 'vcc' },
        { id: '3v3', index: 19, x: 228, y: 130, pinName: '3V3', role: 'vcc' },
        { id: 'vin', index: 20, x: 228, y: 146, pinName: 'VIN', role: 'vcc' },
        { id: 'gnd', index: 21, x: 228, y: 162, pinName: 'GND', role: 'gnd' },
        { id: 'gnd2',index: 22, x: 228, y: 178, pinName: 'GND', role: 'gnd' },
        { id: 'rst', index: 23, x: 228, y: 194, pinName: 'RST', role: 't' },
      ],
    },
    arduino_mega: {
      label: 'Arduino Mega 2560',
      tag: 'wokwi-arduino-mega',
      w: 240, h: 180,
      terminals: mkCol(8, 8, { step: 21, labels: ['D22','D23','D24','D25','D26','D27','D28','5V'], idPrefix: 'cl' })
        .concat(mkCol(8, 232, { step: 21, labels: ['D13','D12','D11','D10','D9','D8','GND','A0'], base: 8, idPrefix: 'cr' })),
    },
    esp32_devkit: {
      label: 'ESP32 DevKit',
      tag: 'wokwi-esp32-devkit-v1',
      w: 240, h: 220,
      terminals: mkCol(15, 10, { step: 14, labels: ['3V3','GND','GPIO15','GPIO2','GPIO4','GPIO16','GPIO17','GPIO5','GPIO18','GPIO19','GPIO21','RX','TX','GND','5V'], roles: ['vcc','gnd','t','t','t','t','t','t','t','t','t','t','t','gnd','vcc'], idPrefix: 'cl' })
        .concat(mkCol(15, 230, { step: 14, labels: ['GPIO22','GPIO23','GPIO25','GPIO26','GPIO27','GPIO14','GPIO12','GPIO13','GPIO9','GPIO10','GPIO11','GPIO6','GPIO7','GPIO8','EN'], base: 15, idPrefix: 'cr' })),
    },
    attiny85: {
      label: 'ATtiny85',
      tag: 'wokwi-attiny85',
      w: 90, h: 80,
      terminals: mkCol(4, 6, { step: 18, labels: ['PB5','PB3','PB4','GND'], idPrefix: 'cl' })
        .concat(mkCol(4, 84, { step: 18, labels: ['VCC','PB2','PB1','PB0'], base: 4, idPrefix: 'cr' })),
    },
    rp2040: {
      label: 'RP2040 (Pico)',
      tag: 'wokwi-nano-rp2040-connect',
      w: 180, h: 110,
      terminals: mkRow(6, 8, { step: 26, labels: ['GP0','GP1','GP2','GP3','GND','3V3'], idPrefix: 'cl' })
        .concat(mkRow(6, 60, { step: 26, labels: ['GP4','GP5','GP6','GP7','GP8','GP9'], base: 6, idPrefix: 'cr' })),
    },

    protoboard: {
      label: 'Protoboard',
      tag: null,
      icon: 'protoboard',
      w: 420, h: 200,
      terminals: makeBreadboardTerminals(),
    },

    // ===================== FUENTES / SENCILLOS =====================
    vcc: {
      label: '5V (fijo)',
      tag: null,
      w: 40, h: 40,
      terminals: [{ id: 'out', index: 0, x: 20, y: 20, role: 'vcc' }],
    },
    gnd: {
      label: 'GND (fijo)',
      tag: null,
      w: 40, h: 40,
      terminals: [{ id: 'out', index: 0, x: 20, y: 20, role: 'gnd' }],
    },

    // ===================== PASIVOS =====================
    resistor: {
      label: 'Resistencia',
      tag: 'wokwi-resistor',
      w: 80, h: 40,
      terminals: [
        { id: 't1', index: 0, x: 4,  y: 20, role: 't' },
        { id: 't2', index: 1, x: 76, y: 20, role: 't' },
      ],
    },
    capacitor: {
      label: 'Capacitor',
      tag: null,
      icon: 'generico',
      w: 80, h: 50,
      terminals: [
        { id: 't1', index: 0, x: 8, y: 25, role: 't', pinName: 'A' },
        { id: 't2', index: 1, x: 72, y: 25, role: 't', pinName: 'B' },
      ],
    },
    diode: {
      label: 'Diodo',
      tag: null,
      icon: 'generico',
      w: 80, h: 40,
      terminals: [
        { id: 'a', index: 0, x: 8, y: 20, role: 'anode', pinName: 'A' },
        { id: 'k', index: 1, x: 72, y: 20, role: 'cathode', pinName: 'K' },
      ],
    },
    potentiometer: {
      label: 'Potenciómetro',
      tag: 'wokwi-potentiometer',
      w: 80, h: 60,
      terminals: [
        { id: 't1', index: 0, x: 8, y: 8,  role: 't' },
        { id: 'wiper', index: 1, x: 40, y: 52, role: 'wiper' },
        { id: 't2', index: 2, x: 72, y: 8,  role: 't' },
      ],
    },
    slide_pot: {
      label: 'Pot. deslizante',
      tag: 'wokwi-slide-potentiometer',
      w: 100, h: 50,
      terminals: mkRow(3, 40, { step: 30, labels: ['T1','WIPER','T2'], roles: ['t','wiper','t'] }),
    },
    photoresistor: {
      label: 'Fotorresistencia LDR',
      tag: 'wokwi-photoresistor-sensor',
      w: 50, h: 70,
      terminals: mkCol(2, 25, { step: 48, labels: ['A','B'], roles: ['t','t'] }),
    },
    ntc_temp: {
      label: 'Sensor NTC',
      tag: 'wokwi-ntc-temperature-sensor',
      w: 50, h: 70,
      terminals: mkCol(2, 25, { step: 48, labels: ['A','B'], roles: ['t','t'] }),
    },
    tilt_switch: {
      label: 'Sensor inclinación',
      tag: 'wokwi-tilt-switch',
      w: 50, h: 70,
      terminals: mkCol(2, 25, { step: 48, labels: ['1','2'], roles: ['t','t'] }),
    },

    // ===================== LEDs =====================
    led_red: {
      label: 'LED Rojo',
      tag: 'wokwi-led',
      color: 'red',
      w: 60, h: 60,
      terminals: [
        { id: 'anode', index: 0,  x: 30, y: 8,  role: 'anode' },
        { id: 'cathode', index: 1, x: 30, y: 52, role: 'cathode' },
      ],
    },
    led_green: {
      label: 'LED Verde',
      tag: 'wokwi-led',
      color: 'green',
      w: 60, h: 60,
      terminals: [
        { id: 'anode', index: 0,  x: 30, y: 8,  role: 'anode' },
        { id: 'cathode', index: 1, x: 30, y: 52, role: 'cathode' },
      ],
    },
    led_blue: {
      label: 'LED Azul',
      tag: 'wokwi-led',
      color: 'blue',
      w: 60, h: 60,
      terminals: [
        { id: 'anode', index: 0,  x: 30, y: 8,  role: 'anode' },
        { id: 'cathode', index: 1, x: 30, y: 52, role: 'cathode' },
      ],
    },
    led_rgb: {
      label: 'LED RGB',
      tag: 'wokwi-rgb-led',
      w: 70, h: 70,
      terminals: [
        { id: 'r', index: 0, x: 12, y: 62, role: 'anode', pinName: 'R' },
        { id: 'g', index: 1, x: 29, y: 62, role: 'anode', pinName: 'G' },
        { id: 'b', index: 2, x: 46, y: 62, role: 'anode', pinName: 'B' },
        { id: 'k', index: 3, x: 61, y: 62, role: 'cathode' },
      ],
    },
    led_bar: {
      label: 'Barra de LEDs',
      tag: 'wokwi-led-bar-graph',
      w: 60, h: 160,
      terminals: mkCol(10, 30, { step: 14, labels: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10'] }),
    },
    led_ring: {
      label: 'Anillo LED',
      tag: 'wokwi-led-ring',
      w: 120, h: 120,
      terminals: mkCol(12, 60, { step: 9, labels: Array.from({length:12},(_,i)=>'D'+i) }),
    },
    neopixel: {
      label: 'NeoPixel',
      tag: 'wokwi-neopixel',
      w: 90, h: 60,
      terminals: mkCol(3, 10, { step: 22, labels: ['VCC','DIN','GND'], roles: ['vcc','signal','gnd'], idPrefix: 'cl' })
        .concat(mkCol(3, 70, { step: 22, labels: ['DOUT','',''], roles: ['signal','t','t'], base: 3, idPrefix: 'cr' })),
    },
    neopixel_matrix: {
      label: 'Matriz NeoPixel',
      tag: 'wokwi-neopixel-matrix',
      w: 120, h: 120,
      terminals: mkRow(4, 8, { step: 30, labels: ['VCC','DIN','DOUT','GND'], roles: ['vcc','signal','signal','gnd'] }),
    },

    // ===================== BOTONES / INTERRUPTORES =====================
    button: {
      label: 'Pulsador',
      tag: 'wokwi-pushbutton',
      w: 60, h: 60,
      terminals: [
        { id: 'a', index: 0, x: 30, y: 8,  role: 'a' },
        { id: 'b', index: 1, x: 30, y: 52, role: 'b' },
      ],
    },
    button_6mm: {
      label: 'Pulsador 6mm',
      tag: 'wokwi-pushbutton-6mm',
      w: 50, h: 50,
      terminals: mkCol(2, 25, { step: 36, labels: ['A','B'], roles: ['a','b'] }),
    },
    slide_switch: {
      label: 'Interruptor',
      tag: 'wokwi-slide-switch',
      w: 60, h: 40,
      terminals: [
        { id: 'a', index: 0, x: 8,  y: 20, role: 't' },
        { id: 'b', index: 1, x: 52, y: 20, role: 't' },
      ],
    },
    dip_switch: {
      label: 'DIP Switch',
      tag: 'wokwi-dip-switch-8',
      w: 80, h: 100,
      terminals: mkCol(8, 10, { step: 12, labels: ['1','2','3','4','5','6','7','8'], idPrefix: 'cl' })
        .concat(mkCol(8, 70, { step: 12, labels: ['1','2','3','4','5','6','7','8'], base: 8, idPrefix: 'cr' })),
    },
    membrane_keypad: {
      label: 'Teclado 4x4',
      tag: 'wokwi-membrane-keypad',
      w: 100, h: 100,
      terminals: mkRow(8, 92, { step: 11, labels: ['R1','R2','R3','R4','C1','C2','C3','C4'] }),
    },
    rotary: {
      label: 'Dial rotatorio',
      tag: 'wokwi-rotary-dialer',
      w: 90, h: 90,
      terminals: mkCol(4, 10, { step: 20, labels: ['A','B','SW','GND'] }),
    },

    // ===================== ACTUADORES =====================
    buzzer: {
      label: 'Buzzer',
      tag: 'wokwi-buzzer',
      w: 60, h: 60,
      terminals: [
        { id: 'p', index: 0, x: 20, y: 10, role: 't' },
        { id: 'n', index: 1, x: 20, y: 50, role: 'gnd' },
      ],
    },
    servo: {
      label: 'Servo',
      tag: 'wokwi-servo',
      w: 90, h: 90,
      terminals: [
        { id: 'sig', index: 0, x: 18, y: 82, role: 'signal', pinName: 'SIG' },
        { id: 'vcc', index: 1, x: 45, y: 82, role: 'vcc', pinName: 'VCC' },
        { id: 'gnd', index: 2, x: 72, y: 82, role: 'gnd', pinName: 'GND' },
      ],
    },
    stepper: {
      label: 'Motor paso a paso',
      tag: 'wokwi-stepper-motor',
      w: 90, h: 80,
      terminals: mkRow(4, 70, { step: 20, labels: ['IN1','IN2','IN3','IN4'] }),
    },
    relay: {
      label: 'Relé',
      tag: 'wokwi-ks2e-m-dc5',
      icon: 'relay',
      w: 110, h: 90,
      terminals: mkRow(4, 14, { step: 26, labels: ['IN','GND','VCC','NC'], roles: ['t','gnd','vcc','nc'], idPrefix: 'r' })
        .concat(mkRow(2, 76, { step: 70, labels: ['COM+','NO'], roles: ['t','no'], base: 4, idPrefix: 'r' })),
    },
    sensor_humedad: {
      label: 'Sensor humedad',
      tag: 'wokwi-soil-moisture-sensor',
      icon: 'sensor_humedad',
      w: 110, h: 70,
      terminals: mkRow(3, 60, { step: 36, labels: ['VCC','GND','AOUT'], roles: ['vcc','gnd','signal'] }),
    },
    bomba_agua: {
      label: 'Bomba de agua',
      tag: null,
      icon: 'bomba_agua',
      w: 90, h: 70,
      terminals: [
        { id: 'vcc', index: 0, x: 18, y: 62, role: 'vcc', pinName: 'VCC' },
        { id: 'gnd', index: 1, x: 72, y: 62, role: 'gnd', pinName: 'GND' },
      ],
    },
    fuente_5v: {
      label: 'Fuente 5V',
      tag: null,
      icon: 'fuente_5v',
      w: 70, h: 70,
      terminals: [
        { id: 'pos', index: 0, x: 35, y: 20, role: 'vcc', pinName: 'POS' },
        { id: 'neg', index: 1, x: 35, y: 52, role: 'gnd', pinName: 'NEG' },
      ],
    },
    generico: {
      label: 'Componente',
      tag: null,
      icon: 'generico',
      w: 70, h: 60,
      terminals: [
        { id: 'vcc', index: 0, x: 14, y: 52, role: 'vcc', pinName: 'VCC' },
        { id: 'gnd', index: 1, x: 56, y: 52, role: 'gnd', pinName: 'GND' },
      ],
    },

    // ===================== SENSORES =====================
    dht22: {
      label: 'Sensor DHT22',
      tag: 'wokwi-dht22',
      w: 70, h: 70,
      terminals: [
        { id: 'vcc', index: 0, x: 10, y: 62, role: 'vcc', pinName: 'VCC' },
        { id: 'data', index: 1, x: 28, y: 62, role: 'signal', pinName: 'DATA' },
        { id: 'gnd', index: 2, x: 52, y: 62, role: 'gnd', pinName: 'GND' },
      ],
    },
    hc_sr04: {
      label: 'Ultrasónico HC-SR04',
      tag: 'wokwi-hc-sr04',
      w: 120, h: 70,
      terminals: [
        { id: 'vcc', index: 0, x: 16, y: 62, role: 'vcc', pinName: 'VCC' },
        { id: 'trig', index: 1, x: 44, y: 62, role: 'signal', pinName: 'TRIG' },
        { id: 'echo', index: 2, x: 72, y: 62, role: 'signal', pinName: 'ECHO' },
        { id: 'gnd', index: 3, x: 100, y: 62, role: 'gnd', pinName: 'GND' },
      ],
    },
    pir: {
      label: 'Sensor PIR',
      tag: 'wokwi-pir-motion-sensor',
      w: 60, h: 60,
      terminals: [
        { id: 'vcc', index: 0, x: 10, y: 52, role: 'vcc' },
        { id: 'out', index: 1, x: 30, y: 52, role: 'signal', pinName: 'OUT' },
        { id: 'gnd', index: 2, x: 50, y: 52, role: 'gnd' },
      ],
    },
    flame: {
      label: 'Sensor de llama',
      tag: 'wokwi-flame-sensor',
      w: 60, h: 60,
      terminals: mkCol(4, 10, { step: 13, labels: ['VCC','AOUT','DOUT','GND'], roles: ['vcc','signal','signal','gnd'] }),
    },
    gas: {
      label: 'Sensor de gas MQ',
      tag: 'wokwi-gas-sensor',
      w: 70, h: 70,
      terminals: mkRow(4, 62, { step: 15, labels: ['VCC','AOUT','DOUT','GND'], roles: ['vcc','signal','signal','gnd'] }),
    },
    sound: {
      label: 'Micrófono (sonido)',
      tag: 'wokwi-small-sound-sensor',
      w: 60, h: 60,
      terminals: mkRow(4, 52, { step: 13, labels: ['VCC','AOUT','DOUT','GND'], roles: ['vcc','signal','signal','gnd'] }),
    },
    mpu6050: {
      label: 'IMU MPU6050',
      tag: 'wokwi-mpu6050',
      w: 70, h: 70,
      terminals: mkRow(4, 60, { step: 16, labels: ['5V','GND','SCL','SDA'], roles: ['vcc','gnd','signal','signal'] }),
    },
    hx711: {
      label: 'Celdas HX711',
      tag: 'wokwi-hx711',
      w: 70, h: 80,
      terminals: mkRow(4, 68, { step: 16, labels: ['VCC','GND','SCK','DAT'], roles: ['vcc','gnd','signal','signal'] }),
    },
    joystick: {
      label: 'Joystick',
      tag: 'wokwi-analog-joystick',
      w: 80, h: 80,
      terminals: mkRow(5, 72, { step: 14, labels: ['GND','VCC','X','Y','SW'], roles: ['gnd','vcc','signal','signal','signal'] }),
    },
    ir_receiver: {
      label: 'Receptor IR',
      tag: 'wokwi-ir-receiver',
      w: 50, h: 60,
      terminals: mkCol(3, 25, { step: 20, labels: ['OUT','GND','VCC'], roles: ['signal','gnd','vcc'] }),
    },

    // ===================== DISPLAYS =====================
    seg7: {
      label: 'Display 7-seg',
      tag: 'wokwi-7segment',
      color: 'red',
      w: 70, h: 110,
      terminals: [
        { id: 'a', index: 0, x: 35, y: 8,  role: 'segment' },
        { id: 'b', index: 1, x: 35, y: 26, role: 'segment' },
        { id: 'c', index: 2, x: 35, y: 44, role: 'segment' },
        { id: 'd', index: 3, x: 35, y: 62, role: 'segment' },
        { id: 'e', index: 4, x: 35, y: 80, role: 'segment' },
        { id: 'f', index: 5, x: 35, y: 98, role: 'segment' },
        { id: 'g', index: 6, x: 12, y: 54, role: 'segment' },
        { id: 'dp', index: 7, x: 58, y: 54, role: 'segment' },
      ],
    },
    lcd1602: {
      label: 'LCD 16x2',
      tag: 'wokwi-lcd1602',
      color: '0',
      w: 160, h: 100,
      terminals: [
        { id: 'vss', index: 0,  x: 10, y: 92, role: 'gnd', pinName: 'VSS' },
        { id: 'vdd', index: 1,  x: 24, y: 92, role: 'vcc', pinName: 'VDD' },
        { id: 'v0', index: 2,  x: 38, y: 92, role: 't',    pinName: 'V0' },
        { id: 'rs', index: 3,  x: 52, y: 92, role: 'signal', pinName: 'RS' },
        { id: 'rw', index: 4,  x: 66, y: 92, role: 'gnd', pinName: 'RW' },
        { id: 'e', index: 5,  x: 80, y: 92, role: 'signal', pinName: 'E' },
        { id: 'd4', index: 6,  x: 94, y: 92, role: 'signal', pinName: 'D4' },
        { id: 'd5', index: 7,  x: 108, y: 92, role: 'signal', pinName: 'D5' },
        { id: 'd6', index: 8,  x: 122, y: 92, role: 'signal', pinName: 'D6' },
        { id: 'd7', index: 9,  x: 136, y: 92, role: 'signal', pinName: 'D7' },
        { id: 'a', index: 10, x: 150, y: 92, role: 'vcc', pinName: 'LED+' },
        { id: 'k', index: 11, x: 150, y: 80, role: 'gnd', pinName: 'LED-' },
      ],
    },
    lcd2004: {
      label: 'LCD 20x4',
      tag: 'wokwi-lcd2004',
      color: '0',
      w: 180, h: 110,
      terminals: mkCol(8, 8, { step: 12, labels: ['VSS','VDD','V0','RS','RW','E','D4','D5'], idPrefix: 'cl' })
        .concat(mkCol(4, 168, { step: 12, labels: ['D6','D7','LED+','LED-'], roles: ['signal','signal','vcc','gnd'], base: 8, idPrefix: 'cr' })),
    },
    oled: {
      label: 'OLED SSD1306',
      tag: 'wokwi-ssd1306',
      w: 90, h: 70,
      terminals: mkRow(4, 60, { step: 20, labels: ['GND','VCC','SCL','SDA'], roles: ['gnd','vcc','signal','signal'] }),
    },
    tft: {
      label: 'TFT ILI9341',
      tag: 'wokwi-ili9341',
      w: 110, h: 90,
      terminals: mkRow(8, 82, { step: 12, labels: ['VCC','GND','CS','RESET','DC','MOSI','SCK','LED'] }),
    },
    microsd: {
      label: 'MicroSD',
      tag: 'wokwi-microsd-card',
      w: 70, h: 70,
      terminals: mkRow(6, 62, { step: 11, labels: ['CS','MOSI','SCK','MISO','VCC','GND'], roles: ['signal','signal','signal','signal','vcc','gnd'] }),
    },
    rtc: {
      label: 'RTC DS1307',
      tag: 'wokwi-ds1307',
      w: 70, h: 70,
      terminals: mkCol(4, 8, { step: 16, labels: ['X1','X2','GND','VBAT'], idPrefix: 'cl' })
        .concat(mkCol(4, 62, { step: 16, labels: ['SDA','SCL','SQW','VCC'], roles: ['signal','signal','signal','vcc'], base: 4, idPrefix: 'cr' })),
    },
  };


  // Protoboard: retícula clara (no 300 puntos pegados). Filas de buses +
  // unas pocas columnas de proto, con espacio para clicar y tender cables.
  function makeBreadboardTerminals() {
    const t = [];
    const rows = 4;
    const cols = 10;
    const spacingX = 36, spacingY = 36;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        t.push({
          id: `bb_${r}_${c}`,
          index: r * cols + c,
          x: 36 + c * spacingX,
          y: 36 + r * spacingY,
          pinName: String.fromCharCode(65 + r) + (c + 1),
        });
      }
    }
    return t;
  }

  // ---------- Sincronización positional del overlay HTML ----------
  // Traducción de coordenadas de stage a coordenadas de pantalla,
  // para colocar cada <wokwi-*> sobre su contenedor Konva.
  function applyTransformToHost() {
    if (!componentLayerHost || !stage) return;
    const scale = stage.scaleX();
    const pos = stage.position();
    componentLayerHost.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
    componentLayerHost.style.transformOrigin = '0 0';
  }

  // ---------- Render de un componente ----------
  // Añade un componente nuevo (ID autogenerado) en (x, y).
  function addComponent(defKey, x, y) {
    const built = buildComponent(defKey, uid(), x, y);
    if (built) emitChanged();
    return built;
  }

  // Núcleo de instanciación: crea el grupo Konva, terminales, nodos de
  // estado y el <wokwi-*> con un compId dado. Reutilizado tanto al crear
  // un componente nuevo como al reconstruir un diseño guardado (restore).
  // `opts` puede incluir:
  //   imagen      -> URL del SVG de la guía de ensamblaje para este componente
  //   customLabel -> nombre real del componente (BOM) en lugar del genérico
  function buildComponent(defKey, compId, x, y, opts) {
    const def = COMPONENT_DEFS[defKey];
    if (!def) return null;
    opts = opts || {};
    const label = opts.customLabel || def.label;

    // Contenedor geométrico Konva (hitbox + posición/drag)
    const group = new Konva.Group({
      x, y, width: def.w, height: def.h + HEADER_H, draggable: true,
    });
    const hitRect = new Konva.Rect({
      name: 'drag-body',
      y: 0, width: def.w, height: def.h, fill: 'rgba(15,23,42,0.02)',
    });
    group.add(hitRect);

    const isElectrical = Array.isArray(def.terminals) && def.terminals.length > 0;

    const handle = new Konva.Rect({
      name: 'drag-handle',
      x: 0, y: -HEADER_H, width: def.w, height: HEADER_H,
      fill: '#1e293b', cornerRadius: 5,
    });
    const marco = new Konva.Rect({
      name: 'marco',
      width: def.w, height: def.h,
      stroke: '#38bdf8', strokeWidth: 2, dash: [5, 4],
      cornerRadius: 4,
      visible: false,
    });
    const etiqueta = new Konva.Text({
      x: 8, y: -HEADER_H + 6,
      text: label,
      fontSize: 11,
      fill: '#e2e8f0',
      fontStyle: 'bold',
      width: Math.max(40, def.w - 28),
      ellipsis: true,
    });
    if (!isElectrical) {
      marco.visible(false);
      handle.visible(false);
      etiqueta.visible(false);
    }
    group.add(handle);
    group.add(marco);
    group.add(etiqueta);

    const delComp = makeDeleteButton(def.w - 8, -HEADER_H + 13, () => removeComponent(compId));
    delComp.name('del-comp');
    group.add(delComp);

    const setGrab = () => { if (stage) stage.container().style.cursor = 'grab'; };
    const setDefault = () => { if (stage) stage.container().style.cursor = 'default'; };
    handle.on('mouseenter', setGrab);
    hitRect.on('mouseenter', setGrab);
    handle.on('mouseleave', setDefault);
    hitRect.on('mouseleave', setDefault);
    group.on('dragstart', () => {
      if (wireFrom) cancelWire();
      if (stage) stage.container().style.cursor = 'grabbing';
    });
    group.on('dragend', () => {
      const nx = Math.round(group.x() / GRID) * GRID;
      const ny = Math.round(group.y() / GRID) * GRID;
      group.position({ x: nx, y: ny });
      def.terminals.forEach((td) => {
        const node = state.nodes.find((n) => n.id === `${compId}_${td.id}`);
        if (node) { node.x = nx + td.x; node.y = ny + td.y; }
      });
      synchComponentHost(def, compId, nx, ny);
      refreshWireBadges();
      if (layerWires) layerWires.batchDraw();
      if (layerUI) layerUI.batchDraw();
      setDefault();
      emitChanged();
    });

    group.on('click tap', (evt) => {
      if (evt.target && evt.target.getParent && evt.target.getParent().name() === 'del-comp') return;
      if (evt.target && (evt.target.className === 'Circle' || evt.target.nodeId)) return;
      selectComponent(compId);
    });
    group.on('contextmenu', (evt) => {
      evt.evt.preventDefault();
      evt.cancelBubble = true;
      selectComponent(compId);
      showContextMenu(evt.evt.clientX, evt.evt.clientY, [
        { label: 'Quitar componente', action: () => removeComponent(compId) },
        { label: 'Desconectar pines', action: () => disconnectComponent(compId) },
      ]);
    });

    // Terminales (círculos clicables) + objetos de estado
    const terminalNodes = [];
    def.terminals.forEach((td, i) => {
      const nodeId = `${compId}_${td.id}`;
      state.nodes.push({
        id: nodeId,
        compType: defKey,
        compId: compId,
        index: td.index ?? i,
        label: td.pinName || null,
        role: td.role || null,
        pinName: td.pinName || null,
        avrPort: td.avrPort ?? null,
        bit: td.bit ?? null,
        x: x + td.x,
        y: y + td.y,
      });

      const circle = new Konva.Circle({
        x: td.x, y: td.y, radius: 4.5,
        fill: '#f6ad55', stroke: '#1a202c', strokeWidth: 1,
        hitStrokeWidth: 10,
      });
      circle.nodeId = nodeId;
      circle.on('mousedown touchstart', (evt) => {
        evt.cancelBubble = true;
        const src = evt.evt.touches ? evt.evt.touches[0] : evt.evt;
        const start = { x: src.clientX, y: src.clientY };
        let moved = false;
        const onMove = (ev) => {
          const q = ev.touches ? ev.touches[0] : ev;
          if (Math.hypot(q.clientX - start.x, q.clientY - start.y) > 8) {
            moved = true;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('touchmove', onMove);
            if (wireFrom) cancelWire();
            group.startDrag();
          }
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onUp);
          if (!moved) onTerminalClick(nodeId, circle, evt);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onUp);
      });
      circle.on('contextmenu', (evt) => {
        evt.evt.preventDefault();
        evt.cancelBubble = true;
        const nWires = state.connections.filter((c) => c.from === nodeId || c.to === nodeId).length;
        showContextMenu(evt.evt.clientX, evt.evt.clientY, [
          { label: nWires ? `Desconectar pin (${nWires})` : 'Pin sin cables', action: () => disconnectPin(nodeId), disabled: !nWires },
          { label: 'Quitar componente', action: () => removeComponent(compId) },
        ]);
      });
      circle.on('mouseenter', () => {
        stage.container().style.cursor = 'crosshair';
      });
      circle.on('mouseleave', () => {
        stage.container().style.cursor = 'default';
      });
      group.add(circle);
      terminalNodes.push(circle);
    });

    // Drag del grupo: actualiza el modelo + la posición del HTML overlay
    group.on('dragmove', () => {
      const gx = group.x(), gy = group.y();
      def.terminals.forEach((td, i) => {
        const node = state.nodes.find((n) => n.id === `${compId}_${td.id}`);
        if (node) { node.x = gx + td.x; node.y = gy + td.y; }
        const circle = terminalNodes[i];
        if (circle) { circle.x(td.x); circle.y(td.y); }
      });
      synchComponentHost(def, compId, gx, gy);
      refreshWireBadges();
      if (layerWires) layerWires.batchDraw();
      if (layerUI) layerUI.batchDraw();
      emitChanged();
    });

    layerComponents.add(group);
    layerComponents.batchDraw();

    // Crear el host HTML (wokwi o imagen de la guía) y colocarlo en el overlay
    const host = createWokwiElement(def, compId, x, y, group, opts);
    state.components.push({
      id: compId,
      type: defKey,
      label: label,
      terminals: def.terminals.map((td) => ({ id: `${compId}_${td.id}` })),
      host, group,
    });

    return { compId, group, host };
  }

  // =====================================================================
  // Iconos SVG autocontenidos. Cada componente dispone de un dibujo propio
  // (galga oscura + acento de color), de modo que la vista es siempre
  // visual aunque el <wokwi-*> no esté registrado en la librería.
  // Clave: tipo del componente (def.type) o def.icon.
  // =====================================================================
  const ICONOS = {
    // ---- Tableros / microcontroladores ----
    arduino_uno: chip('Arduino', '#00a8a8'),
    arduino_nano: chip('Nano', '#0085c3'),
    arduino_mega: chip('Mega', '#00979d'),
    esp32_devkit: chip('ESP32', '#e7352c'),
    attiny85: chip('ATTINY', '#a5c'),
    rp2040: chip('Pico', '#c55'),
    protoboard: '<rect x="2" y="8" width="96" height="84" rx="6" fill="#f3e8d8"/><rect x="2" y="8" width="96" height="10" rx="6" fill="#dc2626"/><rect x="2" y="82" width="96" height="10" rx="6" fill="#2563eb"/><g fill="#1e293b">' +
      (function () {
        let h = '';
        for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) h += '<circle cx="' + (12 + c * 8) + '" cy="' + (28 + r * 10) + '" r="1.6"/>';
        return h;
      }()) + '</g>',
    vcc: '<text x="50" y="58" font-size="30" font-weight="bold" fill="#fbbf24" text-anchor="middle">5V</text>',
    gnd: '<text x="50" y="58" font-size="26" font-weight="bold" fill="#34d399" text-anchor="middle">GND</text>',
    // ---- Pasivos / LEDs ----
    resistor: '<rect x="10" y="40" width="80" height="20" rx="6" fill="#f59e0b"/><rect x="10" y="40" width="26" height="20" rx="6" fill="#b45309"/><rect x="70" y="40" width="20" height="20" rx="6" fill="#7c2d12"/>',
    potentiometer: '<rect x="18" y="20" width="64" height="60" rx="8" fill="#b45309"/><circle cx="50" cy="50" r="16" fill="#fbbf24"/><circle cx="50" cy="50" r="6" fill="#78350f"/><path d="M50 50 L62 34" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>',
    slide_pot: '<rect x="14" y="42" width="72" height="16" rx="8" fill="#f59e0b"/><rect x="34" y="22" width="12" height="56" rx="6" fill="#78350f"/>',
    photoresistor: '<rect x="18" y="24" width="64" height="52" rx="8" fill="#16a34a"/><circle cx="50" cy="50" r="17" fill="#fef08a"/><path d="M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" fill="none"/><circle cx="50" cy="50" r="9" fill="#16a34a"/>',
    ntc_temp: '<rect x="18" y="26" width="64" height="48" rx="8" fill="#0ea5e9"/><polygon points="50,36 62,58 38,58" fill="#e0f2fe"/><line x1="38" y1="64" x2="62" y2="64" stroke="#bae6fd" stroke-width="2"/>',
    tilt_switch: '<rect x="20" y="24" width="60" height="48" rx="8" fill="#7c3aed"/><circle cx="44" cy="48" r="8" fill="#e9d5ff"/><path d="M60 30 l-6 20 M66 30 l-6 20" stroke="#7c3aed" stroke-width="2"/>',
    led_red: led('#ef4444'),
    led_green: led('#22c55e'),
    led_blue: led('#3b82f6'),
    led_rgb: led('#a855f7'),
    led_bar: '<rect x="14" y="18" width="72" height="64" rx="8" fill="#0f172a"/><g fill="#22c55e"><rect x="20" y="24" width="60" height="8" rx="2"/><rect x="26" y="34" width="54" height="8" rx="2" fill="#84cc16"/><rect x="32" y="44" width="48" height="8" rx="2" fill="#facc15"/><rect x="38" y="54" width="42" height="8" rx="2" fill="#fb923c"/><rect x="44" y="64" width="36" height="8" rx="2" fill="#ef4444"/></g>',
    led_ring: '<circle cx="50" cy="50" r="28" fill="#0f172a"/><g fill="#22c55e"><circle cx="50" cy="24" r="7"/><circle cx="50" cy="76" r="7"/><circle cx="24" cy="50" r="7"/><circle cx="76" cy="50" r="7"/><circle cx="32" cy="32" r="7"/><circle cx="68" cy="68" r="7"/><circle cx="68" cy="32" r="7"/><circle cx="32" cy="68" r="7"/></g>',
    neopixel: led('#22d3ee'),
    neopixel_matrix: '<rect x="10" y="10" width="80" height="80" rx="6" fill="#0f172a"/><g fill="#22d3ee">' + malla(5, 5, 12, 12, 16) + '</g>',
    // ---- Botones / interruptores / teclado ----
    button: '<rect x="24" y="24" width="52" height="52" rx="26" fill="#334155"/><circle cx="50" cy="50" r="18" fill="#ef4444"/><circle cx="50" cy="50" r="8" fill="#7f1d1d"/>',
    button_6mm: '<rect x="26" y="26" width="48" height="48" rx="24" fill="#475569"/><circle cx="50" cy="50" r="15" fill="#f8fafc"/>',
    slide_switch: '<rect x="14" y="38" width="72" height="24" rx="12" fill="#475569"/><circle cx="34" cy="50" r="11" fill="#22c55e"/>',
    dip_switch: '<g fill="#cbd5e1">' + [10,26,42,58,74].map((x) => '<rect x="'+x+'" y="30" width="14" height="34" rx="4"/>').join('') + '</g><rect x="14" y="10" width="72" height="14" rx="4" fill="#334155"/><rect x="14" y="76" width="72" height="12" rx="4" fill="#334155"/>',
    membrane_keypad: '<rect x="8" y="8" width="84" height="84" rx="6" fill="#334155"/><g fill="#94a3b8">' + malla(4, 4, 8, 8, 20) + '</g>',
    joystick: '<rect x="16" y="24" width="68" height="52" rx="8" fill="#475569"/><rect x="10" y="14" width="14" height="72" rx="4" fill="#2dd4bf"/><circle cx="50" cy="50" r="15" fill="#22d3ee"/><circle cx="50" cy="50" r="6" fill="#0e7490"/><rect x="6" y="44" width="88" height="8" rx="4" fill="#2dd4bf"/>',
    rotary: '<circle cx="50" cy="50" r="26" fill="#475569"/><circle cx="50" cy="50" r="18" fill="#94a3b8"/><path d="M50 32 L50 50 L60 58" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round"/>',
    // ---- Actuadores ----
    buzzer: '<circle cx="50" cy="50" r="32" fill="#f59e0b"/><circle cx="50" cy="50" r="20" fill="#1c1917"/><circle cx="50" cy="50" r="8" fill="#f59e0b"/>',
    servo: '<rect x="18" y="26" width="46" height="48" rx="6" fill="#2563eb"/><rect x="30" y="58" width="22" height="16" rx="3" fill="#1e3a8a"/><path d="M86 50 a24 12 0 0 1 0 0 h-12" stroke="#334155" stroke-width="8" fill="none" stroke-linecap="round"/>',
    stepper: '<rect x="16" y="16" width="68" height="68" rx="8" fill="#dc2626"/><circle cx="50" cy="50" r="24" fill="#7f1d1d"/><circle cx="50" cy="50" r="10" fill="#fecaca"/>',
    relay: '<rect x="10" y="18" width="80" height="64" rx="8" fill="#db2777"/><rect x="18" y="26" width="64" height="18" rx="4" fill="#f9a8d4"/><g stroke="#831843" stroke-width="2"><line x1="22" y1="60" x2="40" y2="60"/><line x1="78" y1="60" x2="60" y2="60"/></g><path d="M40 60 l14 -12 M60 60 l-14 -12" stroke="#831843" stroke-width="2" fill="none"/>',
    bomba_agua: '<rect x="16" y="20" width="68" height="60" rx="10" fill="#0891b2"/><path d="M26 36 l10 10 -10 10 M74 36 l-10 10 10 10" stroke="#a5f3fc" stroke-width="3" fill="none" stroke-linecap="round"/>',
    fuente_5v: '<rect x="14" y="22" width="72" height="56" rx="8" fill="#f59e0b"/><circle cx="38" cy="40" r="6" fill="#fff7ed" stroke="#78350f"/><path d="M50 36 l8 8 -8 8" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="56" y="58" width="14" height="6" rx="2" fill="#7c2d12"/>',
    // ---- Sensores ----
    dht22: '<rect x="20" y="22" width="60" height="56" rx="8" fill="#16a34a"/><g fill="#86efac"><line x1="36" y1="34" x2="64" y2="52" stroke="#16a34a" stroke-width="6"/><line x1="64" y1="34" x2="36" y2="52" stroke="#16a34a" stroke-width="6"/><circle cx="36" cy="34" r="6"/><circle cx="64" cy="34" r="6"/><circle cx="36" cy="52" r="6"/><circle cx="64" cy="52" r="6"/></g>',
    hc_sr04: '<rect x="14" y="30" width="72" height="40" rx="6" fill="#1e40af"/><circle cx="34" cy="50" r="14" fill="#60a5fa"/><circle cx="66" cy="50" r="14" fill="#60a5fa"/>',
    sensor_humedad: '<rect x="14" y="16" width="72" height="30" rx="6" fill="#334155"/><g stroke="#fbbf24" stroke-width="3"><line x1="18" y1="26" x2="24" y2="40" /><line x1="34" y1="26" x2="30" y2="40" /><line x1="50" y1="26" x2="46" y2="40" /><line x1="66" y1="26" x2="62" y2="40" /><line x1="82" y1="26" x2="78" y2="40" /></g>',
    pir: '<rect x="12" y="22" width="76" height="46" rx="23" fill="#cbd5e1"/><circle cx="38" cy="40" r="12" fill="#334155"/><circle cx="62" cy="40" r="12" fill="#334155"/>',
    flame: '<path d="M50 20 c10 12 16 20 12 32 a12 12 0 0 1 -24 0 c-3-8 1-15 4-20 3 4 4 6 6 4 1-7 2-9 2-16z" fill="#f97316"/><path d="M50 38 c5 7 7 11 4 18 a9 8 0 0 1 -8-2 c-1-6 1-10 4-16z" fill="#fde047"/>',
    gas: '<rect x="10" y="20" width="80" height="54" rx="6" fill="#3730a3"/><g stroke="#a5b4fc" stroke-width="3"><line x1="24" y1="36" x2="36" y2="36"/><line x1="24" y1="46" x2="34" y2="46"/><line x1="24" y1="56" x2="40" y2="56"/></g><rect x="52" y="32" width="20" height="24" rx="3" fill="#818cf8"/>',
    sound: '<circle cx="40" cy="50" r="18" fill="#0ea5e9"/><path d="M56 40 a16 16 0 0 1 0 20 M62 32 a24 24 0 0 1 0 36" stroke="#7dd3fc" stroke-width="4" fill="none" stroke-linecap="round"/>',
    mpu6050: '<rect x="18" y="18" width="64" height="64" rx="6" fill="#0f172a"/><rect x="30" y="30" width="40" height="40" rx="4" fill="#334155"/><circle cx="50" cy="50" r="9" fill="#22d3ee"/><g stroke="#67e8f9" stroke-width="2"><line x1="30" y1="32" x2="42" y2="44"/><line x1="70" y1="32" x2="58" y2="44"/></g>',
    hx711: '<rect x="18" y="22" width="64" height="56" rx="6" fill="#166534"/><rect x="30" y="34" width="40" height="12" rx="2" fill="#22c55e"/><rect x="34" y="52" width="32" height="6" rx="2" fill="#4ade80"/><rect x="34" y="62" width="20" height="6" rx="2" fill="#4ade80"/>',
    ir_receiver: '<rect x="24" y="24" width="52" height="52" rx="26" fill="#334155"/><circle cx="50" cy="44" r="12" fill="#ef4444"/><rect x="44" y="54" width="12" height="14" rx="3" fill="#ef4444"/>',
    // ---- Displays ----
    seg7: '<rect x="18" y="20" width="64" height="60" rx="8" fill="#0f172a"/><g fill="#ef4444"><polygon points="34,28 66,28 60,34 40,34"/><polygon points="70,34 76,40 76,56 70,62"/><polygon points="34,62 66,62 60,56 40,56"/><polygon points="30,34 36,40 36,56 30,62"/><polygon points="34,28 40,34 40,56 34,62"/><polygon points="40,46 60,46 66,52 34,52"/></g>',
    lcd1602: lcd('16x02'),
    lcd2004: lcd('20x04'),
    oled: lcd('OLED'),
    tft: '<rect x="16" y="22" width="68" height="56" rx="6" fill="#0ea5e9"/>',
    microsd: '<rect x="22" y="22" width="56" height="56" rx="6" fill="#f59e0b"/><rect x="30" y="30" width="40" height="6" rx="2" fill="#92400e"/><rect x="30" y="40" width="40" height="6" rx="2" fill="#92400e"/><path d="M30 70 L30 60 L36 54 L64 54 L70 60 L70 70 Z" fill="#92400e"/>',
    rtc: '<rect x="20" y="18" width="60" height="64" rx="8" fill="#7c3aed"/><circle cx="50" cy="42" r="20" fill="#e9d5ff"/><circle cx="50" cy="42" r="15" fill="#ffffff"/><g stroke="#6b21a8" stroke-width="2"><line x1="50" y1="42" x2="50" y2="32"/><line x1="50" y1="42" x2="58" y2="42"/></g><rect x="42" y="66" width="16" height="8" rx="2" fill="#6b21a8"/>',
    // ---- Fallback general ----
    generico: '<rect x="16" y="14" width="68" height="72" rx="10" fill="#475569"/><g stroke="#94a3b8" stroke-width="2" fill="none"><rect x="26" y="26" width="48" height="36" rx="4"/><circle cx="42" cy="40" r="3" fill="#94a3b8"/><circle cx="58" cy="40" r="3" fill="#94a3b8"/><line x1="32" y1="54" x2="68" y2="54"/></g>',
  };

  // Icons compuestos
  function chip(texto, color) {
    return '<rect x="8" y="8" width="84" height="84" rx="10" fill="#08111f"/><rect x="8" y="26" width="5" height="14" rx="2" fill="#334155"/><rect x="87" y="30" width="5" height="14" rx="2" fill="#334155"/><rect x="20" y="8" width="14" height="5" rx="2" fill="#334155"/><rect x="20" y="87" width="14" height="5" rx="2" fill="#334155"/><rect x="12" y="34" width="76" height="32" rx="4" fill="'+color+'"/><text x="50" y="56" font-size="16" font-family="Arial" font-weight="bold" fill="#ffffff" text-anchor="middle">'+texto+'</text><g fill="#3b82f6"><rect x="14" y="16" width="6" height="6"/><rect x="24" y="16" width="6" height="6"/><rect x="14" y="78" width="6" height="6"/><rect x="24" y="78" width="6" height="6"/></g>';
  }
  function led(color) {
    return '<circle cx="50" cy="38" r="20" fill="#0f172a"/><circle cx="50" cy="38" r="15" fill="'+color+'"/><circle cx="50" cy="38" r="7" fill="#fef08a"/><path d="M50 54 l-4 14 h8 z" fill="#64748b"/><g stroke="#94a3b8"><line x1="46" y1="76" x2="44" y2="88"/><line x1="54" y1="76" x2="56" y2="88"/></g>';
  }
  function lcd(texto) {
    return '<rect x="12" y="26" width="76" height="48" rx="6" fill="#0f172a"/><rect x="20" y="34" width="60" height="26" rx="3" fill="#67e8f9" fill-opacity="0.25"/><text x="50" y="53" font-size="15" font-family="Arial" font-weight="bold" fill="#a5f3fc" text-anchor="middle">'+texto+'</text><rect x="36" y="66" width="28" height="6" rx="3" fill="#334155"/>';
  }
  function malla(c, r, x0, y0, s) {
    let out = '';
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) out += '<rect x="' + (x0 + i * s) + '" y="' + (y0 + j * s) + '" width="' + (s - 6) + '" height="' + (s - 6) + '" rx="2"/>';
    return out;
  }

  // Devuelve el SVG inline para un def (por su icon o por su tipo).
  function svgIcono(def) {
    const clave = (def && (def.icon || def.type)) || 'generico';
    return ICONOS[clave] || ICONOS.generico;
  }

  // Crea y posiciona el host visual en el div overlay.
  // Prioridad de visual:
  //   1) imagen de la guía de ensamblaje (opts.imagen -> <img src>), la MISMA
  //      librería que usa Guia.cshtml vía ObtenerUrlImagenPorNombre().
  //   2) <wokwi-*> real si su tag está registrado (piezas auténticas).
  //   3) SVG autocontenido (fallback: siempre hay imagen).
  function svgProtoboard() {
    const holes = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) {
        holes.push('<circle cx="' + (36 + c * 36) + '" cy="' + (36 + r * 36) + '" r="5" fill="#334155"/>');
        holes.push('<circle cx="' + (36 + c * 36) + '" cy="' + (36 + r * 36) + '" r="2.2" fill="#0f172a"/>');
      }
    }
    return (
      '<rect x="0" y="0" width="420" height="200" rx="10" fill="#e7d3b0"/>' +
      '<rect x="0" y="0" width="420" height="18" rx="10" fill="#dc2626"/>' +
      '<rect x="0" y="182" width="420" height="18" rx="10" fill="#2563eb"/>' +
      holes.join('')
    );
  }

  function createWokwiElement(def, compId, x, y, group, opts) {
    if (!componentLayerHost) return null;
    const esProto = def.icon === 'protoboard' || def.label === 'Protoboard' || def.w === 420;
    let el;
    const tagDefined = !esProto && def.tag && typeof customElements !== 'undefined' && customElements.get(def.tag);
    const imgUrl = esProto ? null : ((opts && opts.imagen) || def.imagen);
    if (esProto) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 420 200');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('style', 'position:absolute;left:0;top:0;pointer-events:none;');
      svg.innerHTML = svgProtoboard();
      el = svg;
    } else if (imgUrl) {
      const img = document.createElement('img');
      // crossOrigin ANTES de asignar src: evita que el canvas se marque como
      // "tainted" y permite que stage.toDataURL() exporte las placas e imágenes.
      img.crossOrigin = 'Anonymous';
      img.src = imgUrl;
      img.alt = (opts && opts.customLabel) || def.label || '';
      img.style.objectFit = 'contain';
      img.style.pointerEvents = 'none';
      img.style.position = 'absolute';
      el = img;
    } else if (tagDefined) {
      el = document.createElement(def.tag);
      if (def.color) el.setAttribute('color', def.color);
      el.setAttribute('style', 'position:absolute;left:0;top:0;pointer-events:none;');
    } else {
      // SVG autocontenido: garantiza una imagen para todo componente,
      // incluso si el <wokwi-*> no está registrado o no existe para el tipo.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('style', 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;');
      svg.innerHTML = svgIcono(def);
      el = svg;
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = def.w + 'px';
    el.style.height = def.h + 'px';
    el.style.boxSizing = 'border-box';
    componentLayerHost.appendChild(el);
    return el;
  }

  function synchComponentHost(def, compId, gx, gy) {
    const comp = state.components.find((c) => c.id === compId);
    if (comp && comp.host) {
      comp.host.style.left = gx + 'px';
      comp.host.style.top = gy + 'px';
    }
  }

  function makeDeleteButton(x, y, onClick) {
    const g = new Konva.Group({ x, y });
    g.add(new Konva.Circle({
      radius: 10, fill: '#ef4444', stroke: '#7f1d1d', strokeWidth: 1,
    }));
    g.add(new Konva.Text({
      text: '×', fontSize: 16, fontStyle: 'bold', fill: '#fff',
      x: -5.5, y: -9, listening: false,
    }));
    g.on('mouseenter', () => {
      if (stage) stage.container().style.cursor = 'pointer';
    });
    g.on('mouseleave', () => {
      if (stage) stage.container().style.cursor = 'default';
    });
    g.on('mousedown touchstart', (evt) => { evt.cancelBubble = true; });
    g.on('click tap', (evt) => {
      evt.cancelBubble = true;
      if (typeof evt.evt?.stopPropagation === 'function') evt.evt.stopPropagation();
      onClick();
    });
    return g;
  }

  function hideContextMenu() {
    const el = document.getElementById('sim2d-ctx-menu');
    if (el) el.style.display = 'none';
  }

  function showContextMenu(clientX, clientY, items) {
    let el = document.getElementById('sim2d-ctx-menu');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sim2d-ctx-menu';
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      if (it.disabled) b.disabled = true;
      b.addEventListener('click', () => {
        hideContextMenu();
        if (!it.disabled && it.action) it.action();
      });
      el.appendChild(b);
    });
    el.style.display = 'block';
    el.style.left = Math.min(clientX, window.innerWidth - 200) + 'px';
    el.style.top = Math.min(clientY, window.innerHeight - 120) + 'px';
  }

  function paintSelection() {
    state.components.forEach((c) => {
      if (!c.group) return;
      const marco = c.group.findOne('.marco');
      if (marco) {
        marco.visible(c.id === selectedCompId);
        marco.stroke('#38bdf8');
        marco.strokeWidth(2);
      }
    });
    layerWires.find('.wire').forEach((s) => {
      const on = s.wireId === selectedWireId;
      s.strokeWidth(on ? 5.5 : 3.4);
      s.shadowEnabled(on);
      s.shadowColor(on ? '#38bdf8' : 'transparent');
      s.shadowBlur(on ? 8 : 0);
    });
    if (layerComponents) layerComponents.batchDraw();
    if (layerWires) layerWires.batchDraw();
    if (layerUI) layerUI.batchDraw();
  }

  function clearSelection() {
    selectedCompId = null;
    selectedWireId = null;
    hideContextMenu();
    paintSelection();
  }

  function selectComponent(compId) {
    selectedCompId = compId;
    selectedWireId = null;
    hideContextMenu();
    paintSelection();
  }

  function selectWire(wireId) {
    selectedWireId = wireId;
    selectedCompId = null;
    hideContextMenu();
    paintSelection();
  }

  function disconnectPin(nodeId) {
    const ids = state.connections
      .filter((c) => c.from === nodeId || c.to === nodeId)
      .map((c) => c.id);
    ids.forEach((id) => removeWire(id));
    clearSelection();
  }

  function disconnectComponent(compId) {
    const ids = state.connections.filter((c) => {
      const f = state.nodes.find((n) => n.id === c.from);
      const t = state.nodes.find((n) => n.id === c.to);
      return (f && f.compId === compId) || (t && t.compId === compId);
    }).map((c) => c.id);
    ids.forEach((id) => removeWire(id));
    clearSelection();
  }

  function removeComponent(compId) {
    disconnectComponent(compId);
    state.nodes = state.nodes.filter((n) => n.compId !== compId);
    const idx = state.components.findIndex((c) => c.id === compId);
    if (idx >= 0) {
      const comp = state.components[idx];
      if (comp.host && comp.host.parentNode) comp.host.parentNode.removeChild(comp.host);
      if (comp.group) comp.group.destroy();
      state.components.splice(idx, 1);
    }
    selectedCompId = null;
    if (layerComponents) layerComponents.batchDraw();
    emitChanged();
  }

  function deleteSelection() {
    if (selectedWireId) {
      removeWire(selectedWireId);
      selectedWireId = null;
      return;
    }
    if (selectedCompId) {
      removeComponent(selectedCompId);
    }
  }

  const WIRE_COLORS = {
    rojo: '#ef4444', amarillo: '#eab308', verde: '#22c55e', azul: '#3b82f6',
    naranja: '#f97316', negro: '#334155', blanco: '#e5e7eb', gris: '#63b3ed',
    morado: '#8b5cf6', cafe: '#92400e', marron: '#92400e',
  };

  function colorDeCable(nombre) {
    const k = String(nombre || 'gris').toLowerCase().trim();
    if (WIRE_COLORS[k]) return WIRE_COLORS[k];
    if (/^#?[0-9a-f]{3,8}$/i.test(k)) return k.charAt(0) === '#' ? k : '#' + k;
    return WIRE_COLORS.gris;
  }

  function pointerToWorld() {
    const p = stage.getPointerPosition();
    if (!p) return null;
    try {
      return stage.getAbsoluteTransform().copy().invert().point(p);
    } catch (e) {
      return p;
    }
  }

  // Ruta ortogonal con tramo mínimo: evita palitos cortos cuando los pines
  // están cerca o el Bézier se recorta por no tener bounding box.
  function routePoints(x1, y1, x2, y2) {
    const MIN = 18;
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.hypot(dx, dy) < 8) {
      return [x1, y1, x2, y2];
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
      let midX = (x1 + x2) / 2;
      if (Math.abs(dx) < MIN) midX = x1 + (dx >= 0 ? MIN : -MIN);
      return [x1, y1, midX, y1, midX, y2, x2, y2];
    }
    let midY = (y1 + y2) / 2;
    if (Math.abs(dy) < MIN) midY = y1 + (dy >= 0 ? MIN : -MIN);
    return [x1, y1, x1, midY, x2, midY, x2, y2];
  }

  function nearestNode(p, ignoreId, maxDist) {
    let best = null;
    let bestD = maxDist || 20;
    state.nodes.forEach((n) => {
      if (ignoreId && n.id === ignoreId) return;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    });
    return best;
  }

  function pinCircleById(nodeId) {
    if (!layerComponents) return null;
    const found = [];
    layerComponents.find('Circle').forEach((c) => {
      if (c.nodeId === nodeId) found.push(c);
    });
    return found[0] || null;
  }

  function stopTempPreview() {
    if (stage) {
      stage.off('.tempwire');
      stage.draggable(false);
    }
    if (tempWire) {
      if (tempWire._under) tempWire._under.destroy();
      if (tempWire._capA) tempWire._capA.destroy();
      if (tempWire._capB) tempWire._capB.destroy();
      tempWire.destroy();
      tempWire = null;
    }
  }

  // ---------- Cableado (rutas ortogonales) ----------
  function onTerminalClick(nodeId, circle, evt) {
    evt.cancelBubble = true;
    if (typeof evt.evt?.stopPropagation === 'function') evt.evt.stopPropagation();
    if (wireFrom === null) {
      wireFrom = { nodeId, circle };
      circle.setAttrs({ fill: '#68d391', radius: 6 });
      startTempWire(nodeId);
      layerWires.batchDraw();
    } else {
      if (wireFrom.nodeId === nodeId) {
        cancelWire();
        return;
      }
      const color = wireFrom.color || 'gris';
      finishWire(wireFrom.nodeId, nodeId, color);
      wireFrom = null;
    }
  }

  function startTempWire(fromId) {
    stopTempPreview();
    const fromNode = state.nodes.find((n) => n.id === fromId);
    if (!fromNode) return;
    const x1 = fromNode.x;
    const y1 = fromNode.y;
    const under = new Konva.Line({
      points: [x1, y1, x1, y1],
      stroke: '#052e16',
      strokeWidth: 8,
      listening: false,
      lineCap: 'round',
      lineJoin: 'round',
    });
    tempWire = new Konva.Line({
      points: [x1, y1, x1, y1],
      stroke: '#4ade80',
      strokeWidth: 5,
      listening: false,
      lineCap: 'round',
      lineJoin: 'round',
    });
    const capA = new Konva.Circle({
      x: x1, y: y1, radius: 7, fill: '#4ade80', stroke: '#14532d', strokeWidth: 2, listening: false,
    });
    const capB = new Konva.Circle({
      x: x1, y: y1, radius: 7, fill: '#4ade80', stroke: '#14532d', strokeWidth: 2, listening: false,
    });
    tempWire._under = under;
    tempWire._capA = capA;
    tempWire._capB = capB;
    layerWires.add(under);
    layerWires.add(tempWire);
    layerWires.add(capA);
    layerWires.add(capB);
    if (stage) stage.draggable(false);
    let hoverPin = null;
    const move = () => {
      const p = pointerToWorld();
      if (!p || !tempWire) return;
      const n = state.nodes.find((nd) => nd.id === fromId);
      const ox = n ? n.x : x1;
      const oy = n ? n.y : y1;
      const snap = nearestNode(p, fromId, 22);
      const tx = snap ? snap.x : p.x;
      const ty = snap ? snap.y : p.y;
      const pts = routePoints(ox, oy, tx, ty);
      tempWire.points(pts);
      if (tempWire._under) tempWire._under.points(pts);
      if (tempWire._capA) tempWire._capA.position({ x: ox, y: oy });
      if (tempWire._capB) tempWire._capB.position({ x: tx, y: ty });
      if (hoverPin && hoverPin !== (snap && pinCircleById(snap.id))) {
        hoverPin.setAttrs({ fill: '#f6ad55', radius: 4.5 });
        hoverPin = null;
      }
      if (snap) {
        const circ = pinCircleById(snap.id);
        if (circ) {
          circ.setAttrs({ fill: '#4ade80', radius: 7 });
          hoverPin = circ;
        }
      }
      layerWires.batchDraw();
      if (layerComponents) layerComponents.batchDraw();
    };
    stage.on('mousemove.tempwire touchmove.tempwire', move);
  }

  // Etiqueta legible de un extremo de cable: pin real o rol (VCC/GND).
  function wirePinLabel(node) {
    if (!node) return '?';
    return node.pinName || node.label || (node.role ? node.role.toUpperCase() : node.id);
  }

  // Centro geométrico real (promedio de todos los vértices) de la ruta.
  function wireMidpoint(fromNode, toNode) {
    const pts = routePoints(fromNode.x, fromNode.y, toNode.x, toNode.y);
    if (!pts || pts.length < 4) {
      return { x: (fromNode.x + toNode.x) / 2, y: (fromNode.y + toNode.y) / 2 };
    }
    let sx = 0, sy = 0;
    const n = pts.length / 2;
    for (let k = 0; k < pts.length; k += 2) { sx += pts[k]; sy += pts[k + 1]; }
    return { x: sx / n, y: sy / n };
  }

  // (Re)coloca el badge de un cable según la posición actual de sus nodos.
  function placeWireBadge(wireId, fromNode, toNode, slot) {
    const m = wireMidpoint(fromNode, toNode);
    const offset = (typeof slot === 'number' ? slot : 0) * 18;
    const label = wireBadges.get(wireId);
    if (label) label.position({ x: m.x, y: m.y + offset });
    const btn = wireDeleteBtns.get(wireId);
    if (btn) btn.position({ x: m.x + 52, y: m.y + offset - 14 });
  }

  function findWireLine(wireId) {
    return layerWires.find('.wire').find((s) => s.wireId === wireId) || null;
  }

  // Cable persistente: línea ortogonal (no Shape/Bézier recortada).
  function drawWire(wireId, fromId, toId, colorName) {
    const fromNode = state.nodes.find((n) => n.id === fromId);
    const toNode = state.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return null;

    const stroke = colorDeCable(colorName);
    const pts = routePoints(fromNode.x, fromNode.y, toNode.x, toNode.y);
    const under = new Konva.Line({
      name: 'wire-under',
      points: pts,
      stroke: '#020617',
      strokeWidth: 8,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    });
    const line = new Konva.Line({
      name: 'wire',
      points: pts,
      stroke,
      strokeWidth: 5,
      lineCap: 'round',
      lineJoin: 'round',
      hitStrokeWidth: 18,
      tension: 0,
    });
    const capA = new Konva.Circle({
      name: 'wire-cap',
      x: fromNode.x, y: fromNode.y, radius: 6,
      fill: stroke, stroke: '#020617', strokeWidth: 2, listening: false,
    });
    const capB = new Konva.Circle({
      name: 'wire-cap',
      x: toNode.x, y: toNode.y, radius: 6,
      fill: stroke, stroke: '#020617', strokeWidth: 2, listening: false,
    });
    line._under = under;
    line._capA = capA;
    line._capB = capB;
    layerWires.add(under);
    line.wireId = wireId;
    line._from = fromId;
    line._to = toId;
    line._color = colorName || 'gris';
    line.on('click tap', (evt) => {
      evt.cancelBubble = true;
      selectWire(wireId);
    });
    line.on('dblclick dbltap', (evt) => {
      evt.cancelBubble = true;
      removeWire(wireId);
    });
    line.on('contextmenu', (evt) => {
      evt.evt.preventDefault();
      evt.cancelBubble = true;
      selectWire(wireId);
      showContextMenu(evt.evt.clientX, evt.evt.clientY, [
        { label: 'Desconectar cable', action: () => removeWire(wireId) },
      ]);
    });
    layerWires.add(line);
    layerWires.add(capA);
    layerWires.add(capB);
    createWireBadge(wireId, fromNode, toNode);
    layerWires.batchDraw();
    if (layerUI) layerUI.batchDraw();
    return line;
  }

  // Punto de anclaje de la etiqueta: centro del cable, ligeramente elevado
  // para que el cuadradito sea legible sin tapar la línea.
  function wireBesidePoint(fromNode, toNode) {
    const m = wireMidpoint(fromNode, toNode);
    return { x: m.x, y: m.y - 14 };
  }

  // Crea (si no existe) la etiqueta "PinOrigen → PinDestino" junto al cable.
  function createWireBadge(wireId, fromNode, toNode) {
    const b = wireBesidePoint(fromNode, toNode);

    if (!wireBadges.has(wireId)) {
      const label = new Konva.Label({
        x: b.x, y: b.y,
        listening: false,
      });
      label.add(new Konva.Rect({
        fill: 'rgba(8,18,32,0.9)', cornerRadius: 4,
        stroke: '#334155', strokeWidth: 1,
        shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 4, shadowOffset: { x: 0, y: 1 },
      }));
      label.add(new Konva.Text({
        text: `${wirePinLabel(fromNode)} → ${wirePinLabel(toNode)}`,
        fontSize: 9.5, fontFamily: 'Segoe UI, Arial, sans-serif',
        fill: '#e2e8f0', padding: 4, align: 'center',
      }));
      wireBadges.set(wireId, label);
      (layerUI || layerWires).add(label);
    } else {
      const label = wireBadges.get(wireId);
      label.position({ x: b.x, y: b.y });
      const txt = label.findOne('Text');
      if (txt) txt.text(`${wirePinLabel(fromNode)} → ${wirePinLabel(toNode)}`);
    }
  }

  // Reposiciona cables y badges al arrastrar componentes.
  function refreshWireBadges() {
    state.connections.forEach((c, i) => {
      const fromNode = state.nodes.find((n) => n.id === c.from);
      const toNode = state.nodes.find((n) => n.id === c.to);
      if (!fromNode || !toNode) return;
      const line = findWireLine(c.id);
      if (line) {
        const pts = routePoints(fromNode.x, fromNode.y, toNode.x, toNode.y);
        line.points(pts);
        if (line._under) line._under.points(pts);
        if (line._capA) line._capA.position({ x: fromNode.x, y: fromNode.y });
        if (line._capB) line._capB.position({ x: toNode.x, y: toNode.y });
      }
      createWireBadge(c.id, fromNode, toNode);
    });
    if (tempWire && wireFrom) {
      const n = state.nodes.find((nd) => nd.id === wireFrom.nodeId);
      const p = pointerToWorld();
      if (n && p) tempWire.points(routePoints(n.x, n.y, p.x, p.y));
    }
  }

  function finishWire(fromId, toId, colorName) {
    stopTempPreview();
    if (wireFrom && wireFrom.circle) {
      wireFrom.circle.setAttrs({ fill: '#f6ad55', radius: 4.5 });
    }
    const fromNode = state.nodes.find((n) => n.id === fromId);
    const toNode = state.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return;

    const aid = uid();
    const color = colorName || 'gris';
    state.connections.push({ id: aid, from: fromId, to: toId, color });
    drawWire(aid, fromId, toId, color);
    emitChanged();
  }

  function removeWire(wireId) {
    state.connections = state.connections.filter((c) => c.id !== wireId);
    layerWires.find('.wire').forEach((s) => {
      if (s.wireId === wireId) {
        if (s._under) s._under.destroy();
        if (s._capA) s._capA.destroy();
        if (s._capB) s._capB.destroy();
        s.destroy();
      }
    });
    const badge = wireBadges.get(wireId);
    if (badge) { badge.destroy(); wireBadges.delete(wireId); }
    const btn = wireDeleteBtns.get(wireId);
    if (btn) { btn.destroy(); wireDeleteBtns.delete(wireId); }
    if (selectedWireId === wireId) selectedWireId = null;
    layerWires.batchDraw();
    if (layerUI) layerUI.batchDraw();
    emitChanged();
  }

  function cancelWire() {
    stopTempPreview();
    if (wireFrom && wireFrom.circle) {
      wireFrom.circle.setAttrs({ fill: '#f6ad55', radius: 4.5 });
    }
    wireFrom = null;
    if (layerWires) layerWires.batchDraw();
  }

  // ---------- Evento de cambio ----------
  function emitChanged() {
    const evt = new CustomEvent('stage:changed', { detail: { state } });
    window.dispatchEvent(evt);
  }

  // ---------- Acceso al estado (para el serializador) ----------
  function getState() { return state; }
  function getWireShape(wireId) {
    return findWireLine(wireId);
  }

  // ---------- Zoom (rueda) ----------
  function attachZoom() {
    stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(2.5, Math.max(0.4, oldScale + direction * 0.05));
      stage.scaleX(newScale);
      stage.scaleY(newScale);
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      stage.position(newPos);
      drawGrid();
      applyTransformToHost();
      layerComponents.batchDraw();
      layerWires.batchDraw();
    });
  }

  // ---------- Grid ----------
  // Cuadrícula "infinita" (full-bleed): el fondo y las líneas cubren SIEMPRE
  // el 100% del contenedor, y las líneas se anclan al mundo (múltiplos de
  // GRID en coordenadas de stage), teniendo en cuenta el desplazamiento
  // (stage.position()) y la escala (stage.scaleX()) del pan/zoom. Así el
  // grid nunca deja huecos negros y acompaña el lienzo al hacer pan/zoom.
  function drawGrid() {
    if (!stage || !layerGrid) return;
    syncStageSize();
    layerGrid.destroyChildren();
    layerGrid.batchDraw();
  }

  // Dibuja el grid (fondo) cubriendo el area máxima entre el stage visible y
  // el bounding box de los componentes. Se usa antes de exportar para que la
  // captura no deje zonas en blanco cuando hay componentes desplazados por pan.
  function componentBounds() {
    let minX = 0, minY = 0, maxX = stage.width(), maxY = stage.height();
    state.nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    });
    const pad = 120;
    return { w: Math.ceil(maxX + pad), h: Math.ceil(maxY + pad), minX, minY };
  }

  function drawGridForExport() {
    layerGrid.destroyChildren();
    const scale = stage.scaleX();
    const pos = stage.position();
    const step = GRID * scale;
    const b = componentBounds();
    // El rect de fondo y las líneas se extienden para cubrir el bbox completo.
    layerGrid.add(
      new Konva.Rect({ x: b.minX, y: b.minY, width: b.w - b.minX, height: b.h - b.minY, fill: '#0f172a' })
    );
    if (step >= 6) {
      const startX = b.minX - ((b.minX % step) + step) % step;
      const startY = b.minY - ((b.minY % step) + step) % step;
      for (let x = startX; x <= b.w; x += step) {
        layerGrid.add(new Konva.Line({ points: [x, b.minY, x, b.h], stroke: '#1e293b', strokeWidth: 1 }));
      }
      for (let y = startY; y <= b.h; y += step) {
        layerGrid.add(new Konva.Line({ points: [b.minX, y, b.w, y], stroke: '#1e293b', strokeWidth: 1 }));
      }
    }
    layerGrid.batchDraw();
  }

  // Snapshot PNG del lienzo al flujo. Recalcula el fondo/grid al bounding box
  // de los componentes y exporta a alta resolución (pixelRatio 2) cubriendo
  // todo el area del stage. Restaura el grid normal tras capturar.
  function exportSnapshot() {
    const before = () => { try { drawGrid(); } catch (e) {} };
    try {
      drawGridForExport();
      layerWires.batchDraw();
      layerComponents.batchDraw();
      const url = stage.toDataURL({
        pixelRatio: 2,
        width: stage.width(),
        height: stage.height(),
        x: 0,
        y: 0,
      });
      before();
      return url;
    } catch (e) {
      before();
      console.error('[sugoi] Error al capturar el lienzo:', e);
      return '';
    }
  }

  // ---------- Pan (arrastre de fondo) ----------
  function attachPan() {
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let panMoved = false;

    const isInteractiveTarget = (n) => {
      let cur = n;
      while (cur) {
        if (cur.name && typeof cur.name === 'function' && (cur.name() === 'terminal' || cur.name() === 'drag-handle' || cur.name() === 'drag-body' || cur.name() === 'del-comp' || cur.name() === 'wire-del')) return true;
        if (cur.draggable && cur.draggable()) return true;
        cur = cur.getParent ? cur.getParent() : null;
      }
      return false;
    };

    stage.on('pointerdown', (e) => {
      if (isInteractiveTarget(e.target)) return;
      if (e.target === stage) {
        isPanning = true;
        panMoved = false;
        panStart = { x: stage.x(), y: stage.y(), px: e.evt.clientX, py: e.evt.clientY };
        if (stage.container()) stage.container().style.cursor = 'grabbing';
      }
    });
    stage.on('pointermove', (e) => {
      if (!isPanning) return;
      const dx = e.evt.clientX - panStart.px;
      const dy = e.evt.clientY - panStart.py;
      if (!panMoved && Math.hypot(dx, dy) > 4) panMoved = true;
      if (panMoved) {
        stage.position({ x: panStart.x + dx, y: panStart.y + dy });
        drawGrid();
        layerWires.batchDraw();
        layerComponents.batchDraw();
        if (layerUI) layerUI.batchDraw();
        applyTransformToHost();
      }
    });
    stage.on('pointerup', () => {
      if (stage.container()) stage.container().style.cursor = 'default';
      isPanning = false;
    });
    stage.on('pointerleave', () => {
      if (stage.container()) stage.container().style.cursor = 'default';
      isPanning = false;
    });
    stage.on('click tap', () => { if (isPanning) isPanning = false; });
  }

  function measureContainer() {
    const ws = document.getElementById('workspace');
    if (!ws) {
      return { w: Math.max(800, window.innerWidth - 510), h: Math.max(560, window.innerHeight - 130) };
    }
    const r = ws.getBoundingClientRect();
    return {
      w: Math.max(1, Math.floor(r.width || ws.clientWidth)),
      h: Math.max(1, Math.floor(r.height || ws.clientHeight)),
    };
  }

  function syncStageSize() {
    const { w, h } = measureContainer();
    if (!stage || w < 40 || h < 40) return { w, h };
    if (stage.width() !== w) stage.width(w);
    if (stage.height() !== h) stage.height(h);
    if (containerRef) {
      containerRef.style.inset = '0';
      containerRef.style.width = '100%';
      containerRef.style.height = '100%';
    }
    const overlay = document.getElementById('wokwi-overlay');
    if (overlay) {
      overlay.style.inset = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
    }
    return { w, h };
  }

  // ---------- API pública del motor ----------
  function init(containerId, overlayId) {
    const container = document.getElementById(containerId);
    containerRef = container;
    // Tamaño full-bleed leído directamente del contenedor (offset incluye bordes).
    const first = measureContainer(container);
    stage = new Konva.Stage({ container: containerId, width: first.w, height: first.h });
    stage.draggable(false);

    layerGrid = new Konva.Layer({ listening: false });
    layerWires = new Konva.Layer();
    layerComponents = new Konva.Layer();
    layerUI = new Konva.Layer();
    stage.add(layerGrid);
    // Cables debajo de pines; botones X y etiquetas van en layerUI (arriba).
    stage.add(layerWires);
    stage.add(layerComponents);
    stage.add(layerUI);

    // Overlay HTML para wokwi-elements
    componentLayerHost = document.getElementById(overlayId);
    if (componentLayerHost) {
      componentLayerHost.style.pointerEvents = 'none';
    }

    drawGrid();
    attachZoom();
    attachPan();

    // Mantener el stage y la cuadrícula al 100% del contenedor cuando cambia
    // el tamaño de la ventana.
    const resizeStage = () => {
      if (!containerRef || !stage) return;
      syncStageSize();
      drawGrid();
      layerWires.batchDraw();
      layerComponents.batchDraw();
      if (layerUI) layerUI.batchDraw();
      applyTransformToHost();
    };
    window.addEventListener('resize', resizeStage);
    const ro = new ResizeObserver(resizeStage);
    const ws = document.getElementById('workspace');
    if (ws) ro.observe(ws);
    else ro.observe(container);
    requestAnimationFrame(resizeStage);
    setTimeout(resizeStage, 80);
    setTimeout(resizeStage, 300);
    setTimeout(resizeStage, 800);

    stage.on('click tap', (e) => {
      if (e.target === stage) {
        if (wireFrom) cancelWire();
        else clearSelection();
      }
    });
    stage.on('contextmenu', (e) => {
      e.evt.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      }
      if (e.key === 'Escape') {
        cancelWire();
        clearSelection();
        hideContextMenu();
      }
    });
    document.addEventListener('click', (ev) => {
      const menu = document.getElementById('sim2d-ctx-menu');
      if (menu && !menu.contains(ev.target)) hideContextMenu();
    });

    drawGrid();
    applyTransformToHost();
  }

  function fromPalette(defKey, x, y) {
    return addComponent(defKey, x, y);
  }

  // ---------- Control de LEDs por simulación (HIGHLOW) ----------
  // Encendemos el LED de dos formas complementarias:
  //   1) Un overlay Konva (glow) determinista, garantizado visible.
  //   2) Best-effort: property 'ledlight' del wokwi-element si existe.
  const ledGlows = new Map(); // compId -> { glow: Konva.Circle }

  const LED_GLOW = { red: '#f87171', green: '#4ade80', blue: '#60a5fa' };

  function ensureLedGlow(comp, color) {
    if (!ledGlows.has(comp.id)) {
      const glow = new Konva.Circle({
        listening: false,
        visible: false,
        radius: 12,
        fill: color,
        opacity: 0.9,
        filters: [Konva.Filters.Blur],
        blurRadius: 7,
      });
      ledGlows.set(comp.id, { glow });
      layerComponents.add(glow);
    }
    return ledGlows.get(comp.id).glow;
  }

  function setLedOn(comp, on, color) {
    const glow = ensureLedGlow(comp, color || LED_GLOW.red);
    // Posicionar glow sobre el centro del componente (usar el primer terminal)
    const firstTerm = comp.terminals && comp.terminals[0];
    if (firstTerm) {
      const node = state.nodes.find((n) => n.id === firstTerm.id);
      if (node) {
        glow.position({ x: node.x, y: node.y });
      }
    }
    glow.visible(on);
    layerComponents.batchDraw();
    // Best-effort sobre el wokwi-element
    if (comp.host && typeof comp.host.setProperty === 'function') {
      try { comp.host.setProperty('ledlight', on ? 1 : 0); } catch (e) {}
    }
  }

  function setComponentLightThroughNet(pinout, pinKey, high) {
    const p = pinout.pinout && pinout.pinout[pinKey];
    if (!p || !p.netId) return;
    const net = pinout.netlist.find((n) => n.id === p.netId);
    if (!net) return;
    for (const nid of net.nodes) {
      const node = state.nodes.find((n) => n.id === nid);
      if (!node) continue;
      const color = node.compType && node.compType.startsWith('led_') ? LED_GLOW[node.compType.slice(4)] : null;
      if (!color) continue;
      const comp = state.components.find((c) => c.id === node.compId);
      if (comp) setLedOn(comp, high, color);
    }
  }

  function resetLeds() {
    state.components.forEach((c) => {
      if (c.type && c.type.startsWith('led_')) {
        setLedOn(c, false, null);
      }
    });
    ledGlows.forEach(({ glow }) => glow.visible(false));
    layerComponents.batchDraw();
  }

  // ---------- Flujo de señal (animación "energizado") ----------
  // Visualización tipo "señal fluyendo por los cables": las conexiones se
  // dibujan con trazos animados (VCC en ámbar, GND en verde, resto en azul),
  // dando sensación de circuito energizado sin simular lógica real.
  function flowStrokeColor(fromNode, toNode) {
    const isPower = (n) => n && (n.role === 'vcc' || /^(5v|vcc|vin|3v3)$/i.test(wirePinLabel(n)));
    const isGnd = (n) => n && (n.role === 'gnd' || /gnd/i.test(wirePinLabel(n)));
    if (isGnd(fromNode) || isGnd(toNode)) return '#34d399';
    if (isPower(fromNode) || isPower(toNode)) return '#fbbf24';
    return '#60a5fa';
  }

  function startFlowAnimation() {
    stopFlowAnimation();
    const wires = state.connections
      .map((c) => {
        const shape = getWireShape(c.id);
        if (!shape) return null;
        const f = state.nodes.find((n) => n.id === c.from);
        const t = state.nodes.find((n) => n.id === c.to);
        if (!f || !t) return null;
        shape.stroke(flowStrokeColor(f, t));
        shape.dash([10, 8]);
        return shape;
      })
      .filter(Boolean);
    if (wires.length === 0) return;

    flowAnimation = new Konva.Animation((frame) => {
      const offset = ((frame.time || 0) / 30) % 18;
      wires.forEach((w) => w.dashOffset(-offset));
    }, layerWires);
    flowAnimation.start();
    layerWires.batchDraw();
  }

  function stopFlowAnimation() {
    if (flowAnimation) {
      flowAnimation.stop();
      flowAnimation = null;
    }
    layerWires.find('.wire').forEach((s) => {
      s.dash([]);
      s.dashOffset(0);
      s.stroke(colorDeCable(s._color || 'gris'));
    });
    layerWires.batchDraw();
  }

  // ---------- Limpieza total del lienzo ----------
  function clear() {
    stopFlowAnimation();
    cancelWire();
    state.nodes.length = 0;
    state.connections.length = 0;
    state.components.length = 0;
    if (componentLayerHost) componentLayerHost.innerHTML = '';
    ledGlows.forEach(({ glow }) => glow.destroy());
    ledGlows.clear();
    wireBadges.forEach((b) => b.destroy());
    wireBadges.clear();
    wireDeleteBtns.forEach((b) => b.destroy());
    wireDeleteBtns.clear();
    selectedCompId = null;
    selectedWireId = null;
    hideContextMenu();
    layerWires.destroyChildren();
    layerComponents.destroyChildren();
    if (layerUI) layerUI.destroyChildren();
    idCounter = 1;
    drawGrid();
    layerComponents.batchDraw();
    layerWires.batchDraw();
    if (layerUI) layerUI.batchDraw();
    emitChanged();
  }

  // ---------- Reconstrucción full desde pinout JSON ----------
  // Recrea el lienzo a partir de un pinout guardado en BD, respetando
  // las coordenadas exactas (x, y) de cada nodo, montando los
  // <wokwi-elements> en el overlay y redibujando las Bézier del netlist.
  function restore(pinout) {
    clear();
    if (!pinout || !pinout.components || !pinout.nodes) return;

    // ---- Purgado destructivo de bloques fantasma en diseños guardados ----
    // Elimina componentes que el antiguo flujo de wokwi pudo persistir como
    // "wokwi-cables" / "Cables de conexión Jumper" (no son componentes reales).
    // Se ejecuta ANTES de instanciar el estado para no sembrar esos nodos en el lienzo.
    if (Array.isArray(pinout.components)) {
      pinout.components = pinout.components.filter((c) => {
        if (!c) return false;
        const n = `${c.tag || ''} ${c.name || ''} ${c.label || ''} ${c.type || ''}`.toLowerCase();
        if (c.tag === 'wokwi-cables' || c.type === 'wokwi-cables') return false;
        if (/cables de conexi[oó]n|jumper macho|tubo flexible/.test(n)) return false;
        return true;
      });
    }
    if (Array.isArray(pinout.nodes)) {
      pinout.nodes = pinout.nodes.filter(
        (n) => n && n.compType !== 'wokwi-cables'
      );
    }
    if (Array.isArray(pinout.connections)) {
      const validIds = new Set((pinout.nodes || []).map((n) => n.id));
      pinout.connections = pinout.connections.filter(
        (cx) => cx && validIds.has(cx.from) && validIds.has(cx.to)
      );
    }

    // 1) Reconstruir NODOS + componentes (Konva) + wokwi-elements
    const nodesByComp = new Map();
    (pinout.nodes || []).forEach((n) => {
      if (!nodesByComp.has(n.compId)) nodesByComp.set(n.compId, []);
      nodesByComp.get(n.compId).push(n);
    });

    (pinout.components || []).forEach((comp) => {
      const def = COMPONENT_DEFS[comp.type];
      if (!def) return;
      // Origen del componente desde su primer nodo conocido:
      // compX = nodoGuardado.x - desplazamiento.localDelTerminal
      const compNodes = nodesByComp.get(comp.id) || [];
      let ox = 0, oy = 0, known = false;
      for (const node of compNodes) {
        const td = def.terminals.find((t) => node.id === `${comp.id}_${t.id}`)
          || def.terminals.find((t) => t.id && String(node.id).endsWith('_' + t.id))
          || def.terminals.find((t) => t.index === node.index)
          || def.terminals[node.index];
        if (td) { ox = node.x - td.x; oy = node.y - td.y; known = true; break; }
      }
      if (!known) { ox = 0; oy = 0; }
      buildComponent(comp.type, comp.id, ox, oy, {
        imagen: comp.imagen,
        customLabel: comp.label && comp.label !== COMPONENT_DEFS[comp.type].label ? comp.label : null,
      });
    });

    // 2) Reconstruir cables ortogonales según el netlist guardado
    (pinout.connections || []).forEach((c) => {
      state.connections.push({ id: c.id, from: c.from, to: c.to, color: c.color || 'gris' });
      drawWire(c.id, c.from, c.to, c.color);
    });

    drawGrid();
    applyTransformToHost();
    layerComponents.batchDraw();
    layerWires.batchDraw();
    if (layerUI) layerUI.batchDraw();
    fitView();
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        syncStageSize();
        drawGrid();
        applyTransformToHost();
      });
    }
    emitChanged();
  }

  function fitView() {
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    drawGrid();
    applyTransformToHost();
    layerComponents.batchDraw();
    layerWires.batchDraw();
    if (layerUI) layerUI.batchDraw();
  }

  function toWorld(evt) {
    const p = stage.getPointerPosition();
    const start = stage.getAbsolutePosition();
    const scale = stage.scaleX();
    return { x: (p.x - start.x) / scale, y: (p.y - start.y) / scale };
  }

  // Convierte coordenadas de pantalla (de un evento HTML drop) a
  // coordenadas "world" del lienzo, teniendo en cuenta pan + zoom.
  function dropAt(clientX, clientY) {
    const rect = stage.container().getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    try {
      const t = stage.getAbsoluteTransform().copy().invert();
      return t.point({ x: px, y: py });
    } catch (e) {
      return { x: px, y: py };
    }
  }

  window.SUGOI = window.SUGOI || {};
  // Reemplaza los cables del lienzo por una lista de {from,to,color}
  // (node ids), conservando componentes y nodos. Lo usa la IA para
  // aplicar conexiones corregidas/validadas.
  function rebuildConnections(connections) {
    try { stopFlowAnimation(); } catch (e) {}
    cancelWire();
    state.connections.length = 0;
    layerWires.destroyChildren();
    wireBadges.forEach((b) => b.destroy());
    wireBadges.clear();
    wireDeleteBtns.forEach((b) => b.destroy());
    wireDeleteBtns.clear();
    selectedWireId = null;
    (Array.isArray(connections) ? connections : []).forEach((c) => {
      const fromId = c && c.from;
      const toId = c && c.to;
      const color = (c && c.color) || 'gris';
      if (!fromId || !toId) return;
      const fromNode = state.nodes.find((n) => n.id === fromId);
      const toNode = state.nodes.find((n) => n.id === toId);
      if (!fromNode || !toNode) return;
      const aid = uid();
      state.connections.push({ id: aid, from: fromId, to: toId, color });
      drawWire(aid, fromId, toId, color);
    });
    layerWires.batchDraw();
    if (layerUI) layerUI.batchDraw();
    emitChanged();
  }

  window.SUGOI.engine = {
    init,
    fromPalette,
    getState,
    clear,
    restore,
    rebuildConnections,
    setComponentLightThroughNet,
    resetLeds,
    startFlowAnimation,
    stopFlowAnimation,
    refreshWireBadges,
    exportSnapshot,
    toWorld,
    dropAt,
    fitView,
    resize: () => {
      if (!containerRef || !stage) return;
      syncStageSize();
      drawGrid();
      layerWires.batchDraw();
      layerComponents.batchDraw();
      if (layerUI) layerUI.batchDraw();
      applyTransformToHost();
    },
    removeComponent,
    removeWire,
    disconnectPin,
    disconnectComponent,
    deleteSelection,
    selectComponent,
    selectWire,
    getSelection: () => ({ compId: selectedCompId, wireId: selectedWireId }),
    componentsDefs: COMPONENT_DEFS,
    get stage() { return stage; },
    get layerComponents() { return layerComponents; },
    setWireColorAll: (hex) => {
      layerWires.find('.wire').forEach((s) => { s.stroke(hex); });
      layerWires.batchDraw();
    },
  };
})();
