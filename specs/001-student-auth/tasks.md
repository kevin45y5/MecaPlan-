---

description: "Tareas de implementación para SP1: registro e inicio de sesión seguro de estudiantes"
---

# Tasks: SP1 - Registro e inicio de sesión de estudiantes

**Input**: Artefactos de diseño en `/specs/001-student-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contract MVC](./contracts/authentication-mvc.md) y [quickstart.md](./quickstart.md).

**Tests**: Obligatorios. SP1 y la constitución exigen pruebas unitarias, de integración y web para reglas de registro, credenciales, autorización y rutas protegidas.

**Organization**: Las tareas están agrupadas por historia de usuario. Ninguna tarea implementa alcance fuera de SP1: no incluye recuperación de contraseña, MFA, roles administrativos, correo de verificación ni proveedores externos.

**Autorización**: Este archivo planifica trabajo; la ejecución de `/speckit.implement` requiere autorización explícita del propietario del proyecto conforme a la constitución.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: Puede ejecutarse en paralelo después de completar sus dependencias indicadas y sin editar los mismos archivos.
- **[US1]**, **[US2]**, **[US3]**: Historia de usuario que recibe el cambio.
- Cada tarea identifica archivos/componentes afectados y una verificación observable.

## Trazabilidad de subtareas funcionales

| Subtarea | Tareas principales |
|---|---|
| SP-11: interfaz de registro e inicio de sesión | T020-T022, T029-T032 |
| SP-12: migración `Seguridad.Estudiantes` | T007-T011, T017, T040 |
| SP-13: registro seguro con hashing | T019-T025 |
| SP-14: pruebas de login y redirección | T026-T033 |

## Phase 1: Setup (infraestructura compartida)

**Purpose**: Preparar la solución y las convenciones necesarias sin crear comportamiento de autenticación todavía.

- [ ] T001 Crear los proyectos de capas y referencias permitidas en `MecaPlan.slnx`, `MecaPlan.Domain/MecaPlan.Domain.csproj`, `MecaPlan.Application/MecaPlan.Application.csproj`, `MecaPlan.Infrastructure/MecaPlan.Infrastructure.csproj` y `MecaPlan/MecaPlan.csproj` — Verificar: la solución restaura y compila; respeta `Application -> Domain`, `Infrastructure -> Application + Domain` y permite `MecaPlan -> Infrastructure` solo para registrar DI en `Program`.
- [ ] T002 Configurar dependencias compatibles con .NET 10 en `MecaPlan/MecaPlan.csproj`, `MecaPlan.Infrastructure/MecaPlan.Infrastructure.csproj` y los proyectos de prueba creados — Verificar: las versiones quedan fijadas, justificadas en el diff y `dotnet restore` finaliza sin advertencias nuevas.
- [ ] T003 [P] Crear la estructura base de pruebas en `tests/MecaPlan.Domain.Tests/`, `tests/MecaPlan.Application.Tests/`, `tests/MecaPlan.Infrastructure.IntegrationTests/` y `tests/MecaPlan.Web.IntegrationTests/` — Verificar: cada proyecto de prueba se incorpora a `MecaPlan.slnx` y puede descubrir una prueba vacía.
- [ ] T004 [P] Definir configuración sin secretos en `MecaPlan/appsettings.json`, `MecaPlan/appsettings.Development.json`, `MecaPlan/Properties/launchSettings.json` y `.gitignore` — Verificar: no hay cadenas de conexión, contraseñas, tokens ni claves reales versionadas; la documentación indica el uso de secretos de usuario/configuración externa.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: Construir límites de arquitectura, persistencia, seguridad y herramientas que deben existir antes de cualquier historia de usuario.

**⚠️ CRITICAL**: No se inicia US1, US2 ni US3 hasta completar esta fase.

- [ ] T005 Crear las abstracciones de aplicación en `MecaPlan.Application/Abstractions/Persistence/IEstudianteRepository.cs`, `MecaPlan.Application/Abstractions/Security/IPasswordHashService.cs` y `MecaPlan.Application/Abstractions/Audit/IAuthenticationAuditWriter.cs` — Verificar: las interfaces no dependen de HTTP, SQL Server ni tipos de presentación.
- [ ] T006 [P] Crear los contratos de casos de uso y resultados en `MecaPlan.Application/Authentication/Commands/`, `MecaPlan.Application/Authentication/Results/` y `MecaPlan.Application/Authentication/IStudentAuthenticationService.cs` — Verificar: los contratos representan registro, login, logout y resultado genérico sin exponer contraseña ni hash.
- [ ] T007 Crear `MecaPlan.Infrastructure/Persistence/MecaPlanDbContext.cs` y configuraciones en `MecaPlan.Infrastructure/Persistence/Configurations/EstudianteConfiguration.cs` y `EventoAutenticacionConfiguration.cs` conforme a `data-model.md` — Verificar: mapean `Seguridad.Estudiantes` con `EstudianteID`, `Email` y `EmailNormalizado`, además de `Seguridad.EventosAutenticacion`, campos obligatorios e índices únicos de carnet/correo normalizado.
- [ ] T008 [P] Crear las entidades y reglas de invariantes en `MecaPlan.Domain/Entities/Estudiante.cs` y `MecaPlan.Domain/Entities/EventoAutenticacion.cs` — Verificar: no contienen tipos de MVC, EF Core, SQL ni secretos y representan los estados definidos en `data-model.md`.
- [ ] T009 Crear el preflight documentado para `MecaPlanDB` y datos heredados en `MecaPlan.Infrastructure/Persistence/Preflight/EstudiantesPreflight.cs` y `docs/database/SP1-preflight.md` — Verificar: detecta duplicados, `EstadoBit` nulo, `PasswordHash` nulo/vacío e informa bloqueo sin borrar, fusionar ni fabricar credenciales.
- [X] T010 Crear la migración versionada y script idempotente en `MecaPlan.Infrastructure/Migrations/`, `docs/database/SP1-deploy.sql` y `docs/database/SP1-rollback.md` — Verificar: adapta una copia aislada de `MecaPlanDB`, conserva `EstudianteID`, `Email` y `FechaRegistro`, añade índices/restricciones requeridos y bloquea datos heredados inseguros según el plan.
- [ ] T011 Implementar registro de dependencias de infraestructura en `MecaPlan.Infrastructure/DependencyInjection.cs` y composición en `MecaPlan/Program.cs` — Verificar: DbContext, repositorios, hasher, auditoría y servicios se resuelven por DI y ningún controlador crea conexiones SQL.
- [ ] T012 [P] Configurar el manejo seguro transversal de errores y correlación en `MecaPlan/Program.cs`, `MecaPlan/Controllers/HomeController.cs` y `MecaPlan/Views/Shared/Error.cshtml` — Verificar: errores inesperados devuelven un identificador de correlación y no muestran detalles internos, secretos, hashes o cadenas de conexión.
- [ ] T013 Preparar la infraestructura aislada de SQL Server para integración en `tests/MecaPlan.Infrastructure.IntegrationTests/DatabaseFixture.cs`, `tests/MecaPlan.Web.IntegrationTests/WebApplicationFactory.cs` y `docs/testing/SP1-test-database.md` — Verificar: las pruebas no usan una base de datos de producción ni secretos versionados y pueden aplicar migraciones en un entorno efímero.

**Checkpoint**: Base lista cuando la solución compila, las migraciones se aplican a una copia aislada de `MecaPlanDB` y los contratos/DI no rompen los límites de capas.

---

## Phase 3: User Story 1 - Registrar una cuenta de estudiante (Priority: P1) 🎯 MVP

**Goal**: Permitir que un visitante cree una única cuenta segura con nombre, apellido, carnet, correo y contraseña, sin revelar ni almacenar la contraseña legible.

**Independent Test**: Con una copia aislada de `MecaPlanDB`, registrar datos válidos crea una sola cuenta con hash no nulo; un correo/carnet repetido, campos inválidos o solicitudes concurrentes no crean una segunda cuenta.

### Tests for User Story 1

- [ ] T014 [P] [US1] Escribir pruebas unitarias de normalización, duplicados y contraseña de mínimo 8 caracteres con mayúscula, minúscula, número y símbolo en `tests/MecaPlan.Application.Tests/Authentication/RegisterStudentTests.cs` — Verificar: fallan antes del caso de uso y cubren FR-001, FR-002 y FR-004.
- [ ] T015 [P] [US1] Escribir pruebas de integración para hash obligatorio, índices únicos y registros concurrentes en `tests/MecaPlan.Infrastructure.IntegrationTests/Persistence/EstudiantesRegistrationTests.cs` — Verificar: fallan antes de repositorio/migración y cubren SC-001, SC-002 y NFR-003.
- [ ] T016 [P] [US1] Escribir pruebas web del contrato `GET/POST /Account/Register` en `tests/MecaPlan.Web.IntegrationTests/Account/RegisterEndpointTests.cs` — Verificar: fallan antes del controlador/vista y cubren antiforgery, validación, respuesta segura y accesible de registro.

### Implementation for User Story 1

- [X] T017 [US1] Implementar el repositorio de estudiantes en `MecaPlan.Infrastructure/Persistence/Repositories/EstudianteRepository.cs` usando el contexto y consultas parametrizadas — Verificar: busca por correo normalizado, persiste de forma atómica y traduce violaciones únicas a un resultado controlado.
- [X] T018 [US1] Implementar hashing/verificación encapsulada en `MecaPlan.Infrastructure/Security/AspNetPasswordHashService.cs` — Verificar: recibe una contraseña solo en memoria, produce/verifica hashes con `PasswordHasher` y no registra ni devuelve contraseña/hash a presentación.
- [ ] T019 [US1] Implementar auditoría de registro en `MecaPlan.Infrastructure/Audit/AuthenticationAuditWriter.cs` y `MecaPlan.Infrastructure/Persistence/Repositories/AuthenticationAuditWriter.cs` — Verificar: registra éxito/rechazo con fecha UTC y correlación, sin contraseña, hash, cookie ni cadena de conexión.
- [ ] T020 [US1] Implementar el caso de uso de registro en `MecaPlan.Application/Authentication/Services/StudentAuthenticationService.cs` — Verificar: valida/normaliza, solicita hash, crea estudiante y auditoría de forma coherente, y devuelve resultados seguros sin detalles de infraestructura.
- [ ] T021 [P] [US1] Crear el modelo de entrada accesible en `MecaPlan/ViewModels/Account/RegisterViewModel.cs` — Verificar: contiene únicamente nombre, apellido, carnet, correo, contraseña y confirmación; las contraseñas no se redistribuyen ni se conservan tras el POST.
- [ ] T022 [US1] Implementar `GET/POST Register` en `MecaPlan/Controllers/AccountController.cs` y la vista en `MecaPlan/Views/Account/Register.cshtml` — Verificar: usa antiforgery, delega al servicio, muestra estados/errores accesibles y no revela datos de cuentas existentes.
- [ ] T023 [US1] Ejecutar y ajustar la evidencia de registro en `tests/MecaPlan.Application.Tests/Authentication/RegisterStudentTests.cs`, `tests/MecaPlan.Infrastructure.IntegrationTests/Persistence/EstudiantesRegistrationTests.cs` y `tests/MecaPlan.Web.IntegrationTests/Account/RegisterEndpointTests.cs` — Verificar: todas pasan y confirman que `PasswordHash` existe pero nunca aparece en respuesta, URL ni logs de prueba.

**Checkpoint**: US1 es demostrable de forma independiente y satisface SP-12, SP-13 y la parte de registro de SP-11.

---

## Phase 4: User Story 2 - Iniciar sesión y llegar al dashboard (Priority: P1)

**Goal**: Permitir que un estudiante activo se autentique, llegue al dashboard y cierre su sesión sin exponer cuál credencial falló.

**Independent Test**: Con un estudiante activo creado por fixture, credenciales válidas llevan al dashboard; correo inexistente, contraseña incorrecta y cuenta inactiva producen el mismo mensaje y no crean sesión.

### Tests for User Story 2

- [ ] T024 [P] [US2] Escribir pruebas unitarias de verificación de credenciales, cuenta inactiva y mensaje genérico en `tests/MecaPlan.Application.Tests/Authentication/LoginStudentTests.cs` — Verificar: fallan antes del flujo de login y cubren FR-005, FR-007 y FR-014.
- [ ] T025 [P] [US2] Escribir pruebas web para `GET/POST /Account/Login`, cookie de sesión, retorno local y `POST /Account/Logout` en `tests/MecaPlan.Web.IntegrationTests/Account/LoginLogoutEndpointTests.cs` — Verificar: fallan antes de las acciones MVC y cubren el contrato de autenticación.
- [ ] T026 [P] [US2] Escribir prueba de redirección de dashboard y mensaje uniforme para credenciales inválidas en `tests/MecaPlan.Web.IntegrationTests/Dashboard/DashboardRedirectTests.cs` — Verificar: falla antes de proteger dashboard y cubre SP-14, SC-003 y SC-004.

### Implementation for User Story 2

- [ ] T027 [US2] Completar el flujo de autenticación y bloqueo de intentos en `MecaPlan.Application/Authentication/Services/StudentAuthenticationService.cs` y `MecaPlan.Application/Authentication/RateLimiting/AuthenticationAttemptPolicy.cs` — Verificar: verifica hash, rechaza estado inactivo con resultado indistinguible, bloquea 15 minutos tras 5 fallos en 15 minutos y no filtra correo/contraseña en auditoría.
- [ ] T028 [US2] Configurar autenticación por cookie, antiforgery, rutas de login/acceso y orden de middleware en `MecaPlan/Program.cs` — Verificar: la cookie es de sesión `Secure`, `HttpOnly`, `SameSite=Lax`; autenticación precede autorización y no existe "recordarme".
- [ ] T029 [P] [US2] Crear modelos de login y dashboard en `MecaPlan/ViewModels/Account/LoginViewModel.cs` y `MecaPlan/ViewModels/Dashboard/DashboardViewModel.cs` — Verificar: contienen solo datos necesarios para presentación y ningún secreto persistente.
- [ ] T030 [US2] Implementar `GET/POST Login` y `POST Logout` en `MecaPlan/Controllers/AccountController.cs` — Verificar: valida destino local, crea claims mínimos al autenticar, borra cookie al salir y usa un único mensaje para cualquier inicio inválido.
- [ ] T031 [US2] Implementar la ruta protegida en `MecaPlan/Controllers/DashboardController.cs` y la vista en `MecaPlan/Views/Dashboard/Index.cshtml` — Verificar: una sesión válida llega al dashboard; sin sesión se redirige al login sin contenido protegido.
- [ ] T032 [US2] Implementar formularios de login y navegación de sesión en `MecaPlan/Views/Account/Login.cshtml` y `MecaPlan/Views/Shared/_Layout.cshtml` — Verificar: son navegables por teclado, presentan estados de carga/error y exponen solo acciones válidas para el estado de sesión.
- [ ] T033 [US2] Ejecutar y ajustar pruebas de autenticación en `tests/MecaPlan.Application.Tests/Authentication/LoginStudentTests.cs`, `tests/MecaPlan.Web.IntegrationTests/Account/LoginLogoutEndpointTests.cs` y `tests/MecaPlan.Web.IntegrationTests/Dashboard/DashboardRedirectTests.cs` — Verificar: todas pasan, la redirección llega a dashboard y los tres tipos de credencial inválida devuelven el mismo mensaje.

**Checkpoint**: US2 satisface SP-11 y SP-14; el estudiante puede iniciar/cerrar sesión de forma segura y navegar al dashboard protegido.

---

## Phase 5: User Story 3 - Proteger recursos personales (Priority: P1)

**Goal**: Proteger el dashboard y establecer una base reutilizable que derive el `StudentId` únicamente de la identidad autenticada.

**Independent Test**: Dos identidades autenticadas distintas no pueden sustituir el `StudentId` de su contexto; una solicitud sin sesión no recibe el dashboard.

### Tests for User Story 3

- [ ] T034 [P] [US3] Escribir pruebas unitarias del contexto de estudiante y validación de claim en `tests/MecaPlan.Application.Tests/Security/CurrentStudentContextTests.cs` — Verificar: fallan antes de la implementación y rechazan claims ausentes, inválidos o manipulados.
- [ ] T035 [P] [US3] Escribir pruebas de integración de visitante, dos estudiantes y manipulación de identificador en `tests/MecaPlan.Web.IntegrationTests/Authorization/StudentOwnershipTests.cs` — Verificar: fallan antes de las protecciones y confirman que no se sustituye el `StudentId` de la sesión ni se muestra el dashboard a visitantes.

### Implementation for User Story 3

- [ ] T036 [US3] Definir el contrato de identidad propietaria en `MecaPlan.Application/Abstractions/Security/ICurrentStudentContext.cs` — Verificar: expone un `StudentId` validado y no acepta identificadores provenientes de formularios/rutas como fuente de autorización.
- [ ] T037 [US3] Implementar extracción segura de claims en `MecaPlan/Security/CurrentStudentContext.cs` y registrarla en `MecaPlan/Program.cs` — Verificar: solo una cookie autenticada puede establecer el contexto y los valores inválidos niegan el acceso.
- [ ] T038 [US3] Aplicar autorización obligatoria y manejo de acceso denegado en `MecaPlan/Controllers/DashboardController.cs`, `MecaPlan/Controllers/AccountController.cs` y `MecaPlan/Views/Shared/Error.cshtml` — Verificar: visitantes son dirigidos al login y peticiones con identidad inválida no muestran contenido del dashboard.
- [ ] T039 [US3] Crear guía de reutilización de filtro por propietario en `docs/security/owner-scoping.md` y enlazarla desde `specs/001-student-auth/contracts/authentication-mvc.md` — Verificar: una futura especificación de proyectos, BOM, inventario o diagnósticos tiene un contrato claro para filtrar por `StudentId` autenticado sin duplicar reglas.
- [ ] T040 [US3] Ejecutar y ajustar las pruebas de propiedad en `tests/MecaPlan.Application.Tests/Security/CurrentStudentContextTests.cs` y `tests/MecaPlan.Web.IntegrationTests/Authorization/StudentOwnershipTests.cs` — Verificar: ambas pasan y documentan el límite de SP1: protege dashboard/contexto, mientras los recursos de negocio serán cubiertos por sus propias especificaciones.

**Checkpoint**: US3 satisface FR-008 y establece la regla reutilizable de FR-009 sin implementar módulos de proyectos, BOM, inventario o diagnósticos fuera del alcance.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Completar calidad, despliegue, documentación y evidencia de entrega sin añadir comportamiento no especificado.

- [ ] T041 [P] Revisar atributos de seguridad, cabeceras, antiforgery, cookie, retorno local y mensajes de error en `MecaPlan/Program.cs`, `MecaPlan/Controllers/AccountController.cs` y `docs/security/SP1-security-review.md` — Verificar: la revisión confirma FR-003, FR-007, FR-012 a FR-014 y no encuentra secretos o datos sensibles expuestos.
- [ ] T042 [P] Documentar despliegue, preflight, migración, reversión y configuración externa en `docs/database/SP1-preflight.md`, `docs/database/SP1-deploy.sql`, `docs/database/SP1-rollback.md` y `docs/configuration/secrets.md` — Verificar: una persona puede preparar una copia aislada de `MecaPlanDB` o detectar bloqueo heredado sin usar secretos reales.
- [ ] T043 Ejecutar validación completa de la guía en `specs/001-student-auth/quickstart.md` y registrar evidencia en `docs/testing/SP1-validation-evidence.md` — Verificar: se cubren escenarios A-E, FR-001 a FR-014 y SC-001 a SC-006, incluidas pruebas de acceso no autorizado y registro concurrente.
- [ ] T044 Ejecutar restauración, compilación limpia, todas las pruebas y revisión de cambios con `MecaPlan.slnx`, `tests/` y `specs/001-student-auth/` — Verificar: no hay advertencias nuevas, pruebas fallidas, código muerto, cambios no relacionados ni secretos versionados.
- [ ] T045 Actualizar trazabilidad de entrega en `specs/001-student-auth/tasks.md`, `specs/001-student-auth/quickstart.md` y `docs/testing/SP1-validation-evidence.md` — Verificar: cada SP-11 a SP-14, FR, SC, migración y prueba tiene evidencia enlazada antes de solicitar revisión.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (T001-T004)
        ↓
Phase 2 (T005-T013) ── bloquea toda historia
        ↓
US1: Registro (T014-T023) ── MVP técnico y funcional
        ↓
US2: Login/dashboard (T024-T033)
        ↓
US3: Aislamiento reutilizable (T034-T040)
        ↓
Polish y evidencia (T041-T045)
```

