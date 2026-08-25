# Implementation Plan: SP1 - Registro e inicio de sesión de estudiantes

**Branch**: `001-student-auth` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Especificación SP1 y contexto técnico confirmado por el propietario del proyecto.

## Summary

Implementar una identidad de estudiante con registro, inicio/cierre de sesión y protección de recursos personales. La solución usa una arquitectura en capas: el dominio conserva la entidad y sus invariantes, aplicación define los casos de uso y contratos, infraestructura implementa SQL Server, hashing y auditoría, y la aplicación MVC presenta formularios y crea la sesión autenticada.

La entidad principal será `Seguridad.Estudiantes`. La migración adaptará `MecaPlanDB` existente y preservará `EstudianteID`; la persistencia garantizará unicidad de carnet y correo normalizado. El acceso autenticado usará una cookie de sesión segura con un identificador de estudiante como fuente exclusiva de propiedad. No se almacenarán contraseñas, secretos ni cadenas de conexión en el repositorio.

## Technical Context

**Language/Version**: C# sobre .NET 10.

**Primary Dependencies**: ASP.NET Core MVC; autenticación por cookies de ASP.NET Core; `PasswordHasher` de ASP.NET Core Identity; EF Core con proveedor SQL Server y herramientas de migración, todos en una versión compatible con .NET 10 y fijada durante la implementación.

**Storage**: SQL Server. Esquema `Seguridad`; tabla principal `Seguridad.Estudiantes`. Tabla adicional propuesta: `Seguridad.EventosAutenticacion` para la auditoría sin secretos.

**Testing**: Pruebas unitarias para aplicación y dominio; pruebas de integración contra una instancia aislada de SQL Server; pruebas web de extremo a extremo/reproducibles con el host de prueba MVC. El comando exacto y los paquetes de pruebas se concretan en tareas.

**Target Platform**: Aplicación web ASP.NET Core desplegada detrás de HTTPS. Desarrollo local mediante secretos de usuario o configuración inyectada fuera del repositorio; producción mediante almacén de secretos/configuración del entorno aprobado por el propietario.

**Project Type**: Aplicación web MVC monolítica con capas internas separadas.

**Performance Goals**: En condiciones normales, registro e inicio de sesión deben completar la respuesta visible al usuario en menos de dos segundos, excluyendo la interacción humana; las consultas de autenticación deben usar índices de búsqueda por correo normalizado.

**Constraints**: Cookie `Secure`, `HttpOnly` y `SameSite=Lax`; HTTPS obligatorio en producción; antiforgery en toda acción POST; contraseñas de 8 o más caracteres con mayúscula, minúscula, número y símbolo; bloqueo de 15 minutos tras 5 fallos en 15 minutos; nunca registrar contraseña ni hash; mensajes genéricos para credenciales inválidas; autorización basada en la identidad autenticada y no en identificadores enviados por cliente.

**Scale/Scope**: SP1 cubre únicamente estudiantes, registro, inicio/cierre de sesión, dashboard protegido y la base de autorización reutilizable. No cubre recuperación de contraseña, MFA, roles administrativos, correo de verificación ni autenticación externa.

## Constitution Check

*GATE: aprobado antes de Phase 0 y reevaluado después de Phase 1.*

| Principio constitucional | Evidencia en el plan | Estado |
|---|---|---|
| I. Desarrollo dirigido por especificación | `spec.md`, este plan, modelo, contrato, guía de validación y tareas posteriores mantienen la secuencia obligatoria; `/speckit.implement` requerirá autorización explícita del propietario. | PASS |
| II. Arquitectura y responsabilidades | Dominio, aplicación, infraestructura y presentación quedan separados; controladores no contendrán SQL, hashing ni reglas de autorización de negocio. | PASS |
| III. Datos y secretos | SQL Server con migración versionada, índices únicos, columnas obligatorias, consultas parametrizadas mediante EF Core y secretos fuera del repositorio. | PASS |
| IV. Propiedad de recursos | El `StudentId` de la identidad autenticada será la única fuente de propiedad; los repositorios filtrarán por propietario. | PASS |
| VI. UX y accesibilidad | Formularios con validación accesible, estados de carga/error y mensajes que no filtran credenciales. | PASS |
| VII. Calidad | Se planifican pruebas de unidad, integración y web para cada regla de seguridad y resultado crítico. | PASS |
| VIII. Trazabilidad | Requisitos SP-11 a SP-14 se enlazarán con tareas y pruebas; migración, reversión y auditoría quedan documentadas. | PASS |

