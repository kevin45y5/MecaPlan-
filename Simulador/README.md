# ⚡ sugoi_project · Simulador de Circuitos 2D

Simulador interactivo de circuitos electrónicos 2D al estilo **Tinkercad**, con:

- **Lienzo Konva.js** con grid, zoom, pan y **drag & drop** de componentes.
- **wokwi-elements** para el render SVG de placas y componentes.
- **Cableado** por terminales con **curvas de Bézier**.
- **Generador de Pinout JSON** en tiempo real (nodos, componentes, conexiones, **netlist por Union-Find**, mapeo de pines AVR y detección de cortocircuitos).
- **BOM (costo comercial)** con tabla de precios y margen.
- **Compilador avr-gcc (WASM)** vendido en el frontend + **AVR8js** para simular Arduino en el navegador.
- **Asistente Gemini** (proxy en el backend) para depurar esquemas y código.
- **Persistencia en MySQL** con API Node/Express + **DBeaver**.
- Despliegue con **Docker Compose** (3 contenedores).

---

## Arquitectura

| Contenedor | Función | Puertos |
|---|---|---|
| `simulacion_2D_db` | MySQL 8 (persistencia de diseños) | `3306` (DBeaver) |
| `simulacion_2D_api` | API Node/Express: CRUD + proxy Gemini | `3001` |
| `simulacion_2D_web` | Frontend estático (nginx) + proxy `/api` | `8080` |

```
┌──────────────┐   /api/**    ┌──────────────────┐   SQL    ┌──────────────┐
│ simulacion_  │ ───────────► │ simulacion_2D_   │ ───────► │ simulacion_  │
│ 2D_web (nginx)│ (proxy)     │ api (Express)    │          │ 2D_db (MySQL)│
│  :8080       │              │  :3001           │          │  :3306       │
└──────────────┘              └──────────────────┘          └──────────────┘
        ▲  Gemini API (backend, key segura)
```

El frontend **nunca** ve la `GEMINI_API_KEY` ni las credenciales de MySQL: todo pasa por la API.

---

## Estructura

```
.
├── docker-compose.yml
├── Dockerfile.web            # nginx: sirve public/ + vendor compilador/avr8js
├── nginx.conf                # proxy /api/** -> simulacion_2D_api:3001
├── .env.example              # plantilla de credenciales
├── mysql/
│   └── init.sql              # DB simulacion_2D + tabla designs (JSON)
├── server/                   # API Node/Express
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.js            # Express + CORS + rutas
│       ├── db.js             # pool MySQL
│       └── routes/
│           ├── designs.js    # CRUD de diseños
│           └── gemini.js     # proxy a la API de Gemini
└── public/                   # frontend (servido por nginx)
    ├── index.html
    ├── config.js             # placeholders de configuración de cliente
    ├── css/style.css
    ├── lib/avr8js.esm.js     # AVR8js (vendido, esm bundle)
    ├── compiler/             # avr-gcc-wasm (vendido, ~52MB) tools+assets
    └── js/
        ├── main.js           # bootstrap (ES module)
        ├── businessLogic.js  # Pinout JSON + BOM
        ├── canvasEngine.js   # Konva + wokwi + cables
        ├── simEngine.js      # AVR8js + compilador + loop
        ├── services.js       # cliente de la API
        └── ui.js             # paleta, paneles, acciones
```

---

## Requisitos

- Docker + Docker Compose v2
- (Opcional) DBeaver para inspeccionar la BD

---

## Rápido inicio

```bash
# 1. Copia el .env y rellena valores reales (clave de Gemini, passwords)
cp .env.example .env

# 2. Arranca los tres contenedores
docker compose up --build

# 3. Abre el simulador
#    http://localhost:8080

# 4. Conecta DBeaver a MySQL
#    Host: localhost   Puerto: 3306   Base: simulacion_2D
#    Usuario: sugoi    Contraseña: (MYSQL_PASSWORD del .env)
```

Para detener: `docker compose down`. Para detener y borrar datos: `docker compose down -v`.