### User Story Dependencies

- **US1 (P1)** depende de la fase fundacional. Entrega registro seguro y es el MVP recomendado.
- **US2 (P1)** depende de US1 para disponer de persistencia, cuenta de fixture y servicio de hash; sus pruebas pueden preparar estudiantes directamente desde la infraestructura de prueba.
- **US3 (P1)** depende de US2 porque el contexto de propietario se basa en el claim emitido durante login. No crea recursos de negocio fuera de SP1.
- **Polish** depende de las tres historias completadas y de sus pruebas aprobadas.

### Parallel Opportunities

- Tras T001, T003 y T004 pueden realizarse en paralelo; T002 depende de los proyectos creados por T001.
- En fase fundacional, T006, T008 y T012 pueden realizarse en paralelo una vez exista T001/T002; T007 depende de los proyectos y paquetes; T009 depende de T007; T010 depende de T007 y T009; T011 depende de T005-T008 y T010; T013 depende de T010 y T011.
- Dentro de US1, T014-T016 pueden escribirse en paralelo; T021 puede realizarse en paralelo con T017-T020 una vez se acuerden los contratos.
- Dentro de US2, T024-T026 pueden escribirse en paralelo; T029 puede ejecutarse en paralelo con T027-T028.
- Dentro de US3, T034 y T035 pueden escribirse en paralelo.
- T041 y T042 pueden ejecutarse en paralelo tras completar las historias; T043-T045 siguen después de esa evidencia.

