# MecaPlan — Versión estable (Documentación de cambios desde la versión base)
*******Unice._
Este documento recoge **todo el trabajo realizado sobre la versión base** de MecaPlan y lo deja documentado como **versión estable**.

> La versión base quedó descrita en `docs/mecaplan.md` (autenticación, BOM, workspace con canvas SVG, IA con Claude/Anthropic, y SQL Server Express con auth de Windows).
>
> Este documento describe **qué cambió** y la nueva configuración estable. Para el esquema completo de la base de datos ver **`docs/SCRIPT_BD.sql`**.

---

## 1. Resumen de cambios (desde la versión base)

| Área | Base | Versión estable actual |
|---|---|---|
| **Base de datos** | SQL Server Express (Windows, `localhost\SQLEXPRESS`, Trusted_Connection) | **SQL Server en Docker** (`mecaplan-sql`, puerto `1433`, usuario `sa`) |
| **IA** | Anthropic Claude (`claude-sonnet-4-5`) | **Google Gemini** (`gemini-3.6-flash`) |
| **IA: cliente** | `AnthropicChatClient.cs` | `GoogleGeminiChatClient.cs` (nuevo) |
| **IA: salida extra** | solo `{codigo, conexiones_canvas}` | + `instrucciones` y `pasos_ensamblaje` (para la Guía) |
| **Canvas** | SVG propio (`workspace.js`) | **ReactFlow** (`@xyflow/react` v12, subproyecto Vite) |
| **Persistencia del canvas** | no se guardaba la posición | se guardan **posición de nodos** y **conexiones** en BD |
| **Vista nueva** | — | **Guía de Ensamblaje** (`/Proyectos/Guia/{id}`) |
| **Formulario crear** | cualquier texto se volvía componente | se ignoran frases de "no tengo nada"; campos marcados como opcionales |

---

## 2. Base de datos en Docker (SQL Server)

### 2.1 Contenedor

- **Imagen:** SQL Server (Linux) con herramientas `mssql-tools18`.
- **Contenedor:** `mecaplan-sql`.
- **Puerto:** `1433`.
- **Usuario:** `sa`.
- **Contraseña:** `MecaPlan2026!Sql`.
- **Base de datos:** `MecaPlanDB`.

> Hay un segundo contenedor abandonado (`mecaplan_sql`, puerto `15733`) que **no se usa**: rechaza la contraseña. Ignorarlo.

### 2.2 Cadena de conexión (`appsettings.json`)

```
Server=localhost,1433;Database=MecaPlanDB;User ID=sa;Password=MecaPlan2026!Sql;TrustServerCertificate=True;
```

### 2.3 Cómo levantar / consultar

```powershell
# Iniciar el contenedor
docker start mecaplan-sql

# Consultar con sqlcmd dentro del contenedor
docker exec mecaplan-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "MecaPlan2026!Sql" -C -d MecaPlanDB -Q "SELECT @@VERSION;"
```

### 2.4 Esquema y script

El **script completo de creación de la BD** está en **`docs/SCRIPT_BD.sql`** (tablas, PK, FK, CHECK, índice único de Email, seed de componentes y las instrucciones para aplicarlo con `docker cp` + `sqlcmd`).

Tablas (6):

- `Estudiantes`
- `Proyectos`
- `Componentes`
- `ProyectoComponentes`
- `PasosEnsamblaje`
- `Diagnosticos`

### 2.5 Columnas nuevas en `Proyectos`

Desde la versión base se añadió (además de las ya documentadas en `mecaplan.md`):

| Columna | Uso |
|---|---|
| `InstruccionesGeneradas` | Texto de la IA: qué se conecta con qué (para la Guía) |
| `PosicionesCanvas` | JSON con la posición (x, y) de cada nodo en el canvas ReactFlow |

Se agregó mediante `ALTER TABLE Proyectos ADD PosicionesCanvas nvarchar(max) NULL;`.

> Nota: la app **no** crea la base automáticamente (en Development solo valida conexión con `CanConnectAsync`). La BD debe existir (script `docs/SCRIPT_BD.sql`).

---

## 3. Cambio de API: Anthropic Claude → Google Gemini

### 3.1 Cliente nuevo

`Services/GoogleGeminiChatClient.cs` implementa `IAiChatClient`:

- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Header de autenticación: `x-goog-api-key`
- Payload: `system_instruction` + `contents`
- Lee la respuesta de `candidates[0].content.parts[].text`
- Reutiliza `OpenAiChatClient.ExtractJson` para extraer el JSON.

### 3.2 Registro (`Program.cs`)

```csharp
builder.Services.AddHttpClient<IAiChatClient, GoogleGeminiChatClient>(...);
```

Reemplaza al antiguo `AnthropicChatClient`.

### 3.3 Configuración

`appsettings.json`:

```json
"Ai": {
  "Provider": "Google",
  "ApiKey": "",
  "Endpoint": "",
  "Model": "gemini-3.6-flash",
  "TimeoutSeconds": 180
}
```

La **API key** se guarda en **`appsettings.Development.json`** (`Ai:ApiKey`). **No debe subirse a un repositorio público.**

### 3.4 Detalles técnicos importantes

- **Modelo:** `gemini-3.6-flash`. Los modelos 2.x devuelven **401** con claves de tipo `AQ.` → usar siempre el modelo flash moderno.
- La primera clave probada era inválida (401/400); la válida respondió `ok` tras habilitar la **Gemini API** en el proyecto de Google Cloud.

---

## 4. IA: instrucciones + pasos de ensamblaje (nuevo)

La IA ahora genera más salida, usada por la **Guía de Ensamblaje**:

