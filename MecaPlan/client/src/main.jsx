import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './canvas.css';

function readJson(id, fallback) {
  const node = document.getElementById(id);
  if (!node) return fallback;
  try {
    return JSON.parse(node.textContent || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseEndpoint(value) {
  const text = String(value || '');
  const idx = text.indexOf('_');
  if (idx < 0) return { component: text || 'Componente', pin: '' };
  return { component: text.slice(0, idx), pin: text.slice(idx + 1) };
}

function normalizeLink(link) {
  const origen = link.origen || link.Origen
    || [link.origenComponente || link.OrigenComponente, link.origenPin || link.OrigenPin].filter(Boolean).join('_');
  const destino = link.destino || link.Destino
    || [link.destinoComponente || link.DestinoComponente, link.destinoPin || link.DestinoPin].filter(Boolean).join('_');
  const color = link.color_cable || link.ColorCable || link.color || link.Color || 'gris';
  return { origen, destino, color_cable: color };
}

function esAccesorioNombre(nombre) {
  return /cable|jumper|tubo|manguera|cinta|tornillo|carcasa|liquido|dep[oó]sito/i.test(nombre || '')
    && !/sensor|arduino|servo|rele|rel[eé]|motor|fuente/i.test(nombre || '');
}

function completarConexiones(raw, componentes) {
  const links = (raw || []).map(normalizeLink).filter((l) => l.origen && l.destino);
  const names = (componentes || []).map((c) => c.nombre).filter(Boolean);
  const hasPair = (a, b) => links.some((l) => {
    const x = normalize(parseEndpoint(l.origen).component);
    const y = normalize(parseEndpoint(l.destino).component);
    return (x === normalize(a) && y === normalize(b)) || (x === normalize(b) && y === normalize(a));
  });
  const mcu = names.find((n) => /arduino|esp32|pico|attiny|nodemcu/i.test(n));
  const fuente = names.find((n) => /fuente|aliment|5\s*v/i.test(n));
  if (mcu && fuente && !hasPair(mcu, fuente)) {
    links.push({ origen: `${fuente}_VCC`, destino: `${mcu}_5V`, color_cable: 'rojo' });
    links.push({ origen: `${fuente}_GND`, destino: `${mcu}_GND`, color_cable: 'negro' });
  }
  names.forEach((n) => {
    if (!n || n === mcu || n === fuente || esAccesorioNombre(n) || /protoboard|breadboard/i.test(n)) return;
    if (fuente && !hasPair(n, fuente) && /sensor|relay|rele|rel[eé]|bomba|led|servo/i.test(n)) {
      links.push({ origen: `${fuente}_VCC`, destino: `${n}_VCC`, color_cable: 'rojo' });
    }
    if (mcu && !hasPair(n, mcu) && /sensor|relay|rele|rel[eé]|led|servo|humedad/i.test(n)) {
      links.push({ origen: `${mcu}_GPIO`, destino: `${n}_SIG`, color_cable: 'verde' });
    }
    if (mcu && /bomba/i.test(n) && !hasPair(n, mcu)) {
      const relay = names.find((x) => /relay|rele|rel[eé]/i.test(x));
      if (relay && !hasPair(n, relay)) {
        links.push({ origen: `${relay}_NO`, destino: `${n}_VCC`, color_cable: 'rojo' });
      }
    }
  });
  return links;
}

const COLORS = {
  rojo: '#ef4444',
  amarillo: '#eab308',
  verde: '#22c55e',
  azul: '#3b82f6',
  naranja: '#f97316',
  negro: '#111827',
  blanco: '#e5e7eb',
  gris: '#94a3b8',
  morado: '#8b5cf6',
  cafe: '#92400e',
  marron: '#92400e',
};

function colorOf(value) {
  return COLORS[String(value || 'gris').toLowerCase()] || COLORS.gris;
}

function buildNodes(componentes, conexiones, posiciones) {
  const seen = new Map();
  function add(nombre, enInventario) {
    const key = normalize(nombre);
    if (!key || !nombre) return;
    const existing = seen.get(key);
    if (!existing || (existing.nombre.length < nombre.length)) {
      seen.set(key, { nombre, enInventario: !!enInventario, key });
    }
  }

  componentes.forEach((c) => add(c.nombre, c.enInventario));
  conexiones.forEach((link) => {
    const n = normalizeLink(link);
    add(parseEndpoint(n.origen).component, false);
    add(parseEndpoint(n.destino).component, false);
  });

  const posMap = new Map();
  (posiciones || []).forEach((p) => {
    if (p && p.nombre) posMap.set(normalize(p.nombre), p);
  });

  const items = [...seen.values()];
  const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(items.length || 1))));

  return items.map((item, index) => {
    let x = 60 + (index % cols) * 220;
    let y = 80 + Math.floor(index / cols) * 120;
    const saved = posMap.get(item.key);
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      x = saved.x;
      y = saved.y;
    }
    return {
      id: item.key,
      position: { x, y },
      data: { label: item.nombre, enInventario: item.enInventario },
      type: 'component',
    };
  });
}