## Parallel Example: User Story 1

```text
En paralelo, después de la fase fundacional:
- T014: pruebas unitarias de registro en tests/MecaPlan.Application.Tests/Authentication/RegisterStudentTests.cs
- T015: pruebas de integración de persistencia en tests/MecaPlan.Infrastructure.IntegrationTests/Persistence/EstudiantesRegistrationTests.cs
- T016: pruebas web de registro en tests/MecaPlan.Web.IntegrationTests/Account/RegisterEndpointTests.cs

En paralelo, cuando los contratos estén definidos:
- T017: repositorio en MecaPlan.Infrastructure/Persistence/Repositories/EstudianteRepository.cs
- T018: hasher en MecaPlan.Infrastructure/Security/AspNetPasswordHashService.cs
- T021: modelo de vista en MecaPlan/ViewModels/Account/RegisterViewModel.cs
```

## Implementation Strategy

### MVP First: US1

1. Completar fases 1 y 2, incluida la migración comprobada en una copia aislada de `MecaPlanDB`.
2. Completar T014-T023 para registro seguro.
3. Detenerse y validar el checkpoint de US1: alta única, hash no expuesto, duplicados bloqueados y formularios accesibles.
4. Solo después continuar a US2.

### Incremental Delivery

1. Base de capas, migración y DI aprobadas.
2. US1 entrega registro seguro y verificable.
3. US2 añade sesión, login, logout y dashboard protegido.
4. US3 consolida el patrón de aislamiento de propietario para módulos posteriores.
5. Phase 6 completa documentación, seguridad y evidencia de entrega.