- `Models/Ai/GeneracionAi.cs`: `TutorProyectoAi` con `instrucciones` y `pasos_ensamblaje` (nueva clase `PasoEnsamblajeAi` con `titulo`, `descripcion`).
- `Services/TutorIngenieriaPrompt.cs`: el JSON solicitado ahora incluye ambos campos.
- `Services/GeneradorProyectoService.GenerarCodigoYPasosAsync`:
  - guarda `InstruccionesGeneradas` en el proyecto,
  - borra y recrea los `PasosEnsamblaje` desde `tutor.PasosEnsamblaje`.

> Los proyectos creados **antes** de este cambio tienen `InstruccionesGeneradas`/`PasosEnsamblaje` vacíos: se llenan al **reconfirmar el BOM** o al crear un proyecto nuevo.

---

## 5. Vista nueva: Guía de Ensamblaje

- **Ruta:** `GET /Proyectos/Guia/{id}` (`ProyectosController.Guia` + `CrearGuia`).
- **Vista:** `Views/Proyectos/Guia.cshtml`.
- **Modelo:** `Models/ViewModels/GuiaEnsamblajeViewModel.cs` (`GuiaEnsamblajeViewModel`, `GuiaComponenteItem`, `GuiaConexionItem`).
- **Enlace:** botón **"Guía de ensamblaje"** en la barra superior del Workspace.

Contenido de la vista:

1. **Componentes que necesitas** — tarjetas con imagen, nombre, descripción de uso, motivo "Para este proyecto" y badge "En inventario/Faltante".
2. **Qué se conecta con qué** — texto `InstruccionesGeneradas` de la IA.
3. **Cómo se conecta (qué pin va a qué pin)** — lista de `ConexionesCanvas` con el color del cable pintado.
4. **Tutorial paso a paso** — de la tabla `PasosEnsamblaje`.
5. **Alimentación y recomendaciones** — se adapta al nivel de dificultad.
6. **Código C++** — el mismo `CodigoGenerado` (con nota: es el mismo que el canvas).

Funciones del controlador que habilitan la guía:

- `ParsearConexiones(string?)` → `List<GuiaConexionItem>` (lea `origen`/`destino`/`color_cable`; `DividirEndpoint` separa componente y pin por `_`).
- `ObtenerUrlImagenPorNombre(string)` → SVG por categoría (carpeta `wwwroot/images/componentes/`).
- `ObtenerDescripcionPorNombre(string)` → descripción de uso por tipo.
- `CargarProyectoDelUsuarioAsync` ahora incluye `.Include(p => p.PasosEnsamblaje)`.

### Mejoras visuales (aplicadas sobre la guía)

- Imágenes de componentes sobre **fondo oscuro fijo** (`#0f172a`) para que resalten en ambos temas.
- Textos con variables de tema de la app (`--auth-ink`, `--auth-card-bg`, `--auth-border`, `--auth-muted`), definidas en `wwwroot/css/auth.css`.
- Badge de inventario verde/naranja al final de cada tarjeta.
- Secciones condicionadas por nivel: **Básico** (recomendaciones simples), **Intermedio** (+ cómo conectar señales y "desconecta la fuente"), **Avanzado** (+ pines PWM, consumo y polaridad). Ver propiedades Razor `EsIntermedioOMas` / `EsAvanzado` en `Guia.cshtml`.

---

## 6. Canvas con ReactFlow (migración del SVG propio)

### 6.1 Decisión

Se migró el canvas **SVG propio** (`wwwroot/js/workspace.js`) a **ReactFlow** (`@xyflow/react` v12). ReactFlow moderno no tiene una build UMD limpia (React 19 eliminó las UMD), por lo que se integró con un **subproyecto Vite** que compila a un bundle que la vista .NET carga.

### 6.2 Subproyecto Vite

Carpeta: `client/`

| Archivo | Rol |
|---|---|
| `package.json` | dependencias: `@xyflow/react`, `react` 18, `react-dom` 18; `vite` + `@vitejs/plugin-react` |
| `vite.config.js` | `base: '/canvas/'`, `outDir: '../wwwroot/canvas'`, `emptyOutDir: true`; entrada única `src/main.jsx` → `assets/canvas.js` |
| `src/main.jsx` | App ReactFlow: nodos, edges, edición, guardar |
| `src/canvas.css` | estilos de nodos/toolbar (usa variables `--auth-*`) |

**Build / desarrollo:**

```powershell
cd client

# Instalar dependencias (solo la primera vez)
npm install

# Build de producción -> escribe en wwwroot/canvas/ (assets/canvas.js + main.css)
npm run build

# Desarrollo con recarga en caliente
npm run dev      # servidor en http://localhost:5173 (solo para iterar el canvas)
```

### 6.3 Cómo se integra en la vista

`Views/Proyectos/Workspace.cshtml`:

- Contenedor: `<div id="reactFlowRoot">` dentro de `#workspaceCanvas` (reemplaza al SVG/nodos viejos).
- `@section Scripts` carga:
  - `<link rel="stylesheet" href="~/canvas/assets/main.css" />`
  - `<script type="module" src="~/canvas/assets/canvas.js"></script>`
  - `workspace.js` (sigue manejando Código/Diagnóstico/resizers; su parte de canvas retorna sin hacer nada porque ya no existen `#workspaceNodes`/`#workspaceWires`).
- Datos pasados al JS mediante `<script type="application/json">`:
  - `workspaceComponentes` → `[{nombre, enInventario}]`
  - `workspaceConexiones` → `[{origen, destino, color_cable}]`
  - `workspacePosiciones` → `[{nombre, x, y}]`

### 6.4 Funcionalidad del canvas

- **Nodos:** un nodo por componente único (de `ComponentesJson` + extremos de las conexiones). Verde = en inventario, naranja = faltante.
- **Arrastrar nodos:** libre, se persiste la posición.
- **Crear conexiones:** arrastrar desde el punto azul (salida) al punto verde (entrada) de otro nodo.
- **Borrar conexiones:** seleccionar el cable y borrarlo.
- **Mini-mapa, controles de zoom y fondo cuadriculado** (componentes `MiniMap`, `Controls`, `Background` de ReactFlow).
- **Guardar:** botón "Guardar" o **Ctrl+S**. Persiste vía `POST /Proyectos/GuardarCanvas/{id}`.

