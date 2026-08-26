---
description: "Tareas de implementación para SP2: idea de prototipo y BOM automática"
---

# Tasks: SP2 - Idea de prototipo y BOM automática

## Phase 1: Setup

- [X] T001 Crear los artefactos de especificación de SP2 en `specs/002-project-idea-bom/`

## Phase 2: Foundation

- [X] T002 Crear las entidades `Proyecto` y `EntradaBom` en `MecaPlan.Domain/Entities/Proyecto.cs` y `MecaPlan.Domain/Entities/EntradaBom.cs`
- [X] T003 Crear contratos de proyecto, repositorio y generador en `MecaPlan.Application/Projects/Contracts.cs`
- [X] T004 Configurar persistencia, relaciones e índices en `MecaPlan.Infrastructure/Persistence/MecaPlanDbContext.cs` y `MecaPlan.Infrastructure/Persistence/Configurations/ProjectConfigurations.cs`
- [X] T005 Crear la migración segura de SP2 en `MecaPlan.Infrastructure/Migrations/`
- [X] T006 Registrar repositorio, generador y caso de uso en `MecaPlan.Infrastructure/DependencyInjection.cs`

## Phase 3: User Story 1 - Registrar idea (P1)

**Goal**: Un estudiante autenticado registra una idea asociada solo a su identidad.

- [X] T007 [P] [US1] Crear pruebas unitarias del caso de uso en `tests/MecaPlan.Application.Tests/Projects/ProjectIdeaServiceTests.cs`
- [X] T008 [P] [US1] Crear pruebas web de formulario, validación y propiedad en `tests/MecaPlan.Web.IntegrationTests/Projects/ProjectEndpointsTests.cs`
- [X] T009 [US1] Implementar `ProjectIdeaService` en `MecaPlan.Application/Projects/ProjectIdeaService.cs`
- [X] T010 [US1] Implementar repositorio atómico en `MecaPlan.Infrastructure/Persistence/Repositories/ProyectoRepository.cs`
- [X] T011 [P] [US1] Crear modelo de entrada y resultado en `MecaPlan/ViewModels/Projects/CreateProjectViewModel.cs` y `MecaPlan/ViewModels/Projects/ProjectResultViewModel.cs`
- [X] T012 [US1] Implementar rutas protegidas Create y Result en `MecaPlan/Controllers/ProjectsController.cs`
- [X] T013 [US1] Implementar formulario y resultado en `MecaPlan/Views/Projects/Create.cshtml` y `MecaPlan/Views/Projects/Result.cshtml`

## Phase 4: User Story 2 - Generar BOM (P1)

**Goal**: La idea genera de inmediato una BOM académica desde términos reconocidos.

- [X] T014 [P] [US2] Crear pruebas del catálogo y conteo de componentes en `tests/MecaPlan.Application.Tests/Projects/KeywordBomGeneratorTests.cs`
- [X] T015 [US2] Implementar generador local de BOM en `MecaPlan.Infrastructure/Projects/KeywordBomGenerator.cs`
- [X] T016 [US2] Integrar generación y guardado de BOM atómico en `MecaPlan.Application/Projects/ProjectIdeaService.cs`
- [X] T017 [US2] Mostrar componentes o resultado vacío seguro en `MecaPlan/Views/Projects/Result.cshtml`

## Phase 5: Validación y entrega

- [X] T018 Actualizar guía de uso de SP2 en `specs/002-project-idea-bom/quickstart.md`
- [X] T019 Ejecutar restauración, compilación y pruebas de SP1 y SP2; documentar evidencia en `docs/testing/SP2-validation-evidence.md`
- [X] T020 Marcar únicamente las tareas verificadas en `specs/002-project-idea-bom/tasks.md`

## Dependencies

- T002-T006 bloquean las historias.
- US1 (T007-T013) crea y protege el proyecto.
- US2 (T014-T017) completa la generación automática de BOM.
- T018-T020 se ejecutan tras las dos historias.
