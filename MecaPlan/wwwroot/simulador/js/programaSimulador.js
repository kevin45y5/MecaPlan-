// ============================================================
// programaSimulador.js  (ADAPTADOR MecaPlan -> prototipo sugoi)
// Genera automáticamente el circuito 2D (componentes + cables) a
// partir de los datos reales del proyecto MecaPlan que el backend
// inyecta en window.SUGOI_PROYECTO:
//   - componentes (BOM del proyecto)
//   - conexiones  (ConexionesCanvas guardado en el Workspace ReactFlow)
//   - codigo      (CodigoGenerado por la IA)
// El adaptador costruye un `pinout` en el formato que espera
// engine().restore(pinout) y lo aplica al lienzo.
// ============================================================
(function () {
  'use strict';

  const PROY = window.SUGOI_PROYECTO || { proyecto: null, componentes: [], conexiones: [], codigo: '' };

  // ---------- Mapeo BOM (nombre de componente) -> compType del simulador ----------
  const MAPEO = [
    // Microcontroladores / placas
    { m: /arduino uno/i,          c: 'arduino_uno' },
    { m: /arduino nano/i,         c: 'arduino_nano' },
    { m: /arduino mega/i,         c: 'arduino_mega' },
    { m: /esp32/i,                c: 'esp32_devkit' },
    { m: /nodemcu/i,              c: 'esp32_devkit' },
    { m: /attiny85/i,             c: 'attiny85' },
    { m: /(nano.?rp2040|pico|rp2040)/i, c: 'rp2040' },
    { m: /protoboard|breadboard/i, c: 'protoboard' },
    // Fuentes
    { m: /fuente/i,               c: 'fuente_5v' },
    { m: /tierra|gnd/i,           c: 'gnd' },
    // Pasivos
    { m: /resistencia|resistor/i, c: 'resistor' },
    { m: /capacitor|condensador/i, c: 'capacitor' },
    { m: /diodo\s+emisor|emisor\s+de\s+luz/i, c: 'led_red' },
    { m: /diodo|1n4007|1n4148/i,  c: 'diode' },
    { m: /nivel|flotador|water.?level/i, c: 'sensor_humedad' },
    { m: /potenciometro|potenciómetro/i, c: 'potentiometer' },
    { m: /ldr|foto.?resistencia/i, c: 'photoresistor' },
    { m: /ntc/i,                  c: 'ntc_temp' },
    { m: /inclinaci/i,            c: 'tilt_switch' },
    // LEDs
    { m: /led\s+rgb|rgb\s+led/i,  c: 'led_rgb' },
    { m: /\bled\b/i,              c: 'led_red' },
    { m: /neopixel.*matri/i,      c: 'neopixel_matrix' },
    { m: /neopixel/i,             c: 'neopixel' },
    // Botones / interruptores
    { m: /pulsador|boton|botón/i, c: 'button' },
    { m: /interruptor|switch/i,   c: 'slide_switch' },
    { m: /dip.?switch/i,          c: 'dip_switch' },
    { m: /teclado.*4x4|keypad/i,  c: 'membrane_keypad' },
    { m: /joystick/i,             c: 'joystick' },
    // Actuadores
    { m: /buzzer|zumbador/i,      c: 'buzzer' },
    { m: /servo|mg996r|sg90/i,    c: 'servo' },
    { m: /motor\s+paso|stepper/i, c: 'stepper' },
    { m: /bomba/i,                c: 'bomba_agua' },
    { m: /rele|relay|relé/i,      c: 'relay' },
    { m: /motor\s+dc/i,           c: 'bomba_agua' },
    // Sensores
    { m: /dht22/i,                c: 'dht22' },
    { m: /humedad|suelo|moisture/i, c: 'sensor_humedad' },
    { m: /hc.?sr04|ultrasoni/i,   c: 'hc_sr04' },
    { m: /pir|movimiento/i,       c: 'pir' },
    { m: /llama|flame/i,          c: 'flame' },
    { m: /mq-?|gas/i,             c: 'gas' },
    { m: /sonido|microfono|micrófono|sound/i, c: 'sound' },
    { m: /mpu6050|imu/i,          c: 'mpu6050' },
    { m: /hx711|celda/i,          c: 'hx711' },
    { m: /receptor\s*ir|\bir\s*receiver|infrarojo/i, c: 'ir_receiver' },
    // Displays
    { m: /7.?seg|segmentos/i,     c: 'seg7' },
    { m: /lcd\s*16x2|1602/i,      c: 'lcd1602' },
    { m: /lcd\s*20x4|2004/i,      c: 'lcd2004' },
    { m: /oled|ssd1306/i,         c: 'oled' },
    { m: /tft|ili9341/i,          c: 'tft' },
    { m: /microsd|sd card/i,      c: 'microsd' },
    { m: /rtc|ds1307|ds3231/i,    c: 'rtc' },
  ];

  function esAccesorio(nombre) {
    const n = (nombre || '').toLowerCase();
    return /cable|jumper|tubo|silicona|manguera|cinta|tornillo|carcasa|caja pl|envoltorio|conectores?\s+jumper|liquido|l[ií]quido|recipiente|deposito|dep[oó]sito/.test(n)
      && !/sensor|arduino|servo|rele|relé|motor|fuente/.test(n);
  }

  function mapearTipo(nombre) {
    const n = (nombre || '').trim();
    if (!n || esAccesorio(n)) return null;
    for (const r of MAPEO) {
      if (r.m.test(n)) return r.c;
    }
    return null;
  }

  // ---------- Imagen de la guía de ensamblaje ----------
  // Replica la lógica de ObtenerUrlImagenPorNombre() del backend para que el
  // simulador 2D use EXACTAMENTE la misma librería de imágenes (SVG por
  // categoría) que la vista Guia.cshtml.
  function imagenComponente(nombre) {
    const n = (nombre || '').toLowerCase();
    if (/esp32|arduino|nodemcu|placa|microcontrolador/.test(n)) return '/images/componentes/microcontrolador.svg';
    if (/sensor|ultrasonico|rtc|ds3231|hc-sr04|buzzer/.test(n)) return '/images/componentes/sensor.svg';
    if (/servo|motor|mg996r|actuador|bomba|relay|rele|relé/.test(n)) return '/images/componentes/actuador.svg';
    if (/fuente|5v|vcc|aliment|power/.test(n)) return '/images/componentes/fuente.svg';
    if (/protoboard|breadboard/.test(n)) return null;
    if (/cable|jumper/.test(n)) return '/images/componentes/cable.svg';
    return '/images/componentes/placeholder-component.svg';
  }

  // ---------- Normalización de etiquetas/pines para emparejar endpoints ----------
  function normEtiqueta(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
      .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n').replace(/ü/g, 'u')
      .replace(/[\s_\-\.]+/g, '')
      .replace(/pin|p\$/g, '');
  }

  function normNombre(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
      .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n').replace(/ü/g, 'u')
      .replace(/[\s_\-\.]+/g, '');
  }

  // ---------- Autolayout determinista (rejilla, sin solapamientos) ----------
  // Cada componente se coloca en una bandeja según su tipo, para que el
  // circuito quede legible al cargar.
  function autolayout(componentes) {
    const defs = (window.SUGOI.engine && window.SUGOI.engine.componentsDefs) || {};
    const ws = document.getElementById('workspace');
    const availW = Math.max(800, (ws && ws.clientWidth) || window.innerWidth - 520);
    const availH = Math.max(560, (ws && ws.clientHeight) || window.innerHeight - 160);

    const esMcu = (c) => /arduino|esp32|attiny|rp2040/.test(c.type || '');
    const esBoard = (c) => c.type === 'protoboard';
    const esPower = (c) => /fuente_5v|vcc|gnd/.test(c.type || '');
    const mcus = componentes.filter(esMcu);
    const boards = componentes.filter(esBoard);
    const power = componentes.filter(esPower);
    const rest = componentes.filter((c) => !esMcu(c) && !esBoard(c) && !esPower(c))
      .sort((a, b) => String(a.nombre || a.type).localeCompare(String(b.nombre || b.type)));
    const ordenados = mcus.concat(boards).concat(power).concat(rest);

    const n = Math.max(1, ordenados.length);
    let COLS = n <= 3 ? Math.max(2, n) : 3;
    const rows = Math.ceil(n / COLS);
    const pad = 56;
    const cellW = Math.min(360, Math.max(260, Math.floor((availW - pad * 2) / COLS)));
    const cellH = Math.min(260, Math.max(190, Math.floor((availH - pad * 2) / Math.max(2, rows))));

    return ordenados.map((c, i) => {
      const def = defs[c.type] || { w: 140, h: 90 };
      const cw = def.w || 140;
      const ch = (def.h || 90) + 28;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        ...c,
        x: pad + col * cellW + Math.max(0, Math.floor((cellW - cw) / 2)),
        y: pad + row * cellH + Math.max(0, Math.floor((cellH - ch) / 4)),
      };
    });
  }

  // ---------- Construcción del pinout ----------
  // 1) Necesitamos conocer las terminales de cada COMPONENT_DEFS. El motor
  //    las define internamente, así que las derivamos: creamos el comp en
  //    el lienzo vía engine().fromPalette y leemos los nodos generados.
  //    Esto garantiza consistencia con COMPONENT_DEFS sin duplicarlo.
  function construirPinout() {
    const engine = window.SUGOI.engine;
    if (!engine) return null;

    const componentesMapeados = (PROY.componentes || [])
      .map((c) => {
        const nombre = c.nombre || c.Nombre;
        if (esAccesorio(nombre)) return null;
        return {
          nombre,
          cantidad: c.cantidad ?? c.Cantidad ?? 1,
          enInventario: c.enInventario ?? c.EnInventario ?? true,
          type: mapearTipo(nombre) || 'generico',
        };
      })
      .filter(Boolean)
      .map((c) => ({ ...c, id: 'c' + (Math.random().toString(36).slice(2, 6)) }));

    if (componentesMapeados.length === 0) {
      // Fallback: no hay BOM procesable, dejar lienzo vacío
      return { components: [], nodes: [], connections: [] };
    }

    const layout = autolayout(componentesMapeados);

    // Instanciamos cada componente en el lienzo para obtener sus terminales,
    // pero usamos coordenadas relativas. En su lugar, deducimos nodos a mano.
    // Para no depender de fromPalette (centrado), construimos los nodos
    // directamente sabiendo que cada def define terminales visibles.
    // Reconstruimos llamando a buildComponent por cada comp con su (x,y),
    // leyendo luego los nodos de state.
    const { nodos, comps } = instalar(layout);

    const delProyecto = resolverConexiones(comps, nodos);
    const conexiones = completarCableado(comps, nodos, delProyecto);

    return {
      version: '1.0',
      components: comps,
      nodes: nodos,
      connections: conexiones,
    };
  }

  // Instala los componentes en Konva (a través del motor) y recoge nodos.
  function instalar(layout) {
    const engine = window.SUGOI.engine;
    const comps = [];
    const nodos = [];
    const estado = {};

    // Recolectar la definición de terminales por tipo: usamos un ref
    // del COMPONENT_DEFS expuesto por el motor.
    layout.forEach((c) => {
      const def = engine.componentsDefs && engine.componentsDefs[c.type];
      if (!def) return;
      estado[c.id] = { def, layout: c };
    });

    Object.keys(estado).forEach((cid) => {
      const { def, layout: c } = estado[cid];
      def.terminals.forEach((td, i) => {
        nodos.push({
          id: `${cid}_${td.id}`,
          compType: c.type,
          compId: cid,
          index: td.index ?? i,
          label: td.pinName || null,
          role: td.role || null,
          pinName: td.pinName || null,
          avrPort: td.avrPort ?? null,
          bit: td.bit ?? null,
          x: c.x + td.x,
          y: c.y + td.y,
        });
      });
      comps.push({
        id: cid,
        type: c.type,
        label: c.nombre || def.label,
        imagen: imagenComponente(c.nombre || def.label),
        x: c.x,
        y: c.y,
      });
    });

    return { nodos, comps };
  }

  function partirEndpoint(comp, pin) {
    if (pin) return { comp: String(comp || ''), pin: String(pin || '') };
    const text = String(comp || '');
    const idx = text.lastIndexOf('_');
    if (idx <= 0) return { comp: text, pin: '' };
    return { comp: text.slice(0, idx).trim(), pin: text.slice(idx + 1).trim() };
  }

  const PIN_ALIAS = {
    signal: ['sig', 'in', 'data', 'out', 'pwm'],
    sig: ['signal', 'in', 'pwm'],
    trigger: ['trig'],
    trig: ['trigger'],
    echo: ['echo'],
    aout: ['ao', 'analogout', 'signal'],
    dout: ['do', 'digitalout'],
    pos: ['vcc', '5v'],
    neg: ['gnd'],
    vcc: ['5v', 'pos', 'vin'],
    in: ['sig', 'signal'],
  };

  // Cruza las conexiones del proyecto con los terminales disponibles de
  // cada componente. Devuelve cables { id, from, to, color }.
  function resolverConexiones(comps, nodos) {
    const cables = [];
    const compPorLabel = new Map();
    comps.forEach((c) => {
      compPorLabel.set(normNombre(c.label), c.id);
    });

    (PROY.conexiones || []).forEach((cx, idx) => {
      const rawOri = partirEndpoint(
        cx.origenComponente || cx.OrigenComponente || cx.origen || cx.Origen || '',
        cx.origenPin || cx.OrigenPin || ''
      );
      const rawDes = partirEndpoint(
        cx.destinoComponente || cx.DestinoComponente || cx.destino || cx.Destino || '',
        cx.destinoPin || cx.DestinoPin || ''
      );
      if (esAccesorio(rawOri.comp) || esAccesorio(rawDes.comp)) return;

      const oriCompId = buscarCompId(rawOri.comp, compPorLabel, comps);
      const desCompId = buscarCompId(rawDes.comp, compPorLabel, comps);
      if (!oriCompId || !desCompId) return;

      const from = buscarNodo(oriCompId, rawOri.pin, nodos);
      const to = buscarNodo(desCompId, rawDes.pin, nodos);
      if (!from || !to || from === to) return;
      const fn = nodos.find((n) => n.id === from);
      const tn = nodos.find((n) => n.id === to);
      if (fn && tn && fn.compId === tn.compId) return;

      cables.push({
        id: 'w' + (idx + 1),
        from,
        to,
        color: cx.color || cx.Color || 'gris',
      });
    });

    return cables;
  }

  function buscarCompId(nombre, porLabel, comps) {
    const key = normNombre(nombre);
    if (!key || esAccesorio(nombre)) return null;
    if (porLabel.has(key)) return porLabel.get(key);

    let best = null;
    let bestScore = 0;
    for (const c of comps) {
      if (c.type === 'generico' && esAccesorio(c.label)) continue;
      const k = normNombre(c.label);
      if (!k) continue;
      if (k === key) return c.id;
      if (key.length >= 4 && k.length >= 4 && (k.includes(key) || key.includes(k))) {
        const score = Math.min(k.length, key.length);
        if (score > bestScore) { bestScore = score; best = c.id; }
      }
    }
    if (best && bestScore >= 4) return best;

    const tok = key.replace(/(modulo|sensor|placa)/g, '');
    if (tok.length >= 4) {
      for (const c of comps) {
        if (c.type === 'protoboard' || (c.type === 'generico' && esAccesorio(c.label))) continue;
        const k = normNombre(c.label);
        const tip = normNombre(c.type || '');
        if (k.includes(tok) || tok.includes(tip) && tip.length >= 4) return c.id;
      }
    }

    for (const c of comps) {
      if (c.type === 'generico') continue;
      const tip = normNombre(c.type || '');
      if (tip.length >= 4 && (tip.includes(key) || key.includes(tip))) return c.id;
    }
    return null;
  }

  function buscarNodo(compId, pin, nodos) {
    const p = normEtiqueta(pin);
    if (!p) return null;
    const cand = nodos.filter((n) => n.compId === compId);
    const pMin = (pin || '').toString().toLowerCase().replace(/^pin\s*/i, '');
    const pUp = pMin.toUpperCase();

    const esPower = /^(5v|vcc|3v3|3\.3|vin|power|pos|\+|alim)/.test(pMin) ||
                    /(positivo|aliment|vcc|5\s?volt)/.test(pMin);
    const esGnd = /^(gnd|tierra|neg|0v|-)$/.test(pMin) || /(negativo|tierra)/.test(pMin);
    if (esPower || esGnd) {
      const rol = esPower ? 'vcc' : 'gnd';
      let m = cand.find((n) => (normEtiqueta(n.pinName || n.label || '') === p) || (normEtiqueta(n.id.split('_').pop()) === p));
      if (m) return m.id;
      m = cand.find((n) => normEtiqueta(n.role) === rol);
      if (m) return m.id;
    }

    const labelOf = (n) => String(n.pinName || n.label || '').toUpperCase();

    let match = cand.find((n) => normEtiqueta(n.pinName || n.label || n.role) === p);
    if (match) return match.id;

    match = cand.find((n) => {
      const lab = labelOf(n);
      return lab === pUp || lab === 'D' + pUp || lab === 'A' + pUp || lab === 'GP' + pUp;
    });
    if (match) return match.id;

    const aliases = PIN_ALIAS[p] || [];
    match = cand.find((n) => {
      const lab = normEtiqueta(n.pinName || n.label || n.role || '');
      return aliases.includes(lab) || PIN_ALIAS[lab] && PIN_ALIAS[lab].includes(p);
    });
    if (match) return match.id;

    match = cand.find((n) => normEtiqueta(n.role) === p);
    if (match && p.length <= 5) return match.id;

    if (!esPower && !esGnd) {
      const num = (pin || '').toString().replace(/\D/g, '');
      if (num) {
        match = cand.find((n) => {
          const lab = labelOf(n);
          return lab === num || lab === 'D' + num || lab === 'A' + num
            || lab === 'GP' + num || lab === 'GPIO' + num || lab === 'IO' + num
            || lab === 'PB' + num;
        });
        if (match) return match.id;
      }
    }

    return null;
  }

  function nodoPorRol(compId, roles, nodos) {
    const cand = nodos.filter((n) => n.compId === compId);
    for (const r of roles) {
      const nr = normEtiqueta(r);
      const m = cand.find((n) =>
        normEtiqueta(n.role) === nr ||
        normEtiqueta(n.pinName || n.label || '') === nr
      );
      if (m) return m.id;
    }
    return null;
  }

  function esPinGpio(n) {
    const lab = String(n.pinName || n.label || '').toUpperCase();
    return /^(D|GP|GPIO|IO|PB)\d+$/.test(lab);
  }

  function pinesDesdeCodigo(codigo) {
    const out = [];
    const src = String(codigo || '');
    const add = (name, num) => {
      if (!name || !num) return;
      out.push({ name: name.toLowerCase(), num: String(num) });
    };
    src.replace(/#define\s+(\w+)\s+(\d+)/g, (_, n, v) => add(n, v));
    src.replace(/(?:const\s+)?(?:int|byte|uint8_t)\s+(\w+)\s*=\s*(\d+)/g, (_, n, v) => add(n, v));
    return out;
  }

  function gpioPorNumero(mcuId, num, nodos) {
    return buscarNodo(mcuId, 'GPIO' + num, nodos)
      || buscarNodo(mcuId, 'D' + num, nodos)
      || buscarNodo(mcuId, String(num), nodos);
  }

  function completarCableado(comps, nodos, cables) {
    const lista = cables.slice();
    const usados = new Set();
    lista.forEach((c) => {
      usados.add(c.from + '>' + c.to);
      usados.add(c.to + '>' + c.from);
    });
    const add = (from, to, color) => {
      if (!from || !to || from === to) return;
      if (usados.has(from + '>' + to)) return;
      usados.add(from + '>' + to);
      usados.add(to + '>' + from);
      lista.push({ id: 'wa' + lista.length, from, to, color: color || 'gris' });
    };

    const mcu = comps.find((c) => /arduino|esp32|attiny|rp2040/.test(c.type));
    const fuente = comps.find((c) => c.type === 'fuente_5v' || c.type === 'vcc');
    if (!mcu) return lista;

    const vccMcu = nodoPorRol(mcu.id, ['5v', 'vcc', '3v3', 'vin'], nodos);
    const gndMcu = nodoPorRol(mcu.id, ['gnd'], nodos);
    const vccSrc = fuente ? nodoPorRol(fuente.id, ['vcc', 'pos', '5v'], nodos) : null;
    const gndSrc = fuente ? nodoPorRol(fuente.id, ['gnd', 'neg'], nodos) : null;
    const railV = vccSrc || vccMcu;
    const railG = gndSrc || gndMcu;

    if (vccSrc && vccMcu) add(vccSrc, vccMcu, 'rojo');
    if (gndSrc && gndMcu) add(gndSrc, gndMcu, 'negro');

    const gpioTomados = new Set();
    lista.forEach((c) => {
      [c.from, c.to].forEach((id) => {
        const n = nodos.find((x) => x.id === id);
        if (n && n.compId === mcu.id && esPinGpio(n)) gpioTomados.add(n.id);
      });
    });
    const gpiosLibres = nodos.filter((n) => n.compId === mcu.id && esPinGpio(n) && !gpioTomados.has(n.id));
    let gi = 0;
    const nextGpio = () => {
      while (gi < gpiosLibres.length) {
        const id = gpiosLibres[gi++].id;
        if (!gpioTomados.has(id)) {
          gpioTomados.add(id);
          return id;
        }
      }
      return null;
    };

    const codigoPins = pinesDesdeCodigo(PROY.codigo || PROY.Codigo || '');
    const relay = comps.find((c) => c.type === 'relay');
    const bomba = comps.find((c) => c.type === 'bomba_agua');

    comps.forEach((c) => {
      if (c.id === mcu.id || (fuente && c.id === fuente.id)) return;
      if (c.type === 'protoboard') return;
      if (c.type === 'generico') return;

      const vcc = nodoPorRol(c.id, ['vcc', '5v', 'pos', 'vin'], nodos);
      const gnd = nodoPorRol(c.id, ['gnd', 'neg', 'cathode'], nodos);
      if (vcc && railV) add(railV, vcc, 'rojo');
      if (gnd && railG) add(railG, gnd, 'negro');

      const hint = codigoPins.find((p) => {
        const n = (c.label || c.type || '').toLowerCase();
        return n.includes(p.name.replace(/pin|_pin|sensor|relay|rele|bomba|led|hum/g, ''))
          || p.name.includes('relay') && c.type === 'relay'
          || p.name.includes('rele') && c.type === 'relay'
          || (p.name.includes('hum') || p.name.includes('soil') || p.name.includes('moist')) && c.type === 'sensor_humedad'
          || (p.name.includes('pump') || p.name.includes('bomba')) && c.type === 'bomba_agua'
          || p.name.includes('led') && /^led_/.test(c.type);
      });
      let gpio = hint ? gpioPorNumero(mcu.id, hint.num, nodos) : null;
      if (gpio) gpioTomados.add(gpio);
      if (!gpio) gpio = nextGpio();

      if (c.type === 'relay') {
        const inn = buscarNodo(c.id, 'IN', nodos) || nodoPorRol(c.id, ['t', 'in', 'sig'], nodos);
        if (inn && gpio) add(gpio, inn, 'amarillo');
      } else if (c.type === 'bomba_agua' && relay) {
        const no = buscarNodo(relay.id, 'NO', nodos);
        if (no && vcc) add(no, vcc, 'rojo');
      } else if (/^led_/.test(c.type)) {
        const a = nodoPorRol(c.id, ['anode', 't'], nodos);
        if (a && gpio) add(gpio, a, 'azul');
      } else if (c.type === 'servo') {
        const sig = nodoPorRol(c.id, ['signal', 'sig'], nodos);
        if (sig && gpio) add(gpio, sig, 'amarillo');
      } else if (/sensor|dht|pir|hc_sr|humedad|flame|gas|sound|photo/.test(c.type)) {
        const sig = nodoPorRol(c.id, ['signal', 'aout', 'data', 'out'], nodos)
          || buscarNodo(c.id, 'AOUT', nodos)
          || buscarNodo(c.id, 'DATA', nodos)
          || buscarNodo(c.id, 'OUT', nodos);
        if (sig && gpio) add(gpio, sig, 'verde');
      } else if (c.type === 'resistor' || c.type === 'capacitor' || c.type === 'diode') {
        const t1 = nodoPorRol(c.id, ['t', 'anode'], nodos);
        if (t1 && gpio) add(gpio, t1, 'azul');
      }
    });

    if (bomba && relay) {
      const no = buscarNodo(relay.id, 'NO', nodos);
      const pv = nodoPorRol(bomba.id, ['vcc'], nodos);
      if (no && pv) add(no, pv, 'rojo');
    }

    return lista;
  }

  // ---------- Aplicar al lienzo ----------
  function autoGenerar() {
    try {
      const pinout = construirPinout();
      if (!pinout) return false;
      const engine = window.SUGOI.engine;
      engine.restore(pinout);
      window.dispatchEvent(new CustomEvent('sugoi:autogenerado', { detail: pinout }));
      console.log('[sugoi-mecaplan] Circuito auto-generado:', pinout.components.length, 'componentes,', pinout.connections.length, 'cables.');
      return true;
    } catch (e) {
      console.error('[sugoi-mecaplan] Error auto-generando circuito:', e);
      return false;
    }
  }

  // Exponer API de adaptador
  window.SUGOI = window.SUGOI || {};
  window.SUGOI.adaptador = {
    autoGenerar,
    construirPinout,
    mapearTipo,
    get proyecto() { return PROY; },
  };
})();