### 6.5 Persistencia (backend)

- Nueva columna `Proyectos.PosicionesCanvas` (nvarchar max).
- `Models/Proyecto.cs`: propiedad `PosicionesCanvas`.
- `Models/ViewModels/WorkspaceViewModel.cs`: `PosicionesJson`.
- `ProyectosController.CrearWorkspace`: serializa `PosicionesJson`.
- Nueva acción **`POST /Proyectos/GuardarCanvas/{id}`** (`[HttpPost]`, anti-forgery): recibe `conexiones` y `posiciones` (JSON) y los guarda en `ConexionesCanvas` y `PosicionesCanvas`.
- Los edges nuevos (sin `data`) se guardan con origen/destino `"Componente_P"`; los cargados de BD conservan su pin original.

---

## 7. Formulario "Crear proyecto": frases de "no tengo nada"

`Services/InventarioParser.cs`

- Añadida lista `FrasesVacio`: `ninguno`, `nada`, `no tengo`, `no tengo ni uno`, `no tengo materiales`, `carezco`, `sin materiales`, etc.
- `EsFraseVacia(texto)` normaliza (quita acentos/símbolos) y, si la frase coincide, **descarta** la parte → ya **no** se agregan como componente.
- Aplicado en `ParsearLineas`.

`Views/Proyectos/Crear.cshtml`

- Los campos "Materiales que ya tienes" y "Materiales requeridos" ahora muestran **"(opcional)"** en el label y placeholders más claros ("Si no tienes nada, deja esto vacío").

---

## 8. Página de Diagnóstico / Soporte IA (chatbot rediseñado)

Nueva página dedicada **`GET /Diagnosticos`** (`DiagnosticosController.Index`) como chatbot de soporte por proyecto, con un rediseño **modo oscuro estilo Gemini/AI Studio** (sin Bootstrap).

### 8.1 Vista y layout

- **Vista:** `Views/Diagnosticos/Index.cshtml` (usa `@model DiagnosticoIndexViewModel`).
- **JS:** `wwwroot/js/diagnostico.js`.
- **CSS:** `wwwroot/css/app.css` (bloque `.dia-*`: variables `--dia-*` con fondo `#1b1b28`, burbujas, badges, offcanvas).
- El layout **no carga Bootstrap** (solo `auth.css`, `app.css`, jQuery, `theme.js`, `site.js`). El offcanvas/cajón se hace **en CSS puro**.

### 8.2 Secciones de la vista

- **Barra superior** (`.dia-topbar`): título, texto introductorio y selector de **Proyecto** (solo proyectos activos del estudiante). Incluye `<input type="hidden" id="diaToken">` con el token anti-forgery para las llamadas AJAX.
- **Cajón lateral / historial** (`#diaOffcanvas`, clase `.dia-offcanvas` + `.open`): se desliza desde la izquierda con `translateX(-100%)`. Tiene overlay (`#diaOverlay`), botón `✕` para cerrar (`diaCerrarHistorial()`) y el contenido en `#offHistorialContent` con el aviso vacío `#offhistEmpty`.
- **Chat a ancho completo** (`main.dia-chat-main`, `width:100%`): encabezado con título y botón **"📋 Ver Historial"** (`diaAbrirHistorial()`), área de mensajes `#diaChat` y form con textarea `#diaMensaje` + botón `➤`.

### 8.3 Funcionalidad del JS

- Envío con `Enter` (texto multilínea con `Shift+Enter`), textarea que crece (`autoGrow`).
- Burbujas de usuario (derecha, morada `#6366f1`) e IA (izquierda, `#252538` con avatar ⚙).
- Indicador de escritura "typing" de 3 puntos mientras responde la IA.
- Render de respuestas de la IA con un mini-markdown (negrita **, código ``, listas `-`/`numero`, encabezados `#`).
- Saludo inicial del agente una sola vez.
- `marcarResuelto(id)`: llama a **`POST /Diagnosticos/Resolver?id=`**; si falla, restaura el botón y NO borra la tarjeta.

### 8.4 Saludos (sin llamar a la IA)

`DiagnosticosController.EsSaludo(string)` detecta saludos (hola, buenas, hey, hi, etc.) **solo si el mensaje tiene ≤ 4 palabras**, para no confundir un saludo con una descripción de falla ("hola el motor no gira" → se diagnostica). Si es saludo, `Enviar` responde al instante con `diagnosticoId: 0` (no se guarda en BD ni se llama a la API).

Capas de respaldo:
- `Services/DiagnosticoIngenieriaPrompt.ConstruirSystem`: le indica a la IA responder breve y amistoso si el mensaje no describe una falla.
- JS: el saludo inicial solo se muestra una vez.

### 8.5 Historial

- **`GET /Diagnosticos/Historial?proyectoId=`**: lista los `Diagnosticos` del proyecto (solo de ese estudiante y activo) ordenados por `FechaReporte` desc. Devuelve JSON `{ proyectoId, items }`.
- Cada item muestra: badge **Pendiente** (ámbar) / **Resuelto** (verde), fecha, descripción de la falla y acciones: **"Ver en el chat"** (carga la falla+solución en el chat) y **"Marcar como resuelto"** (si está pendiente).
- **`POST /Diagnosticos/Resolver/{id}`**: valida que el diagnóstico pertenezca al estudiante y a un proyecto activo, y setea `FechaResolucion`.

### 8.6 Endpoint principal del chat

- **`POST /Diagnosticos/Enviar`** (`[FromBody] EnviarDiagnosticoRequest`): valida proyecto + estudiante activo, carga los `ProyectoComponentes`, y llama a la IA con `DiagnosticoIngenieriaPrompt`. Guarda el diagnóstico en `Diagnosticos` (tipo "Consulta chatbot") y devuelve `{ diagnosticoId, respuesta }`. Si la IA falla devuelve `502`.

