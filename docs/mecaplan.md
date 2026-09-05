# MecaPlan — Guía del proyecto

Documento del estado actual: autenticación, proyectos, generación con Claude, lista de materiales y workspace (código Arduino Uno, canvas y diagnóstico).

Sustituye a `docs/autenticacion.md`.

---

## 1. Resumen

MecaPlan es una app **ASP.NET Core MVC** (`net10.0`) para planear proyectos de electrónica/mecatrónica.

- El usuario entra con **correo y contraseña** contra `Estudiantes` en SQL Server.
- La sesión es una **cookie** (`MecaPlan.Auth`), no JWT ni ASP.NET Identity.
- Tras el login puede **crear un proyecto**, revisar el **BOM** y abrir el **workspace**: código listo para Arduino Uno, canvas con componentes arrastrables y panel de diagnóstico.

Flujo principal:

1. Visitante abre `/` → `[Authorize]` → `/Account/Login`.
2. Login o registro → cookie → `/` (Inicio) o `/Proyectos`.
3. **Crear proyecto** → Claude arma faltantes → el usuario confirma el BOM → se genera sketch + conexiones → **Workspace**.
4. Cerrar sesión borra la cookie y vuelve al login.

---

## 2. Arranque y paquetes

**Proyecto:** `MecaPlan.csproj`

| Paquete | Versión | Uso |
|---|---|---|
| `Microsoft.EntityFrameworkCore.SqlServer` | 10.0.11 | SQL Server |
| `Microsoft.EntityFrameworkCore.Tools` | 10.0.11 | Herramientas EF (las tablas ya existían) |

**Perfil HTTP:** `http://localhost:5120`  
`dotnet run --launch-profile http`

En Development, al arrancar se llama `Database.CanConnectAsync()`. Si SQL Server no responde, la app no arranca.

`UserSecretsId`: `mecaplan-dev-secrets` (opcional para la clave de Claude).

---

## 3. Base de datos

**Archivo:** `appsettings.json`

```
Server=localhost\SQLEXPRESS
Database=MecaPlanDB
Trusted_Connection=True
TrustServerCertificate=True
```

Autenticación de Windows.

**Contexto:** `Data/ApplicationDbContext.cs`

Tablas:

- `Estudiantes`
- `Proyectos`
- `Componentes`
- `ProyectoComponentes`
- `Diagnosticos`
- `PasosEnsamblaje`

### Columnas añadidas en `Proyectos` (no estaban en el esquema inicial)

| Columna | Uso |
|---|---|
| `MaterialesPrevios` | Lo que el usuario ya tiene |
| `MaterialesRequeridos` | Piezas que debe usar aunque no las tenga |
| `Microcontrolador` | Placa (Arduino Uno, ESP32, …) |
| `CodigoGenerado` | Sketch C++ |
| `ConexionesCanvas` | JSON de cables para el canvas |

### CHECK de SQL Server (importante)

`CK_Proyectos_Estado` solo admite:

- `En Desarrollo`
- `Pausado`
- `Completado`
- `Cancelado`

Al crear un proyecto el estado es **`En Desarrollo`**. No usar valores como `Validando BOM` (el INSERT falla).

`CK_Proyectos_NivelComplejidad`: `Básico`, `Intermedio`, `Avanzado`.

### Tabla `Estudiantes`

| Campo | Notas |
|---|---|
| `EstudianteID` | Clave |
| `Nombre`, `Apellido` | Máx. 100, obligatorios |
| `Email` | Máx. 150, **único** |
| `PasswordHash` / `PasswordSalt` | Base64, no Unicode |
| `Activo` | Debe ser `true` para entrar |
| `FechaRegistro` / `FechaEliminacion` | Soft delete si hay fecha de eliminación |

---

## 4. Autenticación

### Hash (`Services/PasswordHasher.cs`)

- PBKDF2 SHA-256, 100 000 iteraciones
- Salt 16 bytes, hash 32 bytes, ambos Base64
- Comparación en tiempo constante

### Cookie (`Program.cs`)

| Opción | Valor |
|---|---|
| Login / Logout / AccessDenied | `/Account/Login`, `/Account/Logout`, `/Account/AccessDenied` |
| Caducidad | 8 h, sliding |
| Nombre | `MecaPlan.Auth` |
| HttpOnly | `true` |
| SameSite | `Strict` |
| SecurePolicy | `SameAsRequest` |

Claims al entrar: `NameIdentifier` = `EstudianteID`, `Email`, `Name` = `"Nombre Apellido"`.

