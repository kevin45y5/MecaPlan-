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
  const GRID = CONFIG.GRID_SIZE || 20;

  // ---------- Estado del modelo ----------
  const state = { nodes: [], connections: [], components: [] };
  let idCounter = 1;
  const uid = () => `n${idCounter++}`;

  // ---------- Referencias Konva ----------
  let stage, layerWires, layerGrid, layerComponents;
  let componentLayerHost = null; // div HTML overlay

  // ---------- Estado de cableado ----------
  let wireFrom = null; // { nodeId }
  let tempWire = null; // Konva.Line de preview
  let draggingComponent = null;

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
    for (let i = 0; i < total; i++) {
      const label = opts && opts.labels && opts.labels[i] ? opts.labels[i] : String(i);
      arr.push({
        id: 'p' + i,
        index: i,
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
    for (let i = 0; i < total; i++) {
      const label = opts && opts.labels && opts.labels[i] ? opts.labels[i] : String(i);
      arr.push({
        id: 'p' + i,
        index: i,
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
      w: 220, h: 160,
      terminals: [
        { id: 'd13', index: 0,  x: 212, y: 38,  pinName: 'D13', avrPort: 0x25, bit: 5 },
        { id: 'd12', index: 1,  x: 212, y: 62,  pinName: 'D12', avrPort: 0x25, bit: 4 },
        { id: 'd11', index: 2,  x: 212, y: 86,  pinName: 'D11', avrPort: 0x25, bit: 3 },
        { id: 'd10', index: 3,  x: 212, y: 110, pinName: 'D10', avrPort: 0x25, bit: 2 },
        { id: 'a0', index: 4,  x: 8,   y: 120, pinName: 'A0',  avrPort: 0x29, bit: 0 },
        { id: 'a1', index: 5,  x: 8,   y: 96,  pinName: 'A1',  avrPort: 0x29, bit: 1 },
        { id: 'gnd', index: 6,  x: 8,   y: 40,  pinName: null, role: 'gnd' },
        { id: '5v',  index: 7,  x: 8,   y: 64,  pinName: null, role: 'vcc' },
      ],
    },
    arduino_nano: {
      label: 'Arduino Nano',
      tag: 'wokwi-arduino-nano',
      w: 160, h: 120,
      terminals: [
        { id: 'a0',  index: 0, x: 148, y: 22, pinName: 'A0',  avrPort: 0x29, bit: 0 },
        { id: 'a1',  index: 1, x: 148, y: 44, pinName: 'A1',  avrPort: 0x29, bit: 1 },
        { id: 'd13', index: 2, x: 12,  y: 28, pinName: 'D13', avrPort: 0x25, bit: 5 },
        { id: 'd12', index: 3, x: 12,  y: 50, pinName: 'D12', avrPort: 0x25, bit: 4 },
        { id: 'd11', index: 4, x: 12,  y: 72, pinName: 'D11', avrPort: 0x25, bit: 3 },
        { id: 'd10', index: 5, x: 12,  y: 94, pinName: 'D10', avrPort: 0x25, bit: 2 },
        { id: '5v',  index: 6, x: 148, y: 88, pinName: null, role: 'vcc' },
        { id: 'gnd', index: 7, x: 148, y: 108, pinName: null, role: 'gnd' },
      ],
    },
    arduino_mega: {
      label: 'Arduino Mega 2560',
      tag: 'wokwi-arduino-mega',
      w: 240, h: 180,
      terminals: mkCol(8, 8, { step: 21, labels: ['D22','D23','D24','D25','D26','D27','D28','5V'] })
        .concat(mkCol(8, 232, { step: 21, labels: ['D13','D12','D11','D10','D9','D8','GND','A0'] })),
    },
    esp32_devkit: {
      label: 'ESP32 DevKit',
      tag: 'wokwi-esp32-devkit-v1',
      w: 220, h: 150,
      terminals: mkCol(15, 8, { step: 12, labels: ['3V3','GND','GPIO15','GPIO2','GPIO4','GPIO16','GPIO17','GPIO5','GPIO18','GPIO19','GPIO21','RX','TX','GND','5V'] })
        .concat(mkCol(15, 212, { step: 12, labels: ['GPIO22','GPIO23','GPIO25','GPIO26','GPIO27','GPIO14','GPIO12','GPIO13','GPIO9','GPIO10','GPIO11','GPIO6','GPIO7','GPIO8','EN'] })),
    },
    attiny85: {
      label: 'ATtiny85',
      tag: 'wokwi-attiny85',
      w: 90, h: 80,
      terminals: mkCol(4, 6, { step: 18, labels: ['PB5','PB3','PB4','GND'] })
        .concat(mkCol(4, 84, { step: 18, labels: ['VCC','PB2','PB1','PB0'] })),
    },
    rp2040: {
      label: 'RP2040 (Pico)',
      tag: 'wokwi-nano-rp2040-connect',
      w: 180, h: 110,
      terminals: mkRow(6, 8, { step: 26, labels: ['GP0','GP1','GP2','GP3','GND','3V3'] })
        .concat(mkRow(6, 60, { step: 26, labels: ['GP4','GP5','GP6','GP7','GP8','GP9'] })),
    },

    protoboard: {
      label: 'Protoboard',
      tag: 'wokwi-breadboard',
      w: 300, h: 200,
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
      terminals: mkCol(3, 10, { step: 22, labels: ['VCC','DIN','GND'], roles: ['vcc','signal','gnd'] })
        .concat(mkCol(3, 70, { step: 22, labels: ['DOUT','',''], roles: ['signal','t','t'] })),
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
      terminals: mkCol(8, 10, { step: 12, labels: ['1','2','3','4','5','6','7','8'] })
        .concat(mkCol(8, 70, { step: 12, labels: ['1','2','3','4','5','6','7','8'] })),
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
      w: 70, h: 80,
      terminals: [
        { id: 'sig', index: 0, x: 14, y: 74, role: 'signal', pinName: 'SIG' },
        { id: 'vcc', index: 1, x: 35, y: 74, role: 'vcc', pinName: 'VCC' },
        { id: 'gnd', index: 2, x: 56, y: 74, role: 'gnd', pinName: 'GND' },
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
      w: 80, h: 60,
      terminals: mkRow(4, 12, { step: 18, labels: ['IN','GND','NO','NC'], roles: ['t','gnd','no','nc'] })
        .concat(mkRow(2, 48, { step: 60, labels: ['COM+','COM-'], roles: ['t','t'] })),
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
      w: 90, h: 60,
      terminals: [
        { id: 'vcc', index: 0, x: 10, y: 52, role: 'vcc', pinName: 'VCC' },
        { id: 'trig', index: 1, x: 30, y: 52, role: 'signal', pinName: 'TRIG' },
        { id: 'echo', index: 2, x: 50, y: 52, role: 'signal', pinName: 'ECHO' },
        { id: 'gnd', index: 3, x: 70, y: 52, role: 'gnd', pinName: 'GND' },
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
      terminals: mkCol(8, 8, { step: 12, labels: ['VSS','VDD','V0','RS','RW','E','D4','D5'] })
        .concat(mkCol(4, 168, { step: 12, labels: ['D6','D7','LED+','LED-'], roles: ['signal','signal','vcc','gnd'] })),
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
      terminals: mkCol(4, 8, { step: 16, labels: ['X1','X2','GND','VBAT'] })
        .concat(mkCol(4, 62, { step: 16, labels: ['SDA','SCL','SQW','VCC'], roles: ['signal','signal','signal','vcc'] })),
    },
  };


  // Protoboard: genera una retícula de terminales tipo panal (5 filas x 30 cols,
  // unidas en tiras). Simplificamos a puntos de conexión individuales.
  function makeBreadboardTerminals() {
    const t = [];
    const rows = 10;
    const cols = 30;
    const spacingX = 10, spacingY = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        t.push({
          id: `bb_${r}_${c}`,
          index: r * cols + c,
          x: 10 + c * spacingX,
          y: 20 + r * spacingY,
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
  function buildComponent(defKey, compId, x, y) {
    const def = COMPONENT_DEFS[defKey];
    if (!def) return null;

    // Contenedor geométrico Konva (hitbox + posición/drag)
    const group = new Konva.Group({ x, y, width: def.w, height: def.h, draggable: true });
    const hitRect = new Konva.Rect({
      width: def.w, height: def.h, fill: 'rgba(0,0,0,0.01)',
    });
    group.add(hitRect);

    // Marco visible
    group.add(
      new Konva.Rect({
        width: def.w, height: def.h,
        stroke: '#2b6cb0', strokeWidth: 1.2, dash: [4, 3],
        cornerRadius: 4,
      })
    );
    // Etiqueta
    group.add(
      new Konva.Text({
        x: 4, y: -16, text: def.label, fontSize: 11,
        fill: '#e2e8f0', fontStyle: 'bold',
      })
    );

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
        x: td.x, y: td.y, radius: 5,
        fill: '#f6ad55', stroke: '#1a202c', strokeWidth: 1,
        hoverStrokeWidth: 2,
      });
      circle.nodeId = nodeId;
      circle.on('click', (evt) => onTerminalClick(nodeId, circle, evt));
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
    // también actualiza las etiquetas de conexiones
    group.on('dragmove', () => {
      const gx = group.x(), gy = group.y();
      def.terminals.forEach((td, i) => {
        const node = state.nodes.find((n) => n.id === `${compId}_${td.id}`);
        if (node) { node.x = gx + td.x; node.y = gy + td.y; }
        const circle = terminalNodes[i];
        if (circle) { circle.x(td.x); circle.y(td.y); }
      });
      // Actualizar posición de etiquetas de conexiones
      updateConnectionLabels(compId, gx, gy);
      synchComponentHost(def, compId, gx, gy);
      emitChanged();
    });

    layerComponents.add(group);
    layerComponents.batchDraw();

    // Crear el wokwi-element HTML y colocarlo en el overlay
    const host = createWokwiElement(def, compId, x, y, group);
    state.components.push({
      id: compId,
      type: defKey,
      label: def.label,
      terminals: def.terminals.map((td) => ({ id: `${compId}_${td.id}` })),
      host, group,
    });

    return { compId, group, host };
  }

  // Crea y posiciona el <wokwi-*> en el div overlay.
  function createWokwiElement(def, compId, x, y, group) {
    if (!componentLayerHost) return null;
    let el;
    const tagDefined = def.tag && typeof customElements !== 'undefined' && customElements.get(def.tag);
    if (tagDefined) {
      el = document.createElement(def.tag);
      if (def.color) el.setAttribute('color', def.color);
      el.setAttribute('style', 'position:absolute;left:0;top:0;pointer-events:none;');
    } else {
      // Placeholder si no hay wokwi element (p.ej. VCC fijo) o si el tag
      // no está registrado en la librería. Las terminales siguen siendo
      // funcionales aunque la forma visual sea una caja etiquetada.
      el = document.createElement('div');
      el.setAttribute('style', 'position:absolute;left:0;top:0;width:'+def.w+'px;height:'+def.h+'px;pointer-events:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:11px;');
      el.textContent = def.label;
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

  // ---------- Cableado (Bézier) ----------
  function onTerminalClick(nodeId, circle, evt) {
    evt.cancelBubble = true;
    if (wireFrom === null) {
      wireFrom = { nodeId, circle };
      circle.setAttrs({ fill: '#68d391', radius: 6 });
      startTempWire(nodeId, circle.absolutePosition());
      layerWires.batchDraw();
    } else {
      if (wireFrom.nodeId === nodeId) {
        cancelWire();
        return;
      }
      finishWire(wireFrom.nodeId, nodeId);
      wireFrom = null;
    }
  }

  function startTempWire(fromId, fromPos) {
    // Creamos un cable "fantasma" que sigue al mouse.
    tempWire = new Konva.Line({
      points: [fromPos.x, fromPos.y, fromPos.x, fromPos.y],
      stroke: '#68d391', strokeWidth: 2.5, dash: [6, 4],
    });
    layerWires.add(tempWire);

    const move = (evt) => {
      const p = stage.getPointerPosition();
      if (!p || !tempWire) return;
      const start = stage.getAbsolutePosition();
      const scale = stage.scaleX();
      // Convertir puntero (screen) a coords de stage
      const sx = (p.x - start.x) / scale;
      const sy = (p.y - start.y) / scale;
      // Control point ortogonal (doble codo)
      const midY = (fromPos.y + sy) / 2;
      tempWire.points([
        fromPos.x, fromPos.y,
        fromPos.x, midY,
        sx, midY,
        sx, sy,
      ]);
      layerWires.batchDraw();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (tempWire) { tempWire.destroy(); tempWire = null; }
      layerWires.batchDraw();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  // Crea la curva de Bézier para una conexión ya persistida. Reutilizada
  // por finishWire (nueva conexión) y por restore (reconstrucción).
  function drawWire(wireId, fromId, toId) {
    const fromNode = state.nodes.find((n) => n.id === fromId);
    const toNode = state.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return null;

    const line = new Konva.Shape({
      stroke: '#63b3ed', strokeWidth: 2.5,
      sceneFunc(ctx, shape) {
        const x1 = fromNode.x, y1 = fromNode.y;
        const x2 = toNode.x, y2 = toNode.y;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const c1x = x1, c1y = (y1 + y2) / 2;
        const c2x = x2, c2y = (y1 + y2) / 2;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
        ctx.fillStrokeShape(shape);
      },
      hitStrokeWidth: 8,
    });
    line.wireId = wireId;
    line._from = fromId;
    line._to = toId;
    
    // Añadir etiqueta de pins en el centro del cable
    addPinLabel(wireId, fromNode, toNode);
    
    line.on('dblclick', () => removeWire(wireId));
    layerWires.add(line);
    layerWires.batchDraw();
    return line;
  }

  // Añade una etiqueta pequeña que muestra los pins del cable en su centro
  function addPinLabel(wireId, fromNode, toNode) {
    // Calcular punto medio geométrico
    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;

    // Crear etiqueta de texto Konva
    const label = new Konva.Text({
      x: midX,
      y: midY,
      text: `${fromNode.label || 'Sin nombre'} → ${toNode.label || 'Sin nombre'}`,
      fontSize: 10,
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center',
      padding: 2,
      cornerRadius: 4,
      listening: false,
    });

    layerWires.add(label);
    layerWires.batchDraw();
  }

  // Cable definitivo como curva de Bézier cuadrática.
  function finishWire(fromId, toId) {
    const fromNode = state.nodes.find((n) => n.id === fromId);
    const toNode = state.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return;

    const aid = uid();
    state.connections.push({ id: aid, from: fromId, to: toId });
    drawWire(aid, fromId, toId);
    // Añadir etiqueta de nombre de conexión en el medio
    addConnectionLabel(aid, fromId, toId);
    emitChanged();
  }

  // Añade una etiqueta de texto que muestra el nombre de la conexión
  // junto al cable. Se posiciona en el punto medio de la curva Bézier.
  function addConnectionLabel(wireId, fromId, toId) {
    const fromNode = state.nodes.find((n) => n.id === fromId);
    const toNode = state.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return;

    // Calcular punto medio de la línea
    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;

    // Crear etiqueta de texto Konva
    const label = new Konva.Text({
      x: midX,
      y: midY,
      text: `${fromNode.label} → ${toNode.label || 'Sin nombre'}`,
      fontSize: 10,
      fontFamily: 'Arial',
      fill: '#666666',
      align: 'center',
      listening: false, // No interactuar con el ratón
    });

    layerWires.add(label);
    layerWires.batchDraw();

    // Guardar referencia a la etiqueta en el objeto de conexión para poder actualizarla
    state.connectionLabels = state.connectionLabels || {};
    state.connectionLabels[wireId] = label;
  }

  // Actualiza la posición de las etiquetas de conexiones que involucran un componente al moverse
  function updateConnectionLabels(compId, gx, gy) {
    if (!state.connectionLabels) return;
    Object.keys(state.connectionLabels).forEach((wireId) => {
      const label = state.connectionLabels[wireId];
      const conn = state.connections.find((c) => c.id === wireId);
      if (!conn) { label.destroy(); delete state.connectionLabels[wireId]; return; }
      const fromNode = state.nodes.find((n) => n.id === conn.from);
      const toNode = state.nodes.find((n) => n.id === conn.to);
      if (!fromNode || !toNode) { label.destroy(); delete state.connectionLabels[wireId]; return; }
      // Calcular punto medio basado en posiciones actuales de los nodos
      label.position({ x: (fromNode.x + toNode.x) / 2, y: (fromNode.y + toNode.y) / 2 });
      layerWires.batchDraw();
    });
  }

  function removeWire(wireId) {
    state.connections = state.connections.filter((c) => c.id !== wireId);
    layerWires.find('Shape').forEach((s) => {
      if (s.wireId === wireId) s.destroy();
    });
    layerWires.batchDraw();
    emitChanged();
  }

  function cancelWire() {
    wireFrom.circle.setAttrs({ fill: '#f6ad55', radius: 5 });
    wireFrom = null;
    layerWires.batchDraw();
  }

  // ---------- Panning (arrastre para navegar) ----------
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  function attachPan() {
    stage.on('pointerdown', (e) => {
      // Verificar que el clic sea en el fondo (no sobre un componente ni terminal)
      const target = e.evt.target;
      const isOnComponent = target && target.nodeId !== undefined;
      const isOnTerminal = target && target.getAttrs && target.getAttrs('nodeId');

      if (!isOnComponent && !isOnTerminal) {
        isPanning = true;
        panStart = stage.position();
        stage.container().style.cursor = 'grabbing';
        layerWires.stopBatchDraw();
      }
    });

    stage.on('pointermove', (e) => {
      if (!isPanning) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const newPos = {
        x: panStart.x - pointer.x,
        y: panStart.y - pointer.y,
      };
      stage.position(newPos);
      drawGrid();
      layerWires.batchDraw();
      layerComponents.batchDraw();
    });

    stage.on('pointerup', () => {
      isPanning = false;
      stage.container().style.cursor = 'grab';
      layerWires.startBatchDraw();
    });

    stage.on('pointerleave', () => {
      isPanning = false;
      stage.container().style.cursor = 'grab';
      layerWires.startBatchDraw();
    });
  }

// ---------- Evento de cambio ----------
  function emitChanged() {
    const evt = new CustomEvent('stage:changed', { detail: { state } });
    window.dispatchEvent(evt);
  }

  // ---------- Acceso al estado (para el serializador) ----------
  function getState() { return state; }
  function getWireShape(wireId) {
    const found = layerWires.find('Shape').find((s) => s.wireId === wireId);
    return found || null;
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
  function drawGrid() {
    layerGrid.destroyChildren();
    const w = stage.width(), h = stage.height();
    const scale = stage.scaleX();
    const pos = stage.position();
    const step = GRID * scale;
    if (step < 6) return; // no dibujar si el grid es demasiado denso
    const startX = -(pos.x % step);
    const startY = -(pos.y % step);
    layerGrid.add(
      new Konva.Rect({ width: w, height: h, fill: '#0f172a' })
    );
    for (let x = startX; x < w; x += step) {
      layerGrid.add(new Konva.Line({ points: [x, 0, x, h], stroke: '#1e293b', strokeWidth: 1 }));
    }
    for (let y = startY; y < h; y += step) {
      layerGrid.add(new Konva.Line({ points: [0, y, w, y], stroke: '#1e293b', strokeWidth: 1 }));
    }
    layerGrid.batchDraw();
  }

  // ---------- API pública del motor ----------
  function init(containerId, overlayId) {
    const container = document.getElementById(containerId);
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    stage = new Konva.Stage({ container: containerId, width: w, height: h });
    // El fondo vacío del stage arrastra para PANNING (los componentes,
    // al ser arrastrables, impiden el drag del stage automáticamente).
    stage.draggable(true);

    layerGrid = new Konva.Layer({ listening: false });
    layerComponents = new Konva.Layer();
    layerWires = new Konva.Layer();
    stage.add(layerGrid);
    stage.add(layerComponents);
    stage.add(layerWires);

    // Overlay HTML para wokwi-elements
    componentLayerHost = document.getElementById(overlayId);
    if (componentLayerHost) {
      componentLayerHost.style.pointerEvents = 'none';
    }

    drawGrid();
    attachZoom();
    attachPan();

    // Redimensionar al cambiar tamaño de ventana
    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth, nh = container.clientHeight;
      stage.width(nw); stage.height(nh);
      drawGrid();
    });
    ro.observe(container);

    stage.on('click', () => {
      if (wireFrom) cancelWire();
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

  // ---------- Limpieza total del lienzo ----------
  function clear() {
    wireFrom = null;
    if (tempWire) { tempWire.destroy(); tempWire = null; }
    state.nodes.length = 0;
    state.connections.length = 0;
    state.components.length = 0;
    if (componentLayerHost) componentLayerHost.innerHTML = '';
    ledGlows.forEach(({ glow }) => glow.destroy());
    ledGlows.clear();
    layerWires.destroyChildren();
    layerComponents.destroyChildren();
    idCounter = 1;
    drawGrid();
    layerComponents.batchDraw();
    layerWires.batchDraw();
    emitChanged();
  }

  // ---------- Reconstrucción full desde pinout JSON ----------
  // Recrea el lienzo a partir de un pinout guardado en BD, respetando
  // las coordenadas exactas (x, y) de cada nodo, montando los
  // <wokwi-elements> en el overlay y redibujando las Bézier del netlist.
  function restore(pinout) {
    clear();
    if (!pinout || !pinout.components || !pinout.nodes) return;

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
        const td = def.terminals[node.index];
        if (td) { ox = node.x - td.x; oy = node.y - td.y; known = true; break; }
      }
      if (!known) { ox = 0; oy = 0; }
      buildComponent(comp.type, comp.id, ox, oy);
    });

    // 2) Reconstruir CABLES (Bézier) según el netlist guardado
    (pinout.connections || []).forEach((c) => {
      state.connections.push({ id: c.id, from: c.from, to: c.to });
      drawWire(c.id, c.from, c.to);
    });

    drawGrid();
    applyTransformToHost();
    layerComponents.batchDraw();
    layerWires.batchDraw();
    emitChanged();
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
  window.SUGOI.engine = {
    init,
    fromPalette,
    getState,
    clear,
    restore,
    setComponentLightThroughNet,
    resetLeds,
    toWorld,
    dropAt,
    get stage() { return stage; },
    get layerComponents() { return layerComponents; },
    setWireColorAll: (hex) => {
      layerWires.find('Shape').forEach((s) => { s.stroke(hex); });
      layerWires.batchDraw();
    },
  };
})();