> ⚠️ El primer arranque de la simulación compila el sketch con avr-gcc (WASM).
> Puede tardar unos segundos y requiere varios MB de `assets/` en memoria.

---

## Uso del simulador

1. **Paleta izquierda** → haz clic (o arrastra) un componente al lienzo.
2. **Cablear**: haz clic en un **terminal naranja** de un componente y luego en el terminal de destino. Se dibuja una curva de Bézier. Doble clic sobre un cable lo elimina.
3. **Zoom**: rueda del ratón. **Pan**: arrastra el fondo vacío.
4. **Código**: pestaña *Código* → escribe Arduino C++ → botón **▶ Ejecutar**.
   Los LEDs conectados a pines de salida se encienden según `digitalWrite(HIGH/LOW)`.
5. **BOM**: pestaña *BOM* → se recalcula el costo en vivo.
6. **Guardar/Cargar**: persisten el pinout y el BOM en MySQL.
7. **Depurar**: botón **🤖 Depurar** → el asistente Gemini analiza el circuito (netlist) y el código.

---

## Esquema MySQL (`simulacion_2D.designs`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | VARCHAR(40) PK | UUID |
| `nombre` | VARCHAR(255) | nombre del diseño |
| `autor` | VARCHAR(100) | default `anonimo` (escalabilidad multi-usuario) |
| `pinout_json` | JSON | serialización completa del lienzo |
| `bom_json` | JSON | desglose de costo |
| `created_at` / `updated_at` | TIMESTAMP | automáticos |

---

## Formato del Pinout JSON (ejemplo)

```json
{
  "version": "1.0",
  "nodes": [{ "id": "n5_d13", "compType": "arduino_uno", "pinName": "D13",
              "avrPort": 37, "bit": 5, "x": 220, "y": 40 }],
  "components": [{ "id": "n5", "type": "arduino_uno", "terminals": ["n5_d13"] }],
  "connections": [{ "id": "n9", "from": "n5_d13", "to": "n6_anode" }],
  "netlist": [{ "id": "net_n7", "nodes": ["n5_d13", "n6_anode"] }],
  "pinout": { "D13": { "nodeId": "n5_d13", "netId": "net_n7", "port": 37, "bit": 5 }, "5v": { "nodeId": "n5_5v", "netId": null } },
  "diagnostics": { "shorts": [], "unconnectedTerminals": [] }
}
```

---

## API REST

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | healthcheck |
| GET | `/api/designs` | lista resúmenes |
| GET | `/api/designs/:id` | diseño completo |
| POST | `/api/designs` | crear/actualizar (`id`, `nombre`, `autor`, `pinout`, `bom`) |
| DELETE | `/api/designs/:id` | eliminar |
| POST | `/api/gemini/debug` | `{ pinout, code }` → sugerencias del asistente |

---

## Notas de seguridad

- La **clave de Gemini** vive únicamente en `.env` → contenedor API.
- **CORS**: por defecto `*`; ajústalo con `CORS_ORIGIN` en `.env` para producción.
- El frontend es estático; no expone secretos.

---

## Notas técnicas sobre las librerías vendidas

- `public/lib/avr8js.esm.js`: bundle ESM de **avr8js@0.21.0** obtenido de jsDelivr (`/+esm`).
- `public/compiler/`: paquete **@horang-corp/avr-gcc-wasm@0.2.0** (compilador avr-gcc + binutils en WASM). Sus `tools/` y `assets/` se sirven desde el frontend; los archivos WASM se toman desde `assetsBase=/compiler/`. Si falta alguno, el contenedor web puede no arrancar la simulación.

Para regenerar `avr8js.esm.js` desde el CDN:

```bash
curl -L -o public/lib/avr8js.esm.js https://cdn.jsdelivr.net/npm/avr8js@0.21.0/+esm
```

Para actualizar el compilador:

```bash
cd public/compiler
npm pack @horang-corp/avr-gcc-wasm@0.2.0
tar -xzf horang-corp-avr-gcc-wasm-0.2.0.tgz
# mueve el contenido de package/ a public/compiler/
```
