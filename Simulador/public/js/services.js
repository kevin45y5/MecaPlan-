// ============================================================
// services.js  (CAPA DE SERVICIOS)
// Cliente de la API (CRUD de diseños MySQL + Gemini).
// El frontend siempre habla con el MISMO origen vía /api/**
// (el proxy nginx reenvía a simulacion_2D_api): sin CORS en prod.
// En dev standalone, app.js usa CORS con origen configurable.
// ============================================================
(function () {
  'use strict';

  const CONFIG = window.SUGOI_CONFIG || {};
  const base = (CONFIG.API_BASE || '').replace(/\/$/, '');

  async function request(path, options = {}) {
    const url = `${base}/api${path}`;
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
    const d = await request('/designs');
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
    const d = await request('/designs', { method: 'POST', body: JSON.stringify(payload) });
    return d.data;
  }

  async function deleteDesign(id) {
    const d = await request(`/designs/${id}`, { method: 'DELETE' });
    return d.data;
  }

  // ---------- Gemini ----------
  /**
   * Llama al tutor de depuración (proxy en el backend).
   * @param {object} pinout  JSON de serializeCircuit()
   * @param {string} code    código C++ Arduino
   */
  async function debugCircuit(pinout, code) {
    const d = await request('/gemini/debug', {
      method: 'POST',
      body: JSON.stringify({ pinout, code }),
    });
    return d.data; // { text }
  }

  window.SUGOI = window.SUGOI || {};
  window.SUGOI.services = {
    listDesigns,
    getDesign,
    saveDesign,
    deleteDesign,
    debugCircuit,
    base: base || '(mismo origen)',
  };
})();