Recordarme: 8 horas sin marcar; 14 días si está marcado.

### Cuentas (`Controllers/AccountController.cs`)

- Login/registro `[AllowAnonymous]`, POST con anti-forgery.
- Login: mensaje genérico si falla (`"Correo o contraseña incorrectos."`).
- Registro: email único, hash nuevo, sign-in automático, redirect a Inicio.
- Logout solo por POST.
- `returnUrl` solo si es local.

ViewModels: `LoginViewModel`, `RegisterViewModel`. Validación en español + jQuery en cliente.

### Pantallas protegidas

`HomeController` tiene `[Authorize]` en la clase. `Privacy` y `Error` son anónimos.

El menú post-login (`_Layout.cshtml`): Inicio, Proyectos, Diagnóstico, Esquemas, Biblioteca, Galería, tema, nombre, Cerrar sesión. Varias de esas rutas son páginas placeholder.

---

## 5. Tema claro / oscuro

| Pieza | Rol |
|---|---|
| `_ThemeInit.cshtml` | Lee `localStorage` en `<head>` (evita flash) |
| `wwwroot/js/theme.js` | Interruptor |
| Clave | `mecaplan-theme` (`light` / `dark`) |
| Atributo | `data-theme` en `<html>` |

Si no hay valor, usa `prefers-color-scheme`.

Los `<select>` en modo oscuro pintan las **opciones** con texto oscuro sobre fondo claro: en Windows el popup nativo ignora el fondo de `<option>` y el texto blanco quedaba ilegible.

---

## 6. Inteligencia artificial (Claude)

**Cliente:** `Services/AnthropicChatClient.cs` (`IAiChatClient`)  
**Registro:** `Program.cs` → `AddHttpClient<IAiChatClient, AnthropicChatClient>`

| Clave `Ai` | Valor |
|---|---|
| `Provider` | `Anthropic` |
| `Endpoint` | `https://api.anthropic.com/v1/messages` |
| `Model` | `claude-sonnet-4-5` |
| `TimeoutSeconds` | 180 |
| `ApiKey` | Vacía en `appsettings.json` |

La clave de desarrollo va en **`appsettings.Development.json`** (`Ai:ApiKey`) o en user-secrets. **No** commitear la clave ni pegarla en el chat.

Headers: `x-api-key`, `anthropic-version: 2023-06-01`.

Hay un cliente OpenAI de respaldo (`OpenAiChatClient`) que ya no está registrado.

### Dos prompts

