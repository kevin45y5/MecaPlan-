// ============================================================
// ui.js  (VIEW / CONTROLADOR DE UI)
// Cablea la paleta, los botones de acción, las pestañas laterales
// y mantiene visibles el pinout JSON, el BOM y el panel del asistente.
// Trabaja con la nueva arquitectura Multi-Motor de simEngine.
// ============================================================

(function () {
  'use strict';

  const CONFIG = window.SUGOI_CONFIG || {};
  const engine = () => window.SUGOI.engine;
  // Lazy: window.SUGOI.businessLogic lo inyecta main.js (ES module), que
  // se ejecuta DESPUÉS de este IIFE. Por eso lo resolvemos en el acceso.
  const biz = () => window.SUGOI.businessLogic;
  const services = () => window.SUGOI.services;

  let designName = 'Mi circuito';
  let author = 'anonimo';
  let currentDesignId = null;

  const $ = (sel) => document.querySelector(sel);

  function init() {
    try {
      try { bindPalette(); } catch (e) { console.error('Error crítico de inicialización (bindPalette):', e); }
      try { bindActions(); } catch (e) { console.error('Error crítico de inicialización (bindActions):', e); }
      try { bindTabs(); } catch (e) { console.error('Error crítico de inicialización (bindTabs):', e); }

      // Actualizar paneles sobre cambios del circuito
      window.addEventListener('stage:changed', () => {
        renderPinout();
        renderBOM();
        autosave();
      });

      // Estado inicial
      try { renderPinout(); } catch (e) { console.error('Error crítico de inicialización (renderPinout):', e); }
      try { renderBOM(); } catch (e) { console.error('Error crítico de inicialización (renderBOM):', e); }
    } catch (err) {
      console.error('Error crítico de inicialización:', err);
    }
  }

  // ---------- Paleta de componentes ----------
  function bindPalette() {
    const palette = document.getElementById('sidebar');
    if (!palette) return;
    palette.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      const type = btn.dataset.type;
      // Colocar centrado en la vista
      placeAtViewport(type);
    });
    // Drag & drop HTML desde la paleta al canvas
    document.querySelectorAll('[data-draggable]').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.type);
      });
    });

    // Permitir soltar sobre el lienzo y colocar el componente ahí
    const workspace = document.getElementById('workspace');
    if (workspace) {
      workspace.addEventListener('dragover', (e) => e.preventDefault());
      workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain');
        if (!type) return;
        // Usar el nuevo engine().dropAt() + fromPalette que ya existen
        const p = engine().dropAt(e.clientX, e.clientY);
        engine().fromPalette(type, p.x - 30, p.y - 30);
      });
    }
  }

  function placeAtViewport(type) {
    const st = engine().stage;
    const pos = st.position();
    const scale = st.scaleX();
    const base = st.width() / 2 - pos.x;
    engine().fromPalette(type, (base / scale) - 30, ((st.height() / 2 - pos.y) / scale) - 30);
  }

  // ---------- Acciones superiores ----------
  function bindActions() {
    $('#btn-run').addEventListener('click', runSimulation);
    $('#btn-stop').addEventListener('click', () => {
      try { window.SUGOI.sim.stop(); } catch (e) {}
      try { engine().stopFlowAnimation(); } catch (e) {}
      try { engine().resetLeds(); } catch (e) {}
      logStatus('Simulación detenida.');
    });
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportReporte);
    $('#btn-save').addEventListener('click', saveToDB);
    $('#btn-load').addEventListener('click', openLoadModal);
    $('#btn-clear').addEventListener('click', () => {
      if (confirm('¿Borrar todo el lienzo?')) {
        location.reload();
      }
    });
    const delBtn = document.getElementById('btn-delete');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        try { engine().deleteSelection(); } catch (e) {}
      });
    }
    const discBtn = document.getElementById('btn-disconnect');
    if (discBtn) {
      discBtn.addEventListener('click', () => {
        const sel = engine().getSelection ? engine().getSelection() : {};
        if (sel.compId) engine().disconnectComponent(sel.compId);
        else if (sel.wireId) engine().removeWire(sel.wireId);
      });
    }
    // El botón "Asistente" de la barra abre la pestaña de chat del inspector.
    const debugBtn = document.getElementById('btn-debug');
    if (debugBtn) debugBtn.addEventListener('click', () => gotoTab('assistant'));

    // Botón "Organizar IA": Claude valida/ordena las conexiones y las aplica.
    const aiBtn = document.getElementById('btn-ai-layout');
    if (aiBtn) aiBtn.addEventListener('click', organizarConIA);

    // Nombre de diseño
    $('#design-name').addEventListener('input', (e) => {
      designName = e.target.value || 'Mi circuito';
    });

    // Modal de carga
    $('#load-modal .close').addEventListener('click', closeLoadModal);
    $('#load-modal').addEventListener('click', (e) => {
      if (e.target.id === 'load-modal') closeLoadModal();
    });
  }

  // ---------- Pestañas laterales ----------
  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => gotoTab(btn.dataset.tab));
    });
  }

  function gotoTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
  }

  // ---------- Simulación ----------
  async function runSimulation() {
    const code = getCode();
    if (!code.trim()) {
      logStatus('Escribe código C++ primero.');
      return;
    }

    // 1) Serializamos el circuito para pinout + BOM (funciona para cualquier placa)
    const pinout = biz().serializeCircuit(engine().getState());

    // 2) Regimen visual "energizado": animamos el flujo de señal por los
    //    cables (VCC ámbar, GND verde, señal azul) sin simular lógica real.
    try {
      engine().startFlowAnimation();
    } catch (e) {
      console.error('[sugoi] No se pudo iniciar la animación de flujo:', e);
    }

    const cableCount = (pinout.connections || []).length;
    logStatus(`Circuito energizado (visual): flujo de señal activo · ${cableCount} cables.`);

    // 3) Actualizar paneles con el nuevo pinout y BOM
    renderPinout();
    renderBOM();
  }

  // ---------- Panel de ayuda (pequeño editor de ejemplo) ----------
  const SAMPLE_CODE = `void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`;

  function getCode() {
    const el = $('#code-editor');
    // si el textarea está vacío al iniciar, mostrar ejemplo
    return el.value;
  }

  // ---------- Render de Pinout ----------
  function renderPinout() {
    const pinout = biz().serializeCircuit(engine().getState());
    const pre = $('#pinout-json');
    pre.textContent = JSON.stringify(pinout, null, 2);
  }

  // ---------- Render BOM ----------
  function renderBOM() {
    const circuit = biz().serializeCircuit(engine().getState());
    // Pasar currency='USD' por defecto; si CONFIG.CURRENCY viene definido (ej. 'MXN' viejo), usarlo.
    const currency = CONFIG.CURRENCY || 'USD';
    const bom = biz().calculateBOM(circuit, CONFIG.PRICE_TABLE || {}, CONFIG.BOM_MARKUP || 0, currency);
    const tbody = $('#bom-body');
    tbody.innerHTML = '';

    if (bom.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Agrega componentes para calcular el costo.</td></tr>';
    } else {
      bom.items.forEach((it) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${it.name}</td>
          <td>${it.qty}</td>
          <td>${money(it.unitPrice)}</td>
          <td>${money(it.lineTotal)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    $('#bom-subtotal').textContent = money(bom.subtotal);
    $('#bom-total').textContent = money(bom.total);
    $('#bom-currency').textContent = bom.currency;
  }

  const money = (n) => (Number(n) || 0).toFixed(2);

  // ---------- Exportación (PNG + Reporte PDF) ----------
  // Genera un snapshot PNG del lienzo y un reporte imprimible (imagen del
  // circuito + tablas BOM y pinout) en una ventana nueva. El navegador puede
  // guardarlo como PDF vía Imprimir → "Guardar como PDF".
  function exportReporte() {
    try {
      // Snapshot a alta resolución con fondo recalculado al bounding box de
      // los componentes (ver canvasEngine.exportSnapshot).
      let png = '';
      try { png = engine().exportSnapshot(); } catch (e) { console.error('[sugoi] exportSnapshot', e); }
      const circuit = biz().serializeCircuit(engine().getState());
      const currency = CONFIG.CURRENCY || 'USD';
      const bom = biz().calculateBOM(circuit, CONFIG.PRICE_TABLE || {}, CONFIG.BOM_MARKUP || 0, currency);

      const nombre = (document.getElementById('design-name') && document.getElementById('design-name').value) || designName;
      const fecha = new Date().toLocaleString();

      const bomRows = bom.items.length
        ? bom.items.map((it) => `<tr><td>${esc(it.name)}</td><td>${it.qty}</td><td>${money(it.unitPrice)}</td><td>${money(it.lineTotal)}</td></tr>`).join('')
        : '<tr><td colspan="4" class="m">Agrega componentes para calcular.</td></tr>';

      const pinoutHtml = esc(JSON.stringify(circuit.pinout || {}, null, 2));

      const win = window.open('', '_blank');
      if (!win) { logStatus('Permite ventanas emergentes para exportar.'); return; }
      win.document.write(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte · ${esc(nombre)}</title>` +
        `<style>` +
        `body{font-family:Arial,sans-serif;color:#0f172a;margin:24px;}` +
        `h1{font-size:20px;margin:0 0 4px;} .sub{color:#64748b;font-size:12px;margin-bottom:20px;}` +
        `h2{font-size:15px;border-bottom:2px solid #0f172a;padding-bottom:4px;margin:24px 0 10px;}` +
        `img.circuit{max-width:100%;border:1px solid #cbd5e1;border-radius:6px;}` +
        `table{border-collapse:collapse;width:100%;font-size:12px;}` +
        `th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;}` +
        `th{background:#f1f5f9;} tr.total td{font-weight:700;}` +
        `pre{background:#f8fafc;border:1px solid #e2e8f0;padding:10px;font-size:10px;overflow:auto;max-height:320px;}` +
        `@media print{ body{margin:12px;} .no-print{display:none;} }` +
        `.bar{display:flex;gap:10px;margin:6px 0 20px;flex-wrap:wrap;} ` +
        `.bar button{font:inherit;font-size:13px;font-weight:700;padding:10px 16px;border:0;border-radius:8px;cursor:pointer;} ` +
        `.bar .pdf{background:#dc2626;color:#fff;} .bar .png{background:#0f172a;color:#fff;} ` +
        `.bar .nota{font-size:12px;color:#64748b;align-self:center;}` +
        `</style></head><body>` +
        `<h1>Reporte de circuito · ${esc(nombre)}</h1>` +
        `<div class="sub">Generado el ${esc(fecha)} · Moneda: ${esc(currency)}</div>` +
        `<div class="no-print bar">` +
        `<button class="pdf" onclick="window.print()">Guardar como PDF</button>` +
        (png ? `<a download="circuito-${esc(nombre)}.png" href="${png}"><button class="png">Descargar PNG</button></a>` : '') +
        `<span class="nota">PDF: se abrirá el diálogo de impresión → "Guardar como PDF".</span>` +
        `</div>` +
        `<h2>Vista del circuito (PNG)</h2>` +
        (png ? `<img class="circuit" src="${png}" alt="Circuito">` : '<p>No hay lienzo disponible.</p>') +
        `<h2>Bill of Materials (BOM)</h2>` +
        `<table><thead><tr><th>Componente</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>` +
        `<tbody>${bomRows}</tbody>` +
        `<tfoot><tr class="total"><td colspan="3">Total (${esc(currency)})</td><td>${money(bom.total)}</td></tr></tfoot></table>` +
        `<h2>Mapeo de pines (pinout)</h2>` +
        `<pre>${pinoutHtml}</pre>` +
        `</body></html>`
      );
      win.document.close();
      logStatus('Reporte generado: estaban la imagen, el BOM y el pinout.');
    } catch (e) {
      logStatus('Error al exportar: ' + e.message);
    }
  }

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- Autosave (localStorage) ----------
  function autosave() {
    try {
      const snapshot = {
        name: designName,
        author,
        pinout: biz().serializeCircuit(engine().getState()),
        config: CONFIG,
      };
      localStorage.setItem('sugoi_autosave', JSON.stringify(snapshot));
    } catch (e) { /* sin almacenamiento */ }
  }

  // ---------- Guardar en MySQL ----------
  async function saveToDB() {
    try {
      const pinout = biz().serializeCircuit(engine().getState());
      const bom = biz().calculateBOM(pinout, CONFIG.PRICE_TABLE || {}, CONFIG.BOM_MARKUP || 0, CONFIG.CURRENCY || 'USD');
      // Miniatura ligera del lienzo (se guarda en la galería "Mis Esquemas").
      const thumbnail = captureThumbnail();
      const payload = {
        id: currentDesignId || null,
        nombre: designName,
        autor: author,
        pinout,
        bom,
        thumbnailBase64: thumbnail,
      };
      const saved = await services().saveDesign(payload);
      currentDesignId = saved.id;
      logStatus(`Diseño guardado (id: ${currentDesignId}) · sincronizado con Mis Esquemas.`);
    } catch (e) {
      logStatus('Error al guardar: ' + e.message);
    }
  }

  // Captura una miniatura del lienzo sin alterar la vista (pixelRatio 0.5).
  function captureThumbnail() {
    try {
      const st = engine().stage;
      if (!st) return null;
      const dataUrl = st.toDataURL({ pixelRatio: 0.5 });
      return dataUrl || null;
    } catch (e) {
      console.error('[sugoi] No se pudo capturar miniatura:', e);
      return null;
    }
  }

  // ---------- Modal de carga de diseños ----------
  function openLoadModal() {
    const modal = $('#load-modal');
    const list = $('#design-list');
    list.innerHTML = '<li>Cargando...</li>';
    modal.style.display = 'flex';
    services().listDesigns().then((designs) => {
      if (designs.length === 0) {
        list.innerHTML = '<li>No hay diseños guardados.</li>';
        return;
      }
      list.innerHTML = '';
      designs.forEach((d) => {
        const li = document.createElement('li');
        const fecha = d.fechaActualizacion || d.fechaCreacion || null;
        li.textContent = `${d.nombre}  [${d.autor || 'anonimo'}] — ${fecha ? new Date(fecha).toLocaleString() : ''}`;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => loadIntoCanvas(d.simulacionDisenoID));
        const delBtn = document.createElement('button');
        delBtn.textContent = 'x';
        delBtn.className = 'delete-btn';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await services().deleteDesign(d.simulacionDisenoID);
          openLoadModal();
        });
        li.appendChild(delBtn);
        list.appendChild(li);
      });
    }).catch((e) => {
      list.innerHTML = '<li>Error: ' + e.message + '</li>';
    });
  }

  function closeLoadModal() {
    $('#load-modal').style.display = 'none';
  }

  async function loadIntoCanvas(id) {
    try {
      const d = await services().getDesign(id);
      // Reconstruir el estado a partir del pinout guardado
      restoreFromPinout(d.pinoutJson);
      currentDesignId = d.simulacionDisenoID;
      designName = d.nombre;
      $('#design-name').value = d.nombre;
      logStatus(`Diseño cargado: ${d.nombre}`);
      closeLoadModal();
    } catch (e) {
      logStatus('Error al cargar: ' + e.message);
    }
  }

  // Reconstruye el lienzo completo desde el JSON guardado en BD.
  // `pinout` puede llegar como string JSON (desde la API) o como objeto.
  function restoreFromPinout(pinout) {
    try {
      const obj = typeof pinout === 'string' ? JSON.parse(pinout) : (pinout || {});
      engine().restore(obj);
      logStatus('Diseño reconstruido en el lienzo (nodos, wokwi-elements y cables Bézier).');
    } catch (e) {
      logStatus('Error al reconstruir: ' + e.message);
    }
  }

  // ---------- Gemini Debug ----------
  async function runGeminiDebug() {
    const code = getCode();
    const pinout = biz().serializeCircuit(engine().getState());
    const output = $('#assistant-output');
    output.innerHTML = '<p>Consultando a Claude...</p>';

    try {
      const r = await services().debugCircuit(pinout, code);
      output.innerHTML = marked ? marked(r.text) : '<pre>' + escapeHtml(r.text) + '</pre>';
      // resaltar bloques de error si hay
      if (r.text.includes('Cortocircuito') || r.text.includes('Error')) {
        output.classList.add('has-warning');
      } else {
        output.classList.remove('has-warning');
      }
    } catch (e) {
      output.innerHTML = '<p class="error">Error: ' + escapeHtml(e.message) + '</p>';
    }
  }

  // ---------- Organizar con IA ----------
  // Serializa el circuito, envía a Claude para validar/ordenar las conexiones
  // y aplica el resultado sobre el lienzo (reconstruye los cables).
  async function organizarConIA() {
    const btn = document.getElementById('btn-ai-layout');
    if (btn) { btn.disabled = true; btn.textContent = 'Pensando…'; }
    try {
      const code = getCode();
      const pinout = biz().serializeCircuit(engine().getState());
      const antes = (pinout.connections || []).length;
      const r = await services().manageConnections(pinout, code, 'acomoda y valida las conexiones del circuito');
      const ops = Array.isArray(r.connections) ? r.connections : [];
      if (ops.length > 0) {
        engine().rebuildConnections(ops);
      }
      const nota = (r.observaciones || '').trim();
      logStatus(
        `IA: conexiones organizadas (${antes} → ${ops.length} cables).` +
        (nota ? ` ${nota}` : '')
      );
      // Sincronizar con el diagrama/guía (conexiones + diseño).
      try { saveToDB(); } catch (e) { console.warn('[sugoi] guardado tras IA:', e); }
    } catch (e) {
      logStatus('Error al organizar con IA: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Organizar IA'; }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c]));
  }

  function logStatus(msg) {
    const el = $('#status-bar');
    if (el) el.textContent = msg;
    console.log('[sugoi]', msg);
  }

  // ---------- Inicializar editor ----------
  function initEditor() {
    const editor = $('#code-editor');
    // prefill si está vacío con código de ejemplo
    if (CONFIG.EDITOR === 'textarea') {
      if (!editor.value) editor.value = SAMPLE_CODE;
    }
  }

  // Carga un diseño guardado por id desde la API y lo aplica al lienzo.
  // Útil para abrir un diseño concreto desde Mis Esquemas (?diseno=ID).
  async function loadById(id) {
    if (!id) return;
    try {
      const d = await services().getDesign(id);
      currentDesignId = d.simulacionDisenoID;
      designName = d.nombre;
      const nameEl = $('#design-name');
      if (nameEl) nameEl.value = d.nombre;
      try { engine().clear(); } catch (e) {}
      restoreFromPinout(d.pinoutJson);
      try { window.dispatchEvent(new Event('stage:changed')); } catch (e) {}
      logStatus('Diseño cargado: ' + d.nombre);
    } catch (e) {
      logStatus('Error al cargar el diseño: ' + e.message);
    }
  }

  window.SUGOI = window.SUGOI || {};
  window.SUGOI.ui = { init, initEditor, renderBOM, renderPinout, getCode, loadById };
})();