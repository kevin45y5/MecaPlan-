import express from 'express';
import cors from 'cors';

import designsRouter from './routes/designs.js';
import geminiRouter from './routes/gemini.js';
import { connectWithRetry } from './db.js';

// ============================================================
// Servidor Express sugoi_project.
// - CORS habilitado (origen configurable por variable de entorno).
// - JSON body limitado para payloads de pinout/BOM.
// - Enrutado bajo /api/** (el frontend se sirve del MISMO origen
//   vía proxy nginx, así que CORS solo aplica a consumo directo).
// ============================================================
const app = express();

// PUNTO CLAVE #2: CORS
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));

app.use(express.json({ limit: '10mb' }));

// Healthcheck para debugging
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sugoi-simulacion-2d-api' }));

app.use('/api/designs', designsRouter);
app.use('/api/gemini', geminiRouter);

// Manejo central de errores
app.use((err, _req, res, _next) => {
  console.error('[express] Error:', err.message);
  res.status(500).json({ ok: false, error: err.message });
});

const port = Number(process.env.PORT || 3001);

connectWithRetry()
  .then(() => {
    app.listen(port, () => {
      console.log(`[api] sugoi_simulacion_2D_api escuchando en :${port}`);
    });
  })
  .catch((err) => {
    console.error('[api] No pudo arrancar:', err.message);
    process.exit(1);
  });