No existe violación que justifique complejidad excepcional. La separación en cuatro capas es obligatoria por la constitución y evita mezclar HTTP, SQL y seguridad.

## Research Decisions

Las decisiones, alternativas y fuentes se detallan en [research.md](./research.md). Quedan resueltas las decisiones que estaban abiertas en la especificación: algoritmo/servicio de hashing, sesión, unicidad persistente, corrección de datos heredados y protección de rutas.

## Design Plan

### 1. Estructura de capas y dependencias

Se conserva el proyecto MVC actual como presentación y se agregan tres proyectos de clase a la solución. Las referencias permitidas son: `Application -> Domain`, `Infrastructure -> Application + Domain` y `MecaPlan (presentación) -> Application + Infrastructure`. La referencia de presentación a infraestructura se permite exclusivamente en el punto de composición `Program` para registrar dependencias; controladores y vistas no pueden usar tipos de infraestructura.

```text
MecaPlan.slnx
├── MecaPlan/                                # Presentación MVC y composición
│   ├── Controllers/
│   │   ├── AccountController.cs
│   │   └── DashboardController.cs
│   ├── ViewModels/Account/
│   │   ├── RegisterViewModel.cs
│   │   └── LoginViewModel.cs
│   ├── Views/Account/
│   │   ├── Register.cshtml
│   │   └── Login.cshtml
│   ├── Views/Dashboard/Index.cshtml
│   ├── Security/CurrentStudentContext.cs
│   └── Program.cs
├── MecaPlan.Domain/
│   ├── Entities/Estudiante.cs
│   └── Entities/EventoAutenticacion.cs
├── MecaPlan.Application/
│   ├── Abstractions/Persistence/IEstudianteRepository.cs
│   ├── Abstractions/Security/IPasswordHashService.cs
│   ├── Abstractions/Audit/IAuthenticationAuditWriter.cs
│   ├── Authentication/Commands/
│   ├── Authentication/Services/StudentAuthenticationService.cs
│   └── Authentication/Results/
├── MecaPlan.Infrastructure/
│   ├── Persistence/MecaPlanDbContext.cs
│   ├── Persistence/Configurations/EstudianteConfiguration.cs
│   ├── Persistence/Configurations/EventoAutenticacionConfiguration.cs
│   ├── Persistence/Repositories/EstudianteRepository.cs
│   ├── Security/AspNetPasswordHashService.cs
│   ├── Audit/AuthenticationAuditWriter.cs
│   ├── DependencyInjection.cs
│   └── Migrations/
└── tests/
    ├── MecaPlan.Domain.Tests/
    ├── MecaPlan.Application.Tests/
    ├── MecaPlan.Infrastructure.IntegrationTests/
    └── MecaPlan.Web.IntegrationTests/
```

### 2. Registro y autenticación

1. El formulario MVC envía carnet, nombre, apellido, correo, contraseña y confirmación mediante POST protegido contra falsificación de solicitudes.
2. El controlador valida el modelo de entrada y delega el caso de uso a `StudentAuthenticationService`; no accede a SQL ni ejecuta hashing.
3. El servicio normaliza correo y carnet, verifica reglas de formato y la contraseña (mínimo 8 caracteres con mayúscula, minúscula, número y símbolo), consulta disponibilidad y solicita el hash a `IPasswordHashService`.
4. El repositorio guarda al estudiante dentro de una operación atómica. Los índices únicos de SQL Server son la garantía final ante registros concurrentes; las excepciones de conflicto se traducen a un resultado seguro y accionable.
5. En el inicio de sesión, el servicio busca por correo normalizado, verifica el hash, rechaza cuentas inactivas y devuelve únicamente el resultado de autenticación. El controlador crea una identidad con `StudentId` y nombre visible mínimos, emite una cookie de sesión y redirige al dashboard.
6. El cierre de sesión solo acepta POST con antiforgery y elimina la cookie. No habrá opción "recordarme" en SP1.
7. Los intentos fallidos se contabilizan por combinación de identidad normalizada y origen de solicitud; al quinto fallo dentro de 15 minutos se bloquean nuevos intentos durante 15 minutos. Los valores registrados se minimizan y no incluyen contraseña.