## Notes

- Todos los cambios de infraestructura, dependencias y migraciones requieren revisión antes de aplicarse a una base compartida.
- Los commits deben ser atómicos por tarea o grupo lógico, sin mezclar cambios ajenos a SP1.
- Ninguna tarea autoriza `push`, despliegue, modificación de infraestructura externa ni uso de secretos reales sin aprobación explícita del usuario.

## Phase 7: Convergence

- [ ] T046 CRITICAL Implementar el preflight bloqueante, la migración EF Core versionada y los scripts SQL idempotentes de despliegue/reversión para `Seguridad.Estudiantes` y `Seguridad.EventosAutenticacion`, preservando los datos existentes y sin fabricar hashes per Constitución III, T009-T010 (missing).
- [ ] T047 CRITICAL Crear pruebas de integración contra SQL Server aislado para hash obligatorio, índices únicos de carnet/correo, concurrencia de registro, migración y bloqueo de datos heredados inválidos per FR-003, FR-004, NFR-003, T013, T015, T023 (missing).
- [ ] T048 CRITICAL Crear pruebas web reproducibles para Register, Login, Logout, antiforgery, cookie, retorno local, dashboard protegido y manipulación de identidad per FR-005 a FR-010, SC-003 a SC-005, T016, T025-T026, T033, T035, T040 (missing).
- [ ] T049 Completar el servicio y repositorio de autenticación para detectar carnet duplicado antes de persistir, traducir conflictos de ambos índices, auditar logout/acceso rechazado y conservar el rate limit de forma segura para el entorno configurado per FR-004, FR-011, FR-014, T017, T019, T027, T030, T038 (partial).
- [ ] T050 Validar claims ausentes, inválidos o manipulados, documentar el filtro reutilizable de propietario y cubrirlo con pruebas unitarias per FR-009, T034, T036-T039 (partial).
- [ ] T051 Completar accesibilidad y UX: mensajes de validación de campo, estados de envío, navegación condicionada por sesión, pantalla de error segura y pruebas de teclado per FR-012, FR-013, T012, T021, T029, T032 (partial).
- [ ] T052 Documentar configuración externa de secretos, preflight, despliegue, revisión de seguridad y base de pruebas SQL aislada per Constitución III, T004, T041-T042 (missing).
- [ ] T053 Ejecutar la guía completa, registrar evidencia FR-001 a FR-014 y SC-001 a SC-006, actualizar la trazabilidad y marcar solamente las tareas verificadas per Constitución VII-VIII, T043-T045 (missing).
