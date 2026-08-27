# Tasks: Registro de ideas de prototipos

**Input**: Design documents from `/specs/002-register-prototype-ideas/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [API contract](./contracts/proyectos-api.md)

**Tests**: Obligatorios por incluir reglas nuevas de validación, propiedad, transacción e integración BOM.

**Organization**: Las tareas siguen las tres historias y conservan un incremento demostrable después de cada fase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo porque afecta archivos diferentes y no depende de una tarea incompleta.
- **[Story]**: Historia de usuario trazada desde `spec.md`.

## Phase 1: Setup

**Purpose**: Confirmar la base antes del cambio funcional.

- [x] T001 Ejecutar restauración, compilación y pruebas base de `MecaPlan.slnx`, registrando cualquier omisión SQL antes de editar código

---

## Phase 2: Foundational

**Purpose**: Definir los contratos compartidos que bloquean las historias.

- [x] T002 [P] Crear la entidad `Proyecto` con invariantes básicas en `MecaPlan.Domain/Entities/Proyecto.cs`
- [x] T003 [P] Crear `IProyectoCreationService` en `MecaPlan.Application/Projects/IProyectoCreationService.cs`

**Checkpoint**: Dominio y contrato de creación disponibles sin dependencias HTTP o SQL.

---

## Phase 3: User Story 1 - Registrar una idea de prototipo (Priority: P1) 🎯 MVP

**Goal**: Crear una idea válida con nombre, descripción, fecha UTC, propietario e identificador persistente.

**Independent Test**: Una creación válida devuelve `201` y una inválida devuelve `400` sin llamar al servicio.

### Tests for User Story 1

- [x] T004 [P] [US1] Crear pruebas del controlador para alta válida y validación de campos en `tests/MecaPlan.Web.IntegrationTests/Projects/ProyectosControllerTests.cs`
- [x] T005 [P] [US1] Crear prueba de metadatos EF para tabla, columnas, límites y relación de `Proyecto` en `tests/MecaPlan.Infrastructure.IntegrationTests/Persistence/ProyectoPersistenceTests.cs`

### Implementation for User Story 1

- [x] T006 [US1] Incorporar `DbSet<Proyecto>`, configuración EF y servicio de creación inicial en `MecaPlan.Infrastructure/Persistence/MecaPlanDbContext.cs`, `MecaPlan.Infrastructure/Persistence/Configurations/ProyectoConfiguration.cs` y `MecaPlan.Infrastructure/Projects/ProyectoCreationService.cs`
- [x] T007 [US1] Crear migración idempotente y actualizar el script local para `Proyectos.Proyectos` en `MecaPlan.Infrastructure/Migrations/` y `docs/database/create-mecaplandb.sql`
- [x] T008 [US1] Crear `CrearProyectoDto`, respuesta y `POST /api/proyectos` en `MecaPlan/Dtos/Projects/CrearProyectoDto.cs` y `MecaPlan/Controllers/ProyectosController.cs`
- [x] T009 [US1] Registrar el servicio de creación en `MecaPlan.Infrastructure/DependencyInjection.cs` y ajustar dobles en `tests/MecaPlan.Web.IntegrationTests/TestWebApplicationFactory.cs`

**Checkpoint**: El alta básica compila, valida y persiste una idea.

---

## Phase 4: User Story 2 - Proteger la propiedad de la idea (Priority: P1)

**Goal**: Impedir altas sin sesión o con un `EstudianteID` distinto al autenticado.

**Independent Test**: Una identidad coincidente crea; identidad distinta recibe `403`; visitante recibe `401`.

### Tests for User Story 2

- [x] T010 [P] [US2] Añadir pruebas unitarias de coincidencia, manipulación y ausencia de identidad en `tests/MecaPlan.Web.IntegrationTests/Projects/ProyectosControllerTests.cs`
- [x] T011 [P] [US2] Añadir prueba HTTP de acceso no autenticado al contrato en `tests/MecaPlan.Web.IntegrationTests/Projects/ProyectosEndpointTests.cs`

### Implementation for User Story 2

- [x] T012 [US2] Proteger el endpoint y derivar propietario desde `ICurrentStudentContext` en `MecaPlan/Controllers/ProyectosController.cs`

**Checkpoint**: Ningún cliente puede atribuir una idea a otro estudiante.

---

## Phase 5: User Story 3 - Solicitar la lista de materiales (Priority: P2)

**Goal**: Invocar el generador exactamente una vez y revertir el proyecto si la integración falla.

**Independent Test**: Un generador espía recibe ID/descripción una vez; un generador que falla impide confirmar la transacción.

### Tests for User Story 3

- [x] T013 [P] [US3] Añadir pruebas del contrato BOM e invocación desde creación en `tests/MecaPlan.Infrastructure.IntegrationTests/Persistence/ProyectoPersistenceTests.cs`

### Implementation for User Story 3

- [x] T014 [P] [US3] Crear `IBomService` y `DummyBomService` en `MecaPlan.Application/Projects/IBomService.cs` y `MecaPlan.Infrastructure/Bom/DummyBomService.cs`
- [x] T015 [US3] Integrar `IBomService` y la transacción de alta en `MecaPlan.Infrastructure/Projects/ProyectoCreationService.cs` y registrar el dummy en `MecaPlan.Infrastructure/DependencyInjection.cs`

**Checkpoint**: Una respuesta exitosa implica persistencia e invocación BOM coherentes.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T016 [P] Actualizar validación manual y contrato entregable en `specs/002-register-prototype-ideas/quickstart.md` y `docs/configuration/local-development.md`
- [x] T017 Ejecutar `dotnet build`, todas las pruebas, revisión de vulnerabilidades, comprobación del snapshot EF y `git diff --check` sobre `MecaPlan.slnx`

---

## Dependencies & Execution Order

```text
T001
  ↓
T002 + T003
  ↓
US1 (T004-T009)
  ↓
US2 (T010-T012)
  ↓
US3 (T013-T015)
  ↓
Polish (T016-T017)
```

- US1 depende de entidad y contrato compartido.
- US2 depende del endpoint creado por US1.
- US3 depende de la persistencia de US1; no cambia las reglas de propiedad de US2.
- Las tareas de pruebas marcadas `[P]` pueden escribirse en paralelo antes de sus implementaciones.

## Parallel Example: User Story 1

```text
Task: "Crear pruebas del controlador en tests/MecaPlan.Web.IntegrationTests/Projects/ProyectosControllerTests.cs"
Task: "Crear prueba EF en tests/MecaPlan.Infrastructure.IntegrationTests/Persistence/ProyectoPersistenceTests.cs"
```

## Implementation Strategy

1. Completar Setup y Foundational.
2. Entregar US1 como MVP verificable.
3. Añadir el control de propiedad de US2 antes de exponer el endpoint.
4. Añadir integración BOM transaccional en US3.
5. Validar guía, compilación, pruebas, migración y diff.
