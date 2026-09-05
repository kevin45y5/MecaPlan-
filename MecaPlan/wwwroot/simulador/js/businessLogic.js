// ============================================================
// businessLogic.js  (MODEL)
// Lógica pura de negocio del simulador sugoi_project.
//   - serializeCircuit: estado -> JSON de pinout (nodos, componentes,
//     conexiones, netlist con Union-Find, mapeo de pines AVR).
//   - calculateBOM     : JSON de circuito -> desglose de costo comercial.
//   - buildNetlistWithMatrix: nueva función para topología protoboard.
// No toca DOM ni Konva. Importable en otros entornos (también Node).
// ============================================================

/**
 * Estados posibles para los rieles de protoboard.
 * 'power' = riel VCC o GND (conexiones visibles requieren jumper explícito).
 * 'row'   = pista transversal de la fila (A-E o F-J), conexiones automáticas
 *           solo entre pines de la misma fila física.
 */
const POWER_STATE = { POWER: 'power', ROW: 'row' };

/**
 * buildNetlist - Unión-Find clásico (compatibilidad hacia atrás).
 * Revisa únicamente las conexiones explícitas (cables) del usuario.
 * Mantiene la forma original ({netlist, nodeToNet}) para no romper
 * llamadas externas que aún usen este helper.
 */
