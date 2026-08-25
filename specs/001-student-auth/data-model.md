# Modelo de datos: SP1 - Registro e inicio de sesión de estudiantes

## 1. `Seguridad.Estudiantes`

Entidad principal y dueña de recursos académicos posteriores.

| Campo | Tipo lógico | Reglas |
|---|---|---|
| `EstudianteID` | Identificador entero | Clave primaria existente generada por persistencia. Nunca se acepta del cliente como prueba de propiedad. |
| `Nombre` | Texto | Obligatorio; longitud máxima definida por la migración y validada en servidor. |
| `Apellido` | Texto | Obligatorio; longitud máxima definida por la migración y validada en servidor. |
| `Carnet` | Texto | Obligatorio, normalizado según regla del dominio y único. |
| `Email` | Texto | Obligatorio; conserva la representación para mostrar al estudiante. |
| `EmailNormalizado` | Texto | Obligatorio; versión canónica para búsqueda e índice único, sin distinción de mayúsculas/minúsculas. |
| `PasswordHash` | Texto | Obligatorio; únicamente contiene un hash verificable. Nunca contiene contraseña legible, reversible ni valor de prueba compartido. |
| `FechaRegistro` | Fecha/hora UTC | Obligatoria; asignada por el sistema al crear la cuenta. |
| `EstadoBit` | Booleano | Obligatorio. `true` permite autenticación; `false` rechaza acceso con el mismo mensaje genérico. Nuevas cuentas usan `true` de forma predeterminada. |

**Constraints de persistencia**:

- Clave primaria sobre `EstudianteID`.
- Índice único `UX_Estudiantes_Carnet` sobre `Carnet`.
- Índice único `UX_Estudiantes_EmailNormalizado` sobre `EmailNormalizado`.
- `PasswordHash` y `EstadoBit` no admiten nulos.
- El esquema es `Seguridad`; la tabla es `Estudiantes`.

**Transiciones de estado**:

| Estado actual | Evento | Estado resultante | Regla |
|---|---|---|---|
| No existe | Registro válido | Activo | Se crean estudiante y hash de manera atómica. |
| Activo | Inicio válido | Activo + sesión | Se crea una sesión; el estado persistido no cambia. |
| Activo | Cierre de sesión | Activo sin sesión | Se elimina la sesión; el estudiante permanece activo. |
| Inactivo | Inicio válido | Inactivo sin sesión | Se rechaza con mensaje genérico y se audita el intento. |

## 2. `Seguridad.EventosAutenticacion`

Entidad de auditoría propuesta para resultados relevantes, sin secretos.

| Campo | Tipo lógico | Reglas |
|---|---|---|
| `IdEventoAutenticacion` | Identificador entero | Clave primaria generada por persistencia. |
| `EstudianteID` | Identificador opcional | Relación con estudiante solo si su identidad se conoce con seguridad. |
| `TipoEvento` | Texto controlado | Registro, inicio exitoso, inicio rechazado, cierre de sesión o acceso rechazado. |
| `Resultado` | Texto controlado | Éxito o rechazo. |
| `FechaUtc` | Fecha/hora UTC | Obligatoria. |
| `CorrelationId` | Texto | Permite correlación operativa sin incluir secretos. |
| `OrigenMinimizado` | Texto opcional | Dato de origen reducido conforme a la política de privacidad; no contiene contraseña, hash, cookie ni cadena de conexión. |

**Relación**: Un estudiante puede tener cero o muchos eventos; un evento puede no tener estudiante asociado cuando un intento no identifica una cuenta válida.

## Validaciones cruzadas

- La aplicación valida formato antes de persistir; la base de datos garantiza nulabilidad y unicidad.
- El correo se recorta y normaliza antes de la búsqueda y guardado; se conserva `Email` para presentación.
- Una falla en la escritura del estudiante no puede crear un evento de registro exitoso ni una sesión.
- Los recursos futuros deben usar `EstudianteID` como clave foránea y filtrar por la identidad autenticada.
