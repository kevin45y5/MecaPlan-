import { Router } from 'express';

// ============================================================
// Proxy de Gemini.
// La API key vive AQUÍ (variable de entorno del contenedor),
// nunca en el navegador. El frontend envía ficheros en crudo
// siempre a través del mismo origen (/api/gemini/...), evitando CORS.
// ============================================================
const router = Router();

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// POST /api/gemini/debug  { pinout, code }
// -> devuelve sugerencias del asistente (cortocircuitos, sintaxis, etc.)
router.post('/debug', async (req, res) => {
  const { pinout, code } = req.body || {};

  if (!API_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'GEMINI_API_KEY no configurada en el contenedor API.',
    });
  }

  const prompt = buildDebugPrompt(pinout, code);

  try {
    const response = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ ok: false, error: `Gemini: ${errText}` });
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
      '(Gemini no devolvió contenido)';

    res.json({ ok: true, data: { text } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function buildDebugPrompt(pinout, code) {
  const circuit = JSON.stringify(pinout || {}, null, 2);
  return `
Eres un tutor de electrónica y depuración de circuitos Arduino (sugoi_project).
Analiza el siguiente circuito y el código. Devuelve, en formato Markdown, un diagnóstico con:
1) Cortocircuitos o errores de conexión detectados en el pinout/redes (nets).
2) Errores de sintaxis o lógica del código C++.
3) Sugerencias de mejora (conexiones, resistencias limitadoras, best practices).

--- CIRCUITO (pinout JSON) ---
${circuit}

--- CÓDIGO ARDUINO ---
${String(code || '').slice(0, 30000)}
`;
}

export default router;
