# Investigación técnica: SP1 - Registro e inicio de sesión de estudiantes

**Fecha**: 2026-08-24

## Decisión 1: Hashing de contraseña

**Decisión**: Encapsular `PasswordHasher` detrás de `IPasswordHashService` en infraestructura y guardar únicamente el valor de hash resultante.

**Rationale**: La documentación de ASP.NET Core indica que las aplicaciones nuevas con inicio de sesión basado en contraseña deben usar `PasswordHasher`, no una primitiva de derivación de claves de bajo nivel. El contrato de aplicación permite verificar y actualizar la política en el futuro sin acoplar el dominio a la librería criptográfica.

**Alternatives considered**:

- PBKDF2 llamado directamente: descartado para una aplicación nueva por la recomendación oficial de usar `PasswordHasher`.
- Contraseña cifrada reversible: descartada porque viola la constitución y FR-003.
- ASP.NET Core Identity completo: descartado para SP1 porque impone un modelo/tablas de identidad más amplio que la entidad `Seguridad.Estudiantes` definida; la autenticación con cookies y un hasher encapsulado cubre el alcance actual sin bloquear una migración futura.

**Fuente**: [Hash passwords in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/consumer-apis/password-hashing?view=aspnetcore-10.0)

## Decisión 2: Sesión y autorización web

**Decisión**: Usar autenticación por cookies de sesión sin "recordarme", con `StudentId` como claim mínimo de propiedad; aplicar autorización a rutas personales y validar propietario en servicios/repositorios.

**Rationale**: La autenticación por cookies es compatible con MVC y la documentación oficial establece el orden necesario de autenticación y autorización. Una cookie de sesión reduce persistencia innecesaria del acceso; las propiedades seguras impiden exposición desde scripts o canales no seguros.

**Alternatives considered**:

- Tokens portadores en almacenamiento del navegador: descartados para la interfaz MVC de SP1 por ampliar innecesariamente la superficie de exposición.
- Sesión persistente: descartada para SP1; solo podría añadirse con consentimiento explícito y otra especificación.
- Rutas públicas con verificación manual dentro de cada acción: descartadas porque duplican reglas y pueden omitir protección.

**Fuente**: [Use cookie authentication without ASP.NET Core Identity](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/cookie?view=aspnetcore-10.0)

## Decisión 3: Unicidad de carnet y correo

**Decisión**: Normalizar el correo antes de comparar/guardar para búsquedas consistentes, y crear índices únicos independientes sobre carnet y correo normalizado. La validación de aplicación mejora UX, pero SQL Server es la garantía final.

**Rationale**: Un índice único impide físicamente una segunda fila con el mismo valor y produce un conflicto si se intenta insertar un duplicado, incluso cuando dos solicitudes pasan validación al mismo tiempo.

**Alternatives considered**:

- Verificar duplicado solo antes de insertar: descartado porque no protege contra concurrencia.
- Usar carnet y correo como clave primaria compuesta: descartado; una clave técnica estable simplifica relaciones futuras y ambos identificadores siguen siendo únicos.
- Confiar solo en la intercalación por defecto de SQL Server para mayúsculas/minúsculas: descartado; la normalización hace explícita la regla de dominio.

**Fuente**: [Indexes - EF Core](https://learn.microsoft.com/en-us/ef/core/modeling/indexes)

## Decisión 4: Corrección de `EstadoBit` y `PasswordHash`

**Decisión**: Migración con preflight y bloqueo ante datos inseguros; `EstadoBit` será `BIT NOT NULL` con predeterminado `1` para altas nuevas y los nulos heredados pasan a inactivo (`0`). `PasswordHash` será obligatorio; hashes inexistentes, vacíos o no verificables bloquean el despliegue hasta su remediación aprobada.

**Rationale**: Completar un hash faltante o activar cuentas de estado desconocido vulneraría integridad y seguridad. La corrección explícita mantiene trazabilidad y evita transformar datos ambiguos en acceso válido.

**Alternatives considered**:

- Asignar una contraseña/hash predeterminada: descartado porque crearía credenciales inseguras y no informaría al estudiante.
- Activar todos los estados nulos: descartado porque podría otorgar acceso a cuentas que debían permanecer deshabilitadas.
- Eliminar duplicados o cuentas inválidas automáticamente: descartado por riesgo de pérdida de datos y ausencia de autorización.

## Decisión 5: Comportamiento de rutas protegidas en .NET 10

**Decisión**: Las páginas MVC redirigen al login cuando no hay sesión; los futuros endpoints de datos devuelven estado de no autenticado/no autorizado en vez de redirigir.

**Rationale**: ASP.NET Core 10 distingue por tipo de endpoint: las páginas web continúan redirigiendo y los endpoints de API devuelven 401/403. Esta separación evita respuestas inesperadas para clientes no HTML.

**Fuente**: [API endpoint authentication behavior in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/api-endpoint-auth?view=aspnetcore-10.0)

## Decisión 6: Adaptación de la base de datos existente

**Decisión**: Adaptar la base SQL Server `MecaPlanDB` existente mediante preflight y migraciones versionadas. Se conservan los nombres físicos `EstudianteID`, `Email` y `FechaRegistro`; se agrega `EmailNormalizado` para la unicidad sin distinción de mayúsculas/minúsculas.

**Rationale**: El modelo y diagrama aportados ya usan esos nombres. Preservarlos reduce el riesgo de romper relaciones o documentación existente, mientras que el preflight evita modificar datos ambiguos o inseguros de forma automática.

**Alternatives considered**:

- Crear una base nueva: descartada porque no adaptaría el modelo existente aportado por el equipo.
- Renombrar las columnas a una convención nueva: descartado para SP1 por aumentar el riesgo y el alcance de migración sin aportar valor funcional.

## Decisión 7: Política verificable de credenciales

**Decisión**: Exigir una contraseña de mínimo 8 caracteres con mayúscula, minúscula, número y símbolo. Tras 5 inicios de sesión fallidos en una ventana de 15 minutos, bloquear nuevos intentos durante 15 minutos.

**Rationale**: Son reglas explícitas que reducen contraseñas débiles y ataques de adivinación automatizada, y permiten pruebas de aceptación deterministas.

**Alternatives considered**:

- Política sin longitud ni composición: descartada porque no cumple FR-002.
- Bloqueo permanente de cuenta: descartado porque requiere un flujo de recuperación fuera del alcance de SP1.