1. **Arquitecto de hardware** (`ArquitectoHardwarePrompt`) — JSON `{ "faltantes": [{ "nombre", "cantidad", "motivo" }] }`. No incluye lo que el usuario ya tiene ni los requisitos (esos se agregan en C#).
2. **Tutor de ingeniería** (`TutorIngenieriaPrompt`) — JSON `{ "codigo", "conexiones_canvas": [{ "origen", "destino", "color_cable" }] }`. El `codigo` es un **sketch completo para Arduino Uno** (pines 2–13 / A0–A5, `Serial.begin(9600)`, `setup`/`loop`), listo para copiar al IDE. Sin markdown.

Servicio: `GeneradorProyectoService`.

---

## 7. Crear proyecto y BOM

**Rutas:** `ProyectosController`

| Paso | Acción |
|---|---|
| Formulario | `GET/POST Crear` |
| Revisar lista | Vista `ValidarBom` |
| Confirmar | `POST ConfirmarBom` → genera código y redirige a Workspace |
| Lista | `GET Index` |
| Espacio de trabajo | `GET Workspace/{id}` |

### Formulario (`Views/Proyectos/Crear.cshtml`)

- Nombre, placa/microcontrolador, nivel, idea
- **Materiales que ya tienes**
- **Materiales requeridos (no los tienes)** — van a la sección Requisitos del BOM

El botón **Generar** muestra spinner (`data-loading-button` en `wwwroot/js/site.js`).

### Lista de materiales (`Views/Proyectos/ValidarBom.cshtml`)

Tres bloques:

- **En inventario** (verde) — placa + materiales previos
- **Requisitos** (violeta) — lo que el usuario marcó como obligatorio y no tiene
- **Faltantes / nuevos** (naranja) — sugerencias de Claude

**Quitar** oculta la fila (`display: none` forzado: el `hidden` nativo lo pisaba el `display: grid` de la tarjeta) y marca `Quitar=true` para no guardarla.

La lista tiene **scroll interno**; título y **Confirmar lista** se quedan fijos. Las filas son compactas.

Al confirmar: se guardan componentes, se llama al tutor y se abre el workspace. El botón también lleva animación de carga.

---

## 8. Workspace

**Vista:** `Views/Proyectos/Workspace.cshtml`  
**JS:** `wwwroot/js/workspace.js`  
**CSS:** `wwwroot/css/app.css`

Por defecto **solo se ve el canvas**. Código y diagnóstico se abren con los botones de la barra superior.

### Barra superior (fija)

No comparte el grid de los paneles: al ensanchar Código o Diagnóstico **no se estrechan ni se pisan** Copiar / Guardar / Código / Diagnóstico.

- Izquierda: Copiar, Guardar, Cerrar código (si el panel de código está abierto)
- Centro: título Canvas
- Derecha: **Código**, **Diagnóstico**, Cerrar diagnóstico (si está abierto)

### Paneles de abajo (los que sí se redimensionan)

- **Código:** Monaco Editor. Sketch Arduino Uno. Copiar al portapapeles y Guardar (`POST GuardarCodigo`). El borde derecho permite cambiar el ancho (`--code-w`, mínimo ~180 px, el canvas no baja de ~280 px).
- **Canvas:** nodos pequeños, **arrastrables**, cables SVG que se redibujan. Puntos de conexión y cables con trazo animado. Texto “Arrastra los componentes” sobre el lienzo.
- **Diagnóstico:** formulario (tipo de error + detalle) → tabla `Diagnosticos`. El borde izquierdo redimensiona (`--chat-w`). Scroll propio en el cuerpo del formulario.

La barra de MecaPlan (Inicio, Proyectos, …) también queda fija; solo se mueve el contenido de cada panel.

---

## 9. UI de login y registro

**Layout:** `_AuthLayout.cshtml`  
**Estilos:** `wwwroot/css/auth.css`

Tarjeta partida: izquierda morada (logo + características), derecha el formulario. Login sin párrafo largo de marketing.

---

## 10. Archivos clave

```
Program.cs
appsettings.json
appsettings.Development.json          (clave Claude en desarrollo; no subirla)
Controllers/AccountController.cs
Controllers/HomeController.cs
Controllers/ProyectosController.cs
Data/ApplicationDbContext.cs
Models/Estudiante.cs
Models/Proyecto.cs
Models/ViewModels/CrearProyectoViewModel.cs
Services/PasswordHasher.cs
Services/AnthropicChatClient.cs
Services/GeneradorProyectoService.cs
Services/ArquitectoHardwarePrompt.cs
Services/TutorIngenieriaPrompt.cs
Services/InventarioParser.cs
Views/Proyectos/Crear.cshtml
Views/Proyectos/ValidarBom.cshtml
Views/Proyectos/Workspace.cshtml
Views/Shared/_Layout.cshtml
wwwroot/css/auth.css
wwwroot/css/app.css
wwwroot/js/theme.js
wwwroot/js/site.js
wwwroot/js/workspace.js
```

---

## 11. Cómo probar

1. SQL Server Express en marcha, base `MecaPlanDB`.
2. Clave de Claude en `appsettings.Development.json` o user-secrets.
3. `dotnet run --launch-profile http`
4. `http://localhost:5120` → login.
5. Registrar o entrar; tema claro/oscuro se conserva.
6. **Crear proyecto** → Generar (spinner) → ajustar BOM (quitar, requisitos) → Confirmar lista.
7. Workspace: abrir Código / Diagnóstico, arrastrar nodos, redimensionar paneles (la barra de arriba no se deforma), Copiar el sketch al IDE de Arduino.
8. Cerrar sesión vuelve al login.

Para un sketch nuevo de Arduino Uno hay que **volver a confirmar el BOM**; el código ya guardado de un proyecto viejo no se reescribe solo.

---

## 12. Seguridad (estado actual)

- Contraseñas nunca en texto plano.
- Error de login genérico.
- Anti-forgery en POST de cuentas, BOM y diagnóstico.
- Cookie HttpOnly + SameSite Strict.
- `returnUrl` solo local.
- Cuentas inactivas o eliminadas no entran.
- La API key de Claude no debe ir en `appsettings.json` ni en el repositorio.

Pendiente: recuperación de contraseña, bloqueo por intentos, roles, 2FA, política de contraseña más estricta, páginas reales de Esquemas / Biblioteca / Galería.
