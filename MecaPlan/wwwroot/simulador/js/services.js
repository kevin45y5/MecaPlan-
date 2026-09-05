// ============================================================
// services.js  (CAPA DE SERVICIOS) — adaptado a MecaPlan.
// Cliente de la API ASP.NET Core (CRUD de diseños + Gemini proxy).
// Mismo origen via /api/simulacion/** (Mismo saim). Sin CORS.
// ============================================================
(function () {
  'use strict';

  const CONFIG = window.SUGOI_CONFIG || {};
  const base = (CONFIG.API_BASE || '').replace(/\/$/, '');
  const proyectoId = (window.SUGOI_PROYECTO && window.SUGOI_PROYECTO.proyecto && window.SUGOI_PROYECTO.proyecto.ProyectoID) || 0;

  async function request(path, options = {}) {
    const url = `${base}/api/simulacion${path}`;
    const resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return data;
  }

  // ---------- Diseños ----------
  async function listDesigns() {
    const q = proyectoId ? `?proyectoId=${proyectoId}` : '';
    const d = await request(`/designs${q}`);
    return d.data || [];
  }

  async function getDesign(id) {
    const d = await request(`/designs/${id}`);
    return d.data;
  }

  /**
   * Guarda/actualiza el diseño actual.
   * @param {object} payload { id?, nombre, autor, pinout, bom }
   */
  async function saveDesign(payload) {
    const cuerpo = {
      id: payload.id || 0,
      proyectoId: proyectoId || (window.SUGOI_PROYECTO && window.SUGOI_PROYECTO.proyectoId) || 0,
      nombre: payload.nombre,
      autor: payload.autor,
      pinoutJson: JSON.stringify(payload.pinout || {}),
      codigo: payload.code || payload.codigo || null,
      thumbnailBase64: payload.thumbnailBase64 || null,
    };
    const d = await request('/designs', { method: 'POST', body: JSON.stringify(cuerpo) });
    return d.data;
  }

  async function deleteDesign(id) {
    const d = await request(`/designs/${id}`, { method: 'DELETE' });
    return d.data;
  }

  // ---------- Gemini ----------
  /**
   * Llama al tutor de depuración (proxy en el backend ASP.NET).
   * @param {object} pinout  JSON de serializeCircuit()
   * @param {string} code    código C++ Arduino
   */
  async function debugCircuit(pinout, code) {
    const d = await request('/gemini/debug', {
      method: 'POST',
      body: JSON.stringify({ pinout: JSON.stringify(pinout || {}), code }),
    });
    return d.data; // { text }
  }

  // ---------- AI: conexiones ----------
  /**
   * Pide a la IA (Claude) validar/corregir/ordenar las conexiones del lienzo.
   * @param {object} pinout   JSON de serializeCircuit()
   * @param {string} code     código C++ Arduino
   * @param {string} objetivo instrucción adicional del usuario (opcional)
   * @returns {Promise<{connections:Array, observaciones:string}>}
   */
  async function manageConnections(pinout, code, objetivo) {
    const d = await request('/ai/connections', {
      method: 'POST',
      body: JSON.stringify({
        pinout: JSON.stringify(pinout || {}),
        code: code || null,
        objetivo: objetivo || null,
      }),
    });
    return d.data; // { connections, observaciones }
  }

  window.SUGOI = window.SUGOI || {};
  window.SUGOI.services = {
    listDesigns,
    getDesign,
    saveDesign,
    deleteDesign,
    debugCircuit,
    manageConnections,
    base: base || '(mismo origen)',
  };
})();