### 8.7 Modelos

- `Models/ViewModels/DiagnosticoIndexViewModel.cs`: `DiagnosticoIndexViewModel` + `ProyectoSelectorItem`; `EnviarDiagnosticoRequest` (`ProyectoID`, `Mensaje`).

---

## 9. Vista nueva: Simulador de Circuitos 2D (estilo Tinkercad)

### 9.1 Qué es

Página **alternativa al Workspace ReactFlow** (`/Simulador/Index?id={proyectoId}`) que integra el
prototipo `pruba-simulacion` (Konva + wokwi-elements + avr8js) como **página Razor aislada**
(`Layout = null`), para no chocar con el layout ReactFlow de la app. Mantiene la navegación
MecaPlan (Volver al Workspace, Guía) en su barra superior mínima.

**Genera automáticamente** el circuito 2D (componentes + cables Bézier) a partir de los datos
reales del proyecto:
- **BOM** (`ProyectoComponentes`) → mapea cada componente a un `compType` del simulador.
- **Conexiones** (`ConexionesCanvas` guardado en el Workspace) → auto-cableado.
- **Código** (`CodigoGenerado`) → pre-cargado en el editor.

### 9.2 Arquitectura

- **Backend C#:** `Controllers/SimuladorController.cs` (página `Index` + API REST + proxy Gemini).
- **Modelo:** `Models/SimulacionDiseno.cs` + tabla `SimulacionDisenos` (ver `docs/SCRIPT_BD.sql`).
- **ViewModel:** `Models/ViewModels/SimuladorIndexViewModel.cs`.
- **Frontend (adaptador):** `wwwroot/simulador/js/programaSimulador.js` — mapea BOM→compType,
  hace autolayout determinista y resuelve las conexiones del Workspace a cables. Llama a
  `engine().restore(pinout)`.