### 3. Autorización y aislamiento de datos

- La aplicación configura autenticación antes de autorización y antes de mapear rutas.
- La ruta de dashboard se declara con autorización obligatoria. Una página MVC sin sesión redirige al login; los módulos futuros de perfil y recursos personales reutilizarán el mismo contexto y sus endpoints de datos no deben devolver contenido protegido.
- `CurrentStudentContext` extrae y valida el claim `StudentId`. Los servicios de aplicación reciben ese identificador desde el contexto autenticado; nunca desde una entrada de formulario o ruta como prueba de propiedad.
- Cada repositorio futuro de recursos de estudiante debe aplicar `WHERE StudentId = currentStudentId` en lectura y modificación. Los intentos de acceso a recurso ajeno retornan un resultado de no encontrado/no autorizado que no filtra datos.
- La cookie será de sesión, cifrada/protegida por el framework, `Secure`, `HttpOnly`, `SameSite=Lax`, sin persistencia y con expiración deslizante limitada. Las claves de protección de datos se persistirán y protegerán de forma apropiada al entorno de despliegue para impedir invalidación o exposición entre reinicios/instancias.

### 4. Persistencia y migración reproducible

La implementación creará una migración EF Core versionada y su script SQL idempotente de despliegue para adaptar `MecaPlanDB` existente. Las pruebas usarán una copia aislada de esa base; la base de desarrollo original no se modifica hasta contar con autorización explícita. La migración y las instrucciones de despliegue y reversión deben quedar versionadas.

La tabla principal tendrá la forma definida en [data-model.md](./data-model.md): `EstudianteID`, nombre, apellido, carnet, `Email`, `EmailNormalizado`, `PasswordHash`, `FechaRegistro` y `EstadoBit`. `Carnet` y `EmailNormalizado` tendrán índices únicos independientes; `PasswordHash` y `EstadoBit` serán obligatorios.

**Compatibilidad y corrección de SQL existente**:

1. Antes de aplicar cambios a la tabla existente, el preflight inspeccionará esquema, nulabilidad, tipos, duplicados y filas con hash vacío o nulo. El modelo heredado aportado usa `EstudianteID`, `Email`, `FechaRegistro`, `PasswordHash` y `EstadoBit`; la migración adapta esa forma y no la reemplaza por una base nueva.
2. `EstadoBit` se normaliza a `BIT NOT NULL` con valor predeterminado `1` para altas nuevas. Si existen valores nulos heredados, la migración debe registrar su cantidad y establecerlos en `0` (inactivo) antes de imponer `NOT NULL`; esto evita conceder acceso accidental a cuentas de estado desconocido.
3. `PasswordHash` se normaliza a una columna no anulable con capacidad suficiente para los hashes producidos por `PasswordHasher`. La migración **no** fabricará hashes ni contraseñas para filas existentes. Si hay hashes nulos, vacíos o inválidos, el despliegue se bloquea hasta que un procedimiento de remediación aprobado trate esas cuentas; SP1 no incluye restablecimiento de contraseña.
4. Antes de crear los índices únicos, el preflight identifica duplicados tras normalización. El despliegue se bloquea y entrega un informe de remediación si existen duplicados; nunca elimina ni fusiona estudiantes automáticamente.
5. La reversión segura elimina solo los objetos introducidos por la migración cuando no haya datos dependientes; si se corrige una tabla preexistente, la reversión debe restaurar el esquema previo únicamente con respaldo aprobado. No se revierte automáticamente una corrección que pueda reintroducir nulos o duplicados.