function buildEdges(conexiones, nodes) {
  const valid = new Set(nodes.map((n) => n.id));
  return conexiones
    .map(normalizeLink)
    .filter((link) => {
      const from = parseEndpoint(link.origen).component;
      const to = parseEndpoint(link.destino).component;
      if (!valid.has(normalize(from)) || !valid.has(normalize(to))) return false;
      if (normalize(from) === normalize(to)) return false;
      return true;
    })
    .map((link) => ({
      id: `e-${normalize(link.origen)}-${normalize(link.destino)}`,
      source: normalize(parseEndpoint(link.origen).component),
      target: normalize(parseEndpoint(link.destino).component),
      sourceHandle: 'out',
      targetHandle: 'in',
      animated: false,
      style: { stroke: colorOf(link.color_cable), strokeWidth: 3 },
      data: { origen: link.origen, destino: link.destino, color_cable: link.color_cable || 'gris' },
    }));
}

function ComponentNode({ data }) {
  return (
    <div className={`rf-node ${data.enInventario ? 'is-stock' : 'is-new'}`}>
      <Handle type="target" position={Position.Left} id="in" style={{ background: '#22c55e' }} />
      <span className="rf-node-label">{data.label}</span>
      <Handle type="source" position={Position.Right} id="out" style={{ background: '#3b82f6' }} />
    </div>
  );
}

function CanvasApp() {
  const [conexiones, setConexiones] = useState(() => {
    const raw = readJson('workspaceConexiones', []);
    const comps = readJson('workspaceComponentes', []);
    return completarConexiones(raw, comps);
  });
  const [posiciones, setPosiciones] = useState(() => readJson('workspacePosiciones', []));
  const componentes = useMemo(() => readJson('workspaceComponentes', []), []);

  const [nodes, setNodes] = useState(() => buildNodes(componentes, conexiones, posiciones));
  const [edges, setEdges] = useState(() => buildEdges(conexiones, buildNodes(componentes, conexiones, posiciones)));

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'default', animated: false }, eds)),
    []
  );

  const [savedState, setSavedState] = useState('idle');
  const saving = useRef(false);

  const guardar = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    setSavedState('saving');
    const pos = nodes
      .filter((n) => n.position && typeof n.position.x === 'number')
      .map((n) => ({ nombre: n.data.label, x: Math.round(n.position.x), y: Math.round(n.position.y) }));

    const nameById = new Map((nodes.filter((n) => n.data && n.data.label)).map((n) => [n.id, n.data.label]));

    const cons = edges.map((e) => {
      if (e.data && e.data.origen && e.data.destino) {
        return { origen: e.data.origen, destino: e.data.destino, color_cable: e.data.color_cable || 'gris' };
      }
      const srcName = nameById.get(e.source) || e.source;
      const tgtName = nameById.get(e.target) || e.target;
      return { origen: `${srcName}_P`, destino: `${tgtName}_P`, color_cable: 'gris' };
    });

    const token = document.getElementById('codigoToken')?.value;
    const rootEl = document.getElementById('reactFlowRoot');
    const proyectoId = rootEl?.closest('.workspace')?.getAttribute('data-proyecto-id');

    const body = new URLSearchParams();
    body.set('conexiones', JSON.stringify(cons));
    body.set('posiciones', JSON.stringify(pos));
    body.set('__RequestVerificationToken', token || '');

    try {
      const response = await fetch(`/Proyectos/GuardarCanvas/${proyectoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          RequestVerificationToken: token || '',
        },
        body,
      });
      setSavedState(response.ok ? 'ok' : 'error');
    } catch {
      setSavedState('error');
    } finally {
      saving.current = false;
      setTimeout(() => setSavedState((s) => (s === 'ok' ? 'idle' : s)), 1800);
    }
  }, [nodes, edges]);

  const nodeTypes = useMemo(() => ({ component: ComponentNode }), []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        guardar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guardar]);

  useEffect(() => {
    window.dispatchEvent(new Event('mecaplan-canvas-ready'));
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '80vh' }}>
      <div className="rf-toolbar">
        <span className={`rf-save-btn rf-save-${savedState}`} onClick={guardar} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}>
          {savedState === 'ok' ? 'Guardado ✓' : savedState === 'error' ? 'Error al guardar' : savedState === 'saving' ? 'Guardando…' : 'Guardar'}
        </span>
        <span className="rf-hint">
          Conecta: arrastra desde el punto azul hasta el punto verde. Ctrl+S para guardar.
        </span>
      </div>
      
      <div className="rf-flow-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'default' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant="dots" color="#64748b" gap={20} size={2} />
          <Controls />
          <MiniMap pannable zoomable nodeColor={(n) => (n.data?.enInventario ? '#22c55e' : '#f97316')} />
        </ReactFlow>
      </div>
    </div>
  );
}

const container = document.getElementById('reactFlowRoot');
if (container) {
  const root = createRoot(container);
  root.render(<CanvasApp />);
}