export function buildNetlist(nodes, connections) {
  const parent = {};
  const find = (x) => {
    if (parent[x] === undefined) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  nodes.forEach((n) => find(n.id));
  connections.forEach((c) => union(c.from, c.to));

  const groups = new Map();
  nodes.forEach((n) => {
    const root = find(n.id);
    if (!groups.has(root)) groups.set(root, { id: `net_${root}`, nodes: [] });
    groups.get(root).nodes.push(n.id);
  });

  const netlist = Array.from(groups.values());
  const nodeToNet = new Map();
  netlist.forEach((net) => net.nodes.forEach((nid) => nodeToNet.set(nid, net.id)));

  return { netlist, nodeToNet };
}

/**
 * findShortCircuits - Detecta nets con más de un pin fuente/alimentación
 * (o un pin marcado como VCC/GND junto a un pin de señal sin resistencia),
 * que en la práctica indican un cortocircuito a nivel de prototipado.
 */
export function findShortCircuits(netlist, nodesById) {
  const shorts = [];
  for (const net of netlist) {
    if (!net.nodes || net.nodes.length < 2) continue;
    const roles = net.nodes
      .map((nid) => (nodesById.get(nid) || {}))
      .map((nd) => nd.role || 'signal');

    const powerCount = roles.filter((r) => r === 'vcc' || r === 'gnd').length;
    // Dos fuentes/alimentaciones en la misma net = corto probable.
    if (powerCount >= 2) {
      shorts.push({
        net: net.id,
        nodes: net.nodes,
        reason: 'Múltiples pines de alimentación (VCC/GND) conectados en la misma net.',
      });
    } else if (powerCount === 1 && roles.includes('signal')) {
      shorts.push({
        net: net.id,
        nodes: net.nodes,
        reason: 'Alimentación (VCC/GND) unida directamente a una pista de señal sin resistencia.',
      });
    }
  }
  return shorts;
}

/**
 * buildNetlistWithMatrix - Unión-Find mejorado para protoboard matrix.
 *
 * A diferencia de buildNetlist(), este método comprende la topología interna
 * de una protoboard:
 *   - Filas transversales (A-E, F-J) están pre-conectadas entre sí de forma
   aislada: un componente colocado en la fila 2 solo se une a otros en la
   fila 2, no a la fila 5.
 *   - Los rieles longitudinales (VCC y GND) corren de principio a fin, pero
   su conexión NO es automática al soltar un componente: el usuario debe
   colocar un jumper explícito desde la fila del componente al bus de
   alimentación. Esto refleja la física real de protoboard prototyping.
 *
 * @param {Array} nodes       [{id, compType, compId, index, x, y, role, pinName, avrPort}]
 * @param {Array} connections [{id, from, to}]
 * @param {object} protoboardConfig { rows: number, cols: number, railCount: 2 }
 * @returns {{netlist: Array, nodeToNet: Map, powerRails: Map}}
 */
export function buildNetlistWithMatrix(nodes, connections, protoboardConfig = { rows: 4, cols: 30, railCount: 2 }) {
  const parent = {};

  const find = (x) => {
    if (parent[x] === undefined) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // ---- Inicializar padres: cada nodo tiene su propio padre ---
  nodes.forEach((n) => find(n.id));

  // ---- Union por conexiones explícitas (cables del usuario) ----
  connections.forEach((c) => union(c.from, c.to));

  // ---- Lógica de topología interna de protoboard ----
  // 1) Filas transversales: unionar nodos que pertenecen a la misma fila geométrica.
  //    Identificamos la fila por la coordenada y redondeada a "bands".
  //    Bandas: A-E -> banda 0, F-J -> banda 1, etc.
  const rowBands = {};
  nodes.forEach((n, idx) => {
    // Asumimos que y crece hacia abajo; agrupar por rangos de 20px aproximadamente
    const band = Math.floor((n.y || 0) / 20); // cada banda = ~20px = una fila física
    if (band in rowBands === false) rowBands[band] = [];
    rowBands[band].push(n.id);
  });

  // Unionar todos los nodos de la misma banda (misma fila física)
  Object.values(rowBands).forEach((bandNodes) => {
    if (bandNodes.length > 1) {
      const first = bandNodes[0];
      for (let i = 1; i < bandNodes.length; i++) {
        union(first, bandNodes[i]);
      }
    }
  });

  // 2) Rieles longitudinales (VCC y GND): NO hacemos union automática aquí.
  //    El usuario debe colocar un jumper explícito desde una fila al riel.
  //    Solo registeramos que los rieles existen para el diagnóstico posterior.
  //    No hacemos union parent para VCC/GND automática.

  // ---- Agrupar por raíz -> nets ----
  const groups = new Map();
  nodes.forEach((n) => {
    const root = find(n.id);
    if (!groups.has(root)) groups.set(root, { id: `net_${root}`, nodes: [] });
    groups.get(root).nodes.push(n.id);
  });

  const netlist = Array.from(groups.values());

  // ---- Mapeos auxiliares ----
  const nodeToNet = new Map();
  netlist.forEach((net) => net.nodes.forEach((nid) => nodeToNet.set(nid, net.id)));

  // ---- Power rails mapping: registramos qué nodos tienen role vcc/gnd
  //    pero no los unimos automáticamente. El UI comprobará después si hay
  //    conexiones explícitas VCC/GND vía jumpers.
  const powerRails = new Map();
  nodes.forEach((n) => {
    if (n.role === 'vcc' || n.role === 'gnd') {
      powerRails.set(n.id, { role: n.role, netId: nodeToNet.get(n.id) || null });
    }
  });

  return {
    netlist,
    nodeToNet,
    powerRails,
    // Metadatos de configuración para el UI
    protoboardConfig: { rows: protoboardConfig.rows, cols: protoboardConfig.cols }
  };
}

/**
 * detectPowerJump - Heurística simple para sugerir si un net probablemente
   debería tener un jumper VCC/GND basado en la presencia de componentes
   source/sink sin resistencia interpuesta.
 *
 * @param {Array} netlist
 * @param {Map} nodeToNet
 * @returns {Array} lista de nets que carecen de resistencia y tienen power
 */
export function detectPowerJumps(netlist, nodeToNet) {
  const candidates = [];
  for (const net of netlist) {
    if (net.nodes.length < 2) continue;
    const hasResistor = net.nodes.some((nid) => {
      const node = nodeToNet.get(nid);
      return node && node.role === 'resistor';
    });
    const hasPower = net.nodes.some((nid) => {
      const node = nodeToNet.get(nid);
      return node && (node.role === 'vcc' || node.role === 'gnd');
    });
    if (hasPower && !hasResistor) {
      candidates.push({ netId: net.id, nodeIds: net.nodes });
    }
  }
  return candidates;
}

/**
 * buildPinoutMap - Versión actualizada que usa el nuevo netlist
 * que distingue filas (row) de rieles (power).
 * Devuelve mapping de pinName -> { nodeId, netId, port, bit, vcc, gnd }.
 * NOTA: vcc/gnd solo se mapean si el usuario explicitly los conectó con jumpers;
 *         sino el campo vcc/gnd será null para forzar al usuario a ser explícito.
 */
export function buildPinoutMap(nodes, netlistInfo) {
  const nodeToNet = netlistInfo.nodeToNet;
  const powerRails = netlistInfo.powerRails;
  const map = {};

  for (const n of nodes) {
    if (n.avrPort !== undefined && n.bit !== undefined && n.pinName) {
      map[n.pinName] = {
        nodeId: n.id,
        netId: nodeToNet.get(n.id) || null,
        port: n.avrPort,
        bit: n.bit,
        // vcc/gnd solo si vienen explicitamente del componente y ya tienen netId
        vcc: n.role === 'vcc' && powerRails.get(n.id) ? powerRails.get(n.id).netId : null,
        gnd: n.role === 'gnd' && powerRails.get(n.id) ? powerRails.get(n.id).netId : null,
      };
    }
    // No establecemos vcc/gnd aquí de forma automática para la fila;
    // el UI decidirá mostrá-los o no basándose en jumpers explícitos.
  }
  return map;
}

/**
 * serializeCircuit - Serializa el estado del lienzo en JSON estructurado.
 * Incluye topología matrix-aware via buildNetlistWithMatrix.
 *
 * @param {object} state { nodes: [], connections: [], components: [] }
 * @param {object} [protoboardConfig] { rows, cols } configuración protoboard
 * @returns {object} JSON serializado
 */
export function serializeCircuit(state, protoboardConfig) {
  const nodes = (state.nodes || []).map((n) => ({
    id: n.id,
    compType: n.compType,
    compId: n.compId,
    index: n.index,
    label: n.label || null,
    role: n.role || null,
    pinName: n.pinName || null,
    avrPort: n.avrPort ?? null,
    bit: n.bit ?? null,
    x: Math.round(n.x),
    y: Math.round(n.y),
  }));

  const components = (state.components || []).map((c) => ({
    id: c.id,
    type: c.type,
    label: c.label || null,
    terminals: (c.terminals || []).map((t) => t.id),
  }));

  const connections = (state.connections || []).map((c) => ({
    id: c.id,
    from: c.from,
    to: c.to,
    color: c.color || 'gris',
  }));

  // Build netlist usando la lógica matrix-aware
  const netlistInfo = buildNetlistWithMatrix(nodes, connections, protoboardConfig || { rows: 4, cols: 30 });
  const netlist = netlistInfo.netlist;
  const nodeToNet = netlistInfo.nodeToNet;

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    nodes,
    components,
    connections,
    netlist,
    pinout: buildPinoutMap(nodes, netlistInfo),
    diagnostics: {
      shorts: findShortCircuits(netlist, new Map(nodes.map((n) => [n.id, n]))),
      powerJumps: detectPowerJumps(netlist, nodeToNet),
      unconnectedTerminals: nodes
        .filter((n) => !netlist.some((net) => net.nodes.length > 1 && net.nodes.includes(n.id)))
        .map((n) => n.id),
    },
  };
}

// ============================================================
// BOM — Bill of Materials
// ============================================================

/**
 * Cruza los componentes del circuito con la tabla de precios
 * (PRICE_TABLE de window.SUGOI_CONFIG) y genera el desglose.
 *
 * @param {object} circuit  pinout JSON de serializeCircuit()
 * @param {object} priceMap { tipoComponente: {name, unitPrice} }
 * @param {number} markup   margen comercial (0.15 = 15%)
 * @param {string} [currency='USD'] moneda a mostrar (por defecto USD ahora)
 */
export function calculateBOM(circuit, priceMap, markup = 0, currency = 'USD') {
  const counts = {};
  for (const comp of circuit.components) {
    counts[comp.type] = (counts[comp.type] || 0) + 1;
  }

  const items = [];
  let subtotal = 0;

  for (const [type, qty] of Object.entries(counts)) {
    const def = priceMap[type];
    const unitPrice = def ? def.unitPrice : 0;
    const name = def ? def.name : `Componente ${type}`;
    const lineTotal = +(unitPrice * qty).toFixed(2);
    subtotal += lineTotal;
    items.push({
      type,
      name,
      qty,
      unitPrice: +unitPrice.toFixed(2),
      lineTotal,
    });
  }

  // ---- Cables de conexión (jumpers) ----
  // Cada conexión dibujada representa un cable físico (macho-macho o
  // macho-hembra). Se añade automáticamente al BOM cuando el circuito
  // tiene al menos una conexión, con un costo unitario simbólico.
  const cableCount = (circuit.connections || []).length;
  if (cableCount > 0) {
    const cableDef = (priceMap && (priceMap.cable || priceMap.jumpers)) || { name: 'Cables de conexión (jumper)', unitPrice: 0.2 };
    const unitPrice = cableDef.unitPrice || 0.2;
    const name = cableDef.name || 'Cables de conexión (jumper)';
    const lineTotal = +(unitPrice * cableCount).toFixed(2);
    subtotal += lineTotal;
    items.push({
      type: 'jumpers',
      name,
      qty: cableCount,
      unitPrice: +unitPrice.toFixed(2),
      lineTotal,
    });
  }

  items.sort((a, b) => b.lineTotal - a.lineTotal);

  const markupTotal = +(subtotal * markup).toFixed(2);
  const total = +(subtotal + markupTotal).toFixed(2);

  return {
    currency, //ahora trae 'USD' por defecto pero viene desde config si sobreescribe
    markupRate: markup,
    subtotal: +subtotal.toFixed(2),
    markupTotal,
    total,
    items,
  };
}

// ============================================================
// Endpoint helper: SELECT list vs DESIGN detail
// ============================================================

/**
 * getDesignList - Retorna solo metadatos para listing masivo.
 * SELECT id, nombre, autor, created_at FROM designs.
 * Usado por el panel lateral para evitar enviar megabytes de pinout_json/bom_json.
 *
 * @param {Array} rows - Filas completas de la BD (traídas con SELECT *)
 * @returns {Array} Filas simplificadas
 */
export function getDesignList(rows) {
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    autor: r.autor,
    created_at: r.created_at,
  }));
}

/**
 * getDesignDetail - Retorna el diseño completo incluyendo pinout_json y bom_json.
 * Solo debe convocarse en el endpoint GET /api/designs/:id (consulta individual).
 *
 * @param {object} row - Fila completa de la BD
 * @param {object} pinoutJson - pinout_json parsed
 * @param {object} bomJson - bom_json parsed
 * @returns {object} Diseño completo
 */
export function getDesignDetail(row, pinoutJson, bomJson) {
  return {
    id: row.id,
    nombre: row.nombre,
    autor: row.autor,
    created_at: row.created_at,
    pinout_json: pinoutJson,
    bom_json: bomJson,
  };
}

// (End of file - total 240 lines)