### 5. Validación, errores y secretos

- Validar en servidor obligatoriedad, longitud, formato de correo, carnet, confirmación de contraseña y política de contraseña. La validación cliente solo mejora UX y nunca sustituye al servidor.
- Registro duplicado: respuesta segura que evita exponer datos de otra persona. Inicio inválido: un único mensaje genérico sin distinguir correo, contraseña, cuenta inactiva o existencia del estudiante.
- Las excepciones de infraestructura se registran con identificador de correlación y detalles internos exclusivos para operadores; la pantalla devuelve un error accionable y no sensible.
- La cadena de conexión se obtiene de configuración externa o secretos de usuario. `appsettings*.json`, migraciones, trazas, pruebas y documentación no contendrán secretos reales.
- Los registros de auditoría incluyen tipo de evento, resultado, fecha UTC, estudiante solo cuando se conoce de manera segura, identificador de correlación y datos de origen minimizados. No incluyen contraseña, hash, cookie ni cadena de conexión.

### 6. Estrategia de pruebas

| Capa | Pruebas necesarias | Evidencia |
|---|---|---|
| Dominio/aplicación | Normalización, validación de registro, política de contraseña, resultado genérico de login, rechazo de cuenta inactiva y contrato de propiedad. | Pruebas unitarias deterministas. |
| Infraestructura | Migración en SQL Server aislado; `PasswordHash` no nulo; índices únicos de carnet/correo; duplicados concurrentes; corrección/bloqueo de datos heredados inválidos. | Pruebas de integración y script de preflight con base efímera. |
| Web MVC | GET/POST de registro y login, antiforgery, cookie segura, redirección al dashboard, logout, estado de validación y accesibilidad básica. | Pruebas de host web y evidencia manual reproducible. |
| Autorización | Visitante redirigido al login; una solicitud no puede sustituir el `EstudianteID` derivado de la sesión; los módulos futuros reutilizarán este contexto para sus recursos. | Pruebas de integración de autorización. |
| Seguridad operativa | Ausencia de contraseñas, hashes y cadenas de conexión en respuestas, logs de prueba y repositorio. | Revisión automatizada de salida y revisión de cambios. |

## Risks and Pending Decisions

| Riesgo o decisión | Decisión actual / mitigación | Responsable antes de implementación |
|---|---|---|
| Base de datos existente no versionada | Ejecutar preflight; bloquear migración ante `PasswordHash` inválido, duplicados o diferencias no seguras. | Propietario de base de datos. |
| Políticas exactas de contraseña, expiración y limitación | Configurarlas como opciones revisables y probarlas; no permitir valores que debiliten las garantías de SP1. | Equipo técnico durante tareas. |
| Almacén de secretos y claves de protección en producción | Usar configuración administrada del entorno; documentar el proveedor aprobado antes de despliegue. | Propietario de infraestructura. |
| Dashboard actual no existe | Crear un destino protegido mínimo durante SP1, sin construir funcionalidades de negocio adicionales. | Equipo técnico. |
| Auditoría persistente | Confirmar retención y acceso operativo antes del despliegue; el modelo inicial evita secretos. | Propietario del proyecto. |

## Project Structure

### Documentation (this feature)

```text
specs/001-student-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── authentication-mvc.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # Lo crea $speckit-tasks; no existe aún
```

### Source Code (repository root)

La estructura propuesta está detallada en la sección "Estructura de capas y dependencias". El proyecto MVC existente permanece como presentación; los nuevos proyectos de dominio, aplicación e infraestructura formalizan los límites exigidos por la constitución.

**Structure Decision**: Monolito MVC modular con cuatro proyectos/capas. Evita introducir servicios remotos, conserva la solución actual y habilita pruebas independientes de las reglas de autenticación y persistencia.

## Complexity Tracking

No aplica: no existen violaciones de la constitución ni complejidad adicional sin justificación.
