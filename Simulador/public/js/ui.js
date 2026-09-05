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
      window.SUGOI.sim.stop();
      engine().resetLeds();
      logStatus('Simulación detenida.');
    });
    $('#btn-save').addEventListener('click', saveToDB);
    $('#btn-load').addEventListener('click', openLoadModal);
    $('#btn-clear').addEventListener('click', () => {
      if (confirm('¿Borrar todo el lienzo?')) {
        location.reload();
      }
    });
    $('#btn-debug').addEventListener('click', runGeminiDebug);

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
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ---------- Simulación ----------
  async function runSimulation() {
    const code = getCode();
    if (!code.trim()) {
      logStatus('Escribe código C++ primero.');
      return;
    }

    // 1) Siempre serializamos el circuito actual para pinout + BOM (funciona para cualquier placa)
    const pinout = biz().serializeCircuit(engine().getState());

    // 2) Intentar iniciar la simulación mediante el motor strategy actual
    logStatus('Compilando con avr-gcc (WASM)...');
    const res = await window.SUGOI.sim.start(code);

    if (res.ok) {
      // Éxito: lógica AVR (o la estrategia actual) corrió sin problemas
      logStatus(`Simulación en ejecución (flash: ${res.flashBytes} B).`);
      // Actualizar paneles con el nuevo pinout
      renderPinout();
      // Recalcular BOM usando los precios nuevos (USD)
      renderBOM();
    } else {
      // El strategy retornó un error/degradado (ESP32 sin emulación, RP2040 pending, etc.)
      // Mostramos el mensaje del strategy y aseguramos que el BOM siga visible
      const errMsg = res.error || 'Error desconocido en la simulación';
      
      // Si es degraded (simulación no disponible pero circuitos funcionan), informamos suavemente
      if (res.degraded) {
        logStatus(`⚠ ${errMsg}`);
        // Aún así actualizar BOM con los componentes (aunque la simulación fallen)
        renderBOM();
      } else {
        logStatus('Error: ' + errMsg);
        // Opcional: limpiar BOM o dejar el último conocido
        renderBOM();
      }
    }
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
      const payload = {
        id: currentDesignId || undefined,
        nombre: designName,
        autor: author,
        pinout,
        bom,
      };
      const saved = await services().saveDesign(payload);
      currentDesignId = saved.id;
      logStatus(`Diseño guardado en MySQL (id: ${currentDesignId})`);
    } catch (e) {
      logStatus('Error al guardar: ' + e.message);
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
        li.textContent = `${d.nombre}  [${d.autor}] — ${new Date(d.updated_at).toLocaleString()}`;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => loadIntoCanvas(d.id));
        const delBtn = document.createElement('button');
        delBtn.textContent = 'x';
        delBtn.className = 'delete-btn';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await services().deleteDesign(d.id);
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
      restoreFromPinout(d.pinout_json);
      currentDesignId = d.id;
      designName = d.nombre;
      $('#design-name').value = d.nombre;
      logStatus(`Diseño cargado: ${d.nombre}`);
      closeLoadModal();
    } catch (e) {
      logStatus('Error al cargar: ' + e.message);
    }
  }

  // Reconstruye el lienzo completo desde el JSON guardado en BD.
  function restoreFromPinout(pinout) {
    try {
      engine().restore(pinout || {});
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
    output.innerHTML = '<p>Consultando Gemini...</p>';

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

  window.SUGOI = window.SUGOI || {};
  window.SUGOI.ui = { init, initEditor, renderBOM, renderPinout, getCode };
})();