- **Vista:** `Views/Simulador/Index.cshtml`.
- **Assets vendorizados (offline, sin CDN):**
  - `wwwroot/lib/konva/konva.min.js` (Konva 9.3.11).
  - `wwwroot/lib/wokwi/wokwi-elements.bundle.js` (wokwi-elements 0.48.3).
  - `wwwroot/simulador/` (copia del frontend del prototipo).
  - `C:\Users\unice\proyectos\MecaPlan\MecaPlan\Simulador\` (referencia completa del prototipo,
    incl. compiler avr-gcc WASM ~53MB).

> Nota: el `compiler/` (avr-gcc WASM, ~53MB) solo se carga al pulsar **▶ Ejecutar** (simulación AVR).
> La decisión de estabilidad es "vista visual primero"; la vista y el auto-cableado funcionan sin él.

### 9.3 API REST (`/api/simulacion/**`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/simulacion/designs?proyectoId=` | Lista diseños guardados del proyecto |
| GET | `/api/simulacion/designs/{id}` | Detalle de un diseño |
| POST | `/api/simulacion/designs` | Crear/actualizar diseño (`{ id?, proyectoId, nombre, autor, pinoutJson, codigo }`) |
| DELETE | `/api/simulacion/designs/{id}` | Borrado lógico (soft delete) |
| POST | `/api/simulacion/gemini/debug` | Proxy del asistente Gemini (`{ pinout, code }`) |

Todo validado contra la cuenta del estudiante autenticado.

### 9.4 Mapeo BOM → componente del simulador

`programaSimulador.js` define un catálogo `MAPEO` (por regex sobre el nombre del componente).
Ejemplos relevantes del proyecto `dispendador de agua`:
`Arduino Uno → arduino_uno`, `Bomba de agua → bomba_agua`, `Sensor de humedad → sensor_humedad`,
`Módulo relé → relay`, `Fuente de alimentación → fuente_5v`.

### 9.5 Pines del Arduino Uno ampliados

Se **expandió `COMPONENT_DEFS.arduino_uno`** en `canvasEngine.js` de 8 terminales a 27:
D0–D13, A0–A5, AREF, 3V3, VIN, 5V, GND (x2) y RST, con mapeo AVR (`avrPort`/`bit`). Esto permite
que los pines generados por la IA (D9, VCC…, etc.) se conecten.

### 9.6 Fix de índices de terminales duplicados

Se refactorizó `mkRow`/`mkCol` en `canvasEngine.js` para aceptar `base` e `idPrefix` y se
actualizaron todos los defs con `.concat(...)` (arduino_mega, esp32, attiny, rp2040, neopixel,
dip_switch, relay, lcd2004, rtc) para que los **índices e ids de terminal sean únicos** dentro de cada
componente. Sin esto, `restore()` no reconstruía correctamente los cables (colisiones de nodos).

### 9.7 Auto-generación en el navegador

Al cargar `/Simulador/Index`, la vista inyecta `window.SUGOI_PROYECTO` y un script espera a que el
engine esté listo y llama a `window.SUGOI.adaptador.autoGenerar()`, que construye el `pinout` y lo
aplica con `engine().restore(pinout)`. También pre-carga `CodigoGenerado` en el editor.

### 9.8 Acceso

- Desde el **Workspace** (`Views/Proyectos/Workspace.cshtml`): botón **"Vista 2D"** en la toolbar.
- Desde el **Simulador**: botones **"← Volver al Workspace"** y **"Guía"**.

### 9.9 Visual con las imágenes de la guía + componentes no registrados

- **`canvasEngine.js` / `programaSimulador.js`**: el simulador 2D usa **la MISMA librería de
  imágenes que la vista `Guia.cshtml`** — los SVG por categoría de `wwwroot/images/componentes/`
  (`microcontrolador.svg`, `sensor.svg`, `actuador.svg`, `fuente.svg`, `cable.svg`,
  `placeholder-component.svg`). `programaSimulador.js::imagenComponente()` replica la lógica de
  `ObtenerUrlImagenPorNombre()` del backend y etiqueta cada componente del pinout con su `imagen`;
  `createWokwiElement()` renderiza ese `<img>` (el `<wokwi-*>` real y el SVG propio quedan como
  reserva). Así **todo** componente muestra su imagen, igual que en la guía.
- **`canvasEngine.js`**: la vista nueva es **visual-first** (sin simulación): lo importante son los
  componentes con su imagen y las **conexiones de jumpers funcionales** (clic en terminal → clic en
  terminal dibuja el cable; al pulsar Guardar persiste vía API).
- **`programaSimulador.js`**: un BOM sin mapeo ya no se descarta: se genera como tipo **`generico`**
  (icono por categoría + nombre real como etiqueta), de modo que **ningún componente se pierde**.
- **Vista alternativa en `Views/Proyectos/Workspace.cshtml`**: el centro del encabezado (donde antes
  decía "Canvas") ahora tiene un **interruptor de modo `Diagrama | 2D`**; el Simulador tiene el
  mismo interruptor (`meca-mode-switch`) para volver al Workspace. Integración coherente en ambos
  extremos.
- Verificado con proyecto 1006 y con el proyecto de prueba **2000 "Riego automatico inteligente"**
  (creado con la cuenta real `unice891@gmail.com`): 7/7 componentes con su imagen de la guía y
  **10/10 conexiones de jumpers** cableadas correctamente.

### 9.10 Refinamientos de UX del Simulador 2D

4 características añadidas para mejorar la experiencia del simulador (manteniendo **0 advertencias**
de compilación en `dotnet build` y validando el proyecto 2000):

1. **Badges sobre los cables (jumpers).** Cada conexión muestra una píldora `Konva.Label` en su punto
   medio con `[pin origen] → [pin destino]` (p. ej. `D9 → VCC`). `drawWire()` crea el badge y lo
   registra en `wireBadges`; `refreshWireBadges()` lo reposiciona al arrastrar componentes (hook del
   `dragmove`) y `removeWire()`/`clear()` lo limpian. Se usa `wirePinLabel()` para un texto legible
   (pin real o rol VCC/GND).

2. **BOM de cables automático.** `businessLogic.js::calculateBOM()` añade automáticamente la línea
   **"Cables de conexión (jumper)"** (SO $0.20 c/u) cuando `circuit.connections.length > 0`,
   cantidad = nº de cables dibujados. La paleta **no contiene** ningún ítem "Cable Jumper" arrastrable
   (son las conexiones dibujadas entre terminales), por lo que no se eliminó ningún elemento.

3. **Animación de flujo de señal (Ejecutar/Detener).** El botón **▶ Ejecutar** ya no depende de la
   compilación AVR (WASM): activa el modo visual "energizado" — `startFlowAnimation()` recorre los
   cables con trazo discontinuo animado, coloreados por rol (VCC ámbar `#fbbf24`, GND verde
   `#34d399`, señal azul `#60a5fa`). **■ Detener** los restaura al azul estático vía
   `stopFlowAnimation()`. Sigue refrescando pinout y BOM.

4. **Exportación PNG + reporte PDF.** Nuevo botón **📄 Exportar** (`#btn-export`). `ui.js::exportReporte()`
   captura el lienzo como PNG de alta resolución vía `engine().exportSnapshot()`, calcula BOM y
   pinout, y abre una ventana imprimible con la imagen + tablas BOM/pinout; el usuario guarda como
   PDF mediante Imprimir → "Guardar como PDF".

### 9.11 Integración del diseño del proyecto (parte nativa de la web) + fixes críticos de exportación

El Simulador 2D dejó de ser una página aislada con tema "sugoi" propio (`Layout = null`) para
**verse como parte nativa de la web MecaPlan**:

- `Views/Simulador/Index.cshtml` ahora usa **`Layout = "_Layout"`** con `ViewData["Workspace"] = true`
  (igual que el Workspace): hereda el **header/nav MecaPlan**, el toggle de tema claro/oscuro, la fuente
  Inter y el `main` a pantalla completa. Se sustituyó la topbar "meca-topbar" por una **`sim2d-topbar`**
  integrada (estilo workspace) con el interruptor `Diagrama | 2D`, las acciones del simulador
  (Ejecutar/Detener/Guardar/Cargar/Limpiar/Asistente/**📄 Exportar**) y el enlace a la Guía.
- Nuevo **`wwwroot/simulador/css/integracion.css`** (cargado tras `style.css`): reasigna los tokens del
  simulador (`--bg`, `--panel`, `--border`, `--text`, `--accent`, …) a los tokens de la aplicación
  (`--auth-bg`, `--auth-card-bg`, `--auth-divider-color`, `--auth-ink`, `--auth-brand-color`, …), de modo
  que **todo** (paleta, inspector, pestañas, BOM, modal, botones) se adapta automáticamente al tema
  claro/oscuro de la web. Se mantiene el lienzo Konva oscuro como área técnica de dibujo.

**Fixes críticos de exportación y rehidratación** (aplicados en `canvasEngine.js`/`ui.js`):

1. **CORS en imágenes (evita canvas "tainted").** En `createWokwiElement()`, `img.crossOrigin = 'Anonymous'`
   se asigna **antes** de `img.src`, para que `stage.toDataURL()` pueda renderizar las placas y sensores en
   el PDF sin que el canvas se marque como "tainted".
2. **Purgado agresivo de JSON al rehidratar.** `restore()` filtra de forma destructiva
   (`estado.components = estado.components.filter(c => c.tag !== 'wokwi-cables' && c.name !== 'Cables de
   conexión Jumper')`) junto con sus nodos y conexiones huérfanas, eliminando bloques fantasma de
   diseños guardados previamente **antes** de instanciar el estado.
3. **Exportación de área completa con pixelRatio 2.** Nuevo `engine().exportSnapshot()`, que recalcula el
   **grid/fondo al bounding box** de los componentes (`drawGridForExport()`/`componentBounds()`) y llama
   `stage.toDataURL({ pixelRatio: 2, width: stage.width(), height: stage.height() })`, restaurando el grid
   normal tras capturar.

---

## 10. Estado de ejecución y comandos útiles

### Arrancar la app (Development)

```powershell
dotnet run --launch-profile http        # en http://localhost:5120
dotnet run --launch-profile http --no-build
```

- La app corre en `http://localhost:5120` (perfil `http`).
- En Development, si SQL Server (Docker) no responde, la app **no arranca** (lanza excepción al conectar).

### Detener antes de compilar (el proceso bloquea el .exe)

```powershell
Get-Process -Name dotnet | Stop-Process -Force
dotnet build -c Debug
```

### Reconstruir el canvas tras cambios en `client/`

```powershell
cd client
npm run build
```

Luego volver a compilar/relanzar la app .NET (los assets versionados con `asp-append-version` se refrescan).

---

## 11. Cuenta de prueba / datos

- Email: `unice891@gmail.com`
- Proyectos de ejemplo: `dispensador de agua` (Básico), `dispensador de comida` (Básico e Intermedio).
- El password hash en `Estudiantes` es PBKDF2 SHA-256 (ver `Services/PasswordHasher.cs`): repetir "detalles de hash" de la doc base.

---

## 12. Archivos clave (nuevos / modificados en esta versión)

```
# Docker / conexión
appsettings.json                       # DefaultConnection -> Docker (1433), Ai -> Google Gemini
appsettings.Development.json           # Ai.ApiKey (Gemini) — NO subir

# IA
Services/GoogleGeminiChatClient.cs     # NUEVO: cliente Gemini
Services/TutorIngenieriaPrompt.cs      # prompt + instrucciones + pasos
Services/GeneradorProyectoService.cs   # guarda InstruccionesGeneradas y PasosEnsamblaje
Models/Ai/GeneracionAi.cs              # TutorProyectoAi + PasoEnsamblajeAi

# Guía de ensamblaje
Controllers/ProyectosController.cs     # Guia, CrearGuia, ParsearConexiones, ObtenerUrlImagenPorNombre, ObtenerDescripcionPorNombre, GuardarCanvas
Views/Proyectos/Guia.cshtml            # NUEVA vista
Models/ViewModels/GuiaEnsamblajeViewModel.cs
wwwroot/images/componentes/            # SVGs de componentes
wwwroot/css/app.css                    # CSS de la guía

# Página de Diagnóstico / Soporte IA (chatbot)
Controllers/DiagnosticosController.cs  # Index, Historial, Enviar, Resolver, EsSaludo
Services/DiagnosticoIngenieriaPrompt.cs # prompt del ingeniero IA (system) + ConstruirUsuario
Views/Diagnosticos/Index.cshtml        # NUEVA vista (offcanvas en CSS puro, chat full-width)
wwwroot/js/diagnostico.js              # lógica del chatbot + historial + offcanvas
Models/ViewModels/DiagnosticoIndexViewModel.cs  # DiagnosticoIndexViewModel + EnviarDiagnosticoRequest
wwwroot/css/app.css                    # bloque .dia-* (modo oscuro estilo Gemini)

# Canvas ReactFlow
client/                                # NUEVO subproyecto Vite + React + ReactFlow
wwwroot/canvas/                        # bundle generado (assets/canvas.js + main.css)
Views/Proyectos/Workspace.cshtml       # monta #reactFlowRoot y carga el bundle
Models/Proyecto.cs                     # + PosicionesCanvas
Models/ViewModels/WorkspaceViewModel.cs# + PosicionesJson
Data/ApplicationDbContext.cs           # (esquema; ver SCRIPT_BD.sql)

# Formulario
Services/InventarioParser.cs           # ignora "no tengo nada"
Views/Proyectos/Crear.cshtml           # campos "(opcional)"

# Simulador 2D (estilo Tinkercad)
Controllers/SimuladorController.cs     # NUEVO: Index + API /api/simulacion/** + proxy Gemini
Models/SimulacionDiseno.cs             # NUEVO: modelo de diseño guardado
Models/ViewModels/SimuladorIndexViewModel.cs # SimuladorIndexViewModel + DTOs de componente/conexión
Views/Simulador/Index.cshtml           # visitada como parte de la web: usa Layout = "_Layout" (Workspace) + topbar sim2d-topbar integrada (9.11)
Views/Proyectos/Workspace.cshtml       # + botón "Vista 2D"
wwwroot/simulador/                     # frontend del prototipo (config, css, js/, index.html)
wwwroot/simulador/css/integracion.css  # NUEVO: reasigna tokens --auth-* de la web al simulador (claro/oscuro) + layout (9.11)
wwwroot/simulador/js/programaSimulador.js # NUEVO: adaptador auto-generación + auto-cableado
wwwroot/simulador/js/canvasEngine.js   # badge de cables + animación (9.10); fixes: crossOrigin imágenes, purga restore(), exportSnapshot() pixelRatio 2 (9.11)
wwwroot/simulador/js/businessLogic.js   # calculateBOM: + línea "Cables de conexión (jumper)" automática (Feature 2)
wwwroot/simulador/js/ui.js              # run = animación de flujo visual; exportReporte() vía engine().exportSnapshot() (9.10/9.11)
Views/Simulador/Index.cshtml            # + botón #btn-export (Feature 4)
wwwroot/simulador/js/services.js        # adaptado a /api/simulacion/**
wwwroot/lib/konva/konva.min.js         # NUEVO: Konva 9.3.11 (offline)
wwwroot/lib/wokwi/wokwi-elements.bundle.js # NUEVO: wokwi-elements 0.48.3 (offline)
docs/SCRIPT_BD.sql                     # + tabla SimulacionDisenos
Simulador/                             # referencia completa del prototipo (compiler AVR WASM)
```

---

## 13. Pendientes / próximos pasos sugeridos

- Pines específicos por componente en el canvas (hoy cada nodo tiene un pin de entrada y uno de salida genéricos).
- Definir el color del cable al crear una conexión nueva en el canvas.
- Validar visualmente la Guía y el canvas con un proyecto recién generado (para ver el tutorial con datos de la IA).
- Mantener `client/` versionado y documentar el flujo de build en el README principal si se comparte el repo.
- Diagnóstico: considerar streaming de la respuesta de la IA (hoy se muestra completa al terminar).
- Diagnóstico: opción de descargar/exportar el historial.
- Simulador 2D: **▶ Ejecutar** ahora activa el régimen visual "energizado" (animación de flujo por los
  cables); la simulación AVR real (avr-gcc WASM) quedó fuera del flujo principal para mantener la
  vista visual-first (ver 9.10).
- Simulador 2D: la coincidencia de pines entre el Workspace ReactFlow y el simulador es heurística
  (por label/role/número); puede requerir ajustes para proyectos con nomenclatura de pines distinta.
- Simulador 2D: el cableado de `protoboard` y de pines tipo "genérico" de otros microcontroladores
  aún no se resuelve para todos los casos del Workspace.

---

## 14. Revisión visual del Simulador 2D + Galería "Mis Esquemas" + Asistente IA global

Bloque de trabajo sobre el **frontend visual** del Simulador 2D (usuario actuando como Frontend
Tech Lead). Incluye fixes visuales críticos, una galería unificada de diseños y la reutilización
del chat IA en toda la app. Validado con `dotnet build` (**0 errores / 0 advertencias**), `node --check`
de los JS servidos y una prueba AUTENTICADA completa (login real + `GET /Esquemas` + `/Simulador/Index?id=2000`
+ ciclo API guardar→listar→eliminar en `/api/simulacion/designs`).

### 14.1 Fixes visuales del lienzo (canvasEngine.js)

- **Grid infinito full-bleed.** `init()` ahora lee `container.offsetWidth/offsetHeight`; `drawGrid()`
  fue reescrito: un `Konva.Rect` de fondo cubre todo el viewport y las líneas se anclan al MUNDO
  (múltiplos de `GRID`) teniendo en cuenta `stage.position()` y `stage.scaleX()`; el rango visible se
  calcula como `screen = pos + world*scale`. Se redibuja en pan/zoom y se añadió
  `window.addEventListener('resize', resizeStage)` + **ResizeObserver** que actualiza el tamaño del
  stage y redibuja. El lienzo ya cubre toda la pantalla sin bordes sobresalientes.
- **Ocultar cajas punteadas de componentes NO eléctricos.** En `buildComponent()`, si el componente
  no tiene `terminals` (`isElectrical === false`), el `marco` (rect dashed `#2b6cb0`) y la `etiqueta`
  se crean con `visible(false)`. Deja de mostrarse el recuadro punteado vacío de ítems como
  "Tubo flexible" / "Cables".

### 14.2 Encoding UTF-8 (Views/Simulador/Index.cshtml)

- El archivo tenía **mojibake** (Ã|ð|â|Â, ~31 marcadores). Se **reescribió completo** en UTF-8 correcto
  con textos limpios: "Ejecutar", "Detener", "Guardar", "Cargar", "Limpiar", "Asistente", "Exportar",
  "Guía", "Potenciómetro", "Inclinación", "Relé", "Ultrasónico", "Micrófono", "Estimación de costo (BOM)",
  "Asistente de depuración", "Diseños guardados". Se conservaron `Layout="_Layout"`,
  `ViewData["Workspace"]=true`, la paleta, el inspector, el modal `#load-modal` y `esperarYGenerar()`.

### 14.3 Galería unificada "Mis Esquemas" (reemplaza la pestaña Galería)

- **Nav:** se eliminó la pestaña **Galería** (`_Layout.cshtml` + `GaleriaController` + `Views/Galeria/`).
  Se **conserva la Biblioteca** (la desarrolla otra persona). La pestaña **Esquemas** pasó a llamarse
  **"Mis Esquemas"**.
- **Vista `Views/Esquemas/Index.cshtml`**: ahora es una **galería de cards** que consume
  `GET /api/simulacion/designs?proyectoId=0` (todos los diseños del usuario). Cada card (`app-gallery-tile`)
  muestra:
  - **Miniatura** (`thumbnailBase64`, captura `stage.toDataURL({pixelRatio:0.5})` guardada al pulsar Guardar).
  - Nombre + fecha de actualización.
  - **"Abrir en Simulador"** → redirige a `/Simulador/Index?id={proyectoID}&diseno={simulacionDisenoID}`.
    El simulador **auto-carga ese diseño** al arrancar (ver 14.5).
  - **"Eliminar"** → `DELETE /api/simulacion/designs/{id}` con confirmación.
  - Estado vacío ("Todavía no tienes esquemas guardados") + botón "Ir al Simulador".
  - Maneja el wrapper real de la API: `Array.isArray(data) ? data : (data.data || data.disenos || [])`.

### 14.4 Miniatura en BD + backend

- **`Models/SimulacionDiseno.cs`**: nueva propiedad `string? ThumbnailBase64`.
- **`Data/ApplicationDbContext.cs`**: campo configurado (nvarchar max).
- **`docs/SCRIPT_BD.sql`**: columna `ThumbnailBase64 nvarchar(max) NULL` en `SimulacionDisenos`.
- **Base en vivo:** `ALTER TABLE dbo.SimulacionDisenos ADD ThumbnailBase64 nvarchar(max) NULL;`
  aplicado sobre `MecaPlanDB` (docker `mecaplan-sql`).
- **`SimuladorController`**: `ApiSaveDesign` persiste `thumbnailBase64` (alta y actualización);
  `ApiListDesigns` lo devuelve (incluye `simulacionDisenoID`, `proyectoID`, `fechaActualizacion`).
- **`services.js`**: `saveDesign` envía `thumbnailBase64`.
- **`ui.js::saveToDB`**: captura la miniatura con `stage.toDataURL({pixelRatio:0.5})` antes del POST.
- **Fix de nombre de campos en `ui.js`**: `loadIntoCanvas`/`openLoadModal` ahora usan los nombres
  camelCase que devuelve el backend (`simulacionDisenoID`, `pinoutJson`, `fechaActualizacion`,
  `fechaCreacion`) en lugar de `id`/`pinout_json`/`updated_at`. Así "guardar se guarda en Mis Esquemas
  y sincroniza con todo".

### 14.5 Asistente IA reutilizable (modal global + pestaña del Simulador)

- **Nav:** se quitó la pestaña **Diagnóstico** (se conservan el controller y los endpoints
  `/Diagnosticos/**`). En su lugar hay un botón **"Asistente IA"** en el nav que abre un **modal global**.
- **Nuevo `wwwroot/js/chatWidget.js`**: widget reutilizable multi-instancia que auto-inicializa todo
  root `[data-mecachat]`: puebla el `<select>` de proyectos desde **`GET /Diagnosticos/Proyectos`**
  (endpoint nuevo), renderiza burbujas/typing/markdown reusando el CSS `.dia-*` de `app.css`, y habla
  con `POST /Diagnosticos/Enviar`. Sin antiforgery (el endpoint no usa `[ValidateAntiForgeryToken]`).
- **Modal global en `_Layout.cshtml`** (solo usuarios autenticados): `.meca-modal` + `chatWidget.js`;
  abrir/cerrar con botones, backdrop y `Escape`. Se reutiliza en **toda** la app.
- **Pestaña "Asistente" del Inspector del Simulador** (`#panel-assistant`): incrusta el mismo widget
  con `data-mecachat-proyecto="@proyectoId"` para preseleccionar el proyecto actual. El botón
  "Asistente" de la barra superior del simulador ahora abre esta pestaña (`gotoTab('assistant')`),
  en lugar de `runGeminiDebug` (cuya salida `#assistant-output` fue reemplazada por el chat).
- **Historial en el chat**: al seleccionar un proyecto (o al preseleccionarse), el widget carga
  `GET /Diagnosticos/Historial?proyectoId=…` y muestra las consultas previas como burbujas
  (usuario→falla, IA→solución), separadas por una etiqueta "── Historial anterior ──". Así el modal
  reutilizable y la pestaña del simulador **también tienen historial**.
- **Auto-carga de diseño desde Mis Esquemas**: la URL `/Simulador/Index?id=…&diseno=…` hace que el
  simulador, tras `autoGenerar()`, llame a `window.SUGOI.ui.loadById(id)` (nuevo) para cargar y
  aplicar ese diseño guardado (fija `currentDesignId`, nombre y pinout).
- **Nuevo endpoint** `GET /Diagnosticos/Proyectos` → `{ proyectos:[{proyectoID, nombre}] }` (solo del
  estudiante activo), usado por el widget.
- **CSS en `app.css`**: bloque `.meca-modal*` para el modal global.

### 14.6 Exportación clara a PDF

- `ui.js::exportReporte()`: el reporte imprimible ahora abre con una **barra de acciones** ("no-print")
  con botón **"Guardar como PDF"** (`window.print()`) y **"Descargar PNG"** (enlace de descarga directa),
  además de una nota explicativa. Se eliminó el auto-print forzado.

### 14.7 Verificación

- `dotnet build`: **0 errores / 0 advertencias**.
- `node --check`: `ui.js`, `services.js`, `canvasEngine.js`, `chatWidget.js`, `diagnostico.js` → OK.
- Autenticado (cuenta real `unice891@gmail.com`):
  - `GET /Esquemas` → 200, renders "Mis Esquemas" con grid, cards y "Abrir en Simulador".
  - `GET /Simulador/Index?id=2000` → 200, con pestaña asistente, widget `mecachat` y modal global.
  - `POST /api/simulacion/designs` (con `thumbnailBase64`) → 200/crea;
    `GET /api/simulacion/designs` → lista con `thumbnailBase64` presente y `proyectoID` correcto;
    `DELETE /api/simulacion/designs/{id}` → 200 (ciclo completo OK).
- Los assets servidos (`chatWidget.js`, `app.css`, `ui.js`, `services.js`) devuelven 200 y contienen
  los nuevos marcadores (`data-mecachat`, `.meca-modal`, `thumbnailBase64`, `simulacionDisenoID`).

### 14.8 Archivos nuevos / modificados

```
Views/Shared/_Layout.cshtml                # - Galería/-Diagnóstico en nav; + botón "Asistente IA" + modal global
Views/Esquemas/Index.cshtml               # REESCRITO: galería "Mis Esquemas" (grid cards + miniatura + Abrir/Eliminar)
Views/Simulador/Index.cshtml              # REESCRITO UTF-8 + pestaña Asistente con chat widget embebido
wwwroot/js/chatWidget.js                  # NUEVO: widget de chat reutilizable
wwwroot/css/app.css                        # + bloque .meca-modal*
wwwroot/simulador/js/canvasEngine.js      # grid infinito full-bleed + resize; ocultar cajas vacías
wwwroot/simulador/js/ui.js                # miniatura al guardar + fix nombres de campo + export barra PDF/PNG
wwwroot/simulador/js/services.js          # saveDesign envía thumbnailBase64
Controllers/SimuladorController.cs        # ApiSaveDesign/ApiListDesigns con thumbnailBase64
Controllers/DiagnosticosController.cs     # + GET /Diagnosticos/Proyectos
Models/SimulacionDiseno.cs                # + ThumbnailBase64
Data/ApplicationDbContext.cs              # + configuración ThumbnailBase64
docs/SCRIPT_BD.sql                        # + columna ThumbnailBase64 en SimulacionDisenos
docs/VERSION_ESTABLE.md                   # este documento
```
