# Implementation Plan: Registro de ideas de prototipos

**Branch**: `002-register-prototype-ideas` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-register-prototype-ideas/spec.md`

## Summary

Agregar una API autenticada para registrar ideas mecatrónicas. El controlador valida el contrato y la propiedad; un servicio de aplicación coordina la creación, y la infraestructura persiste el proyecto con EF Core dentro de una transacción antes de invocar el contrato de BOM. La primera implementación de BOM es deliberadamente vacía. El modelo conserva el esquema `Proyectos` del repositorio y adapta de forma idempotente los nombres heredados de columnas si ya existen.

## Technical Context


**Language/Version**: C# / .NET 10.0.201

**Primary Dependencies**: ASP.NET Core MVC/API, Entity Framework Core 10.0.11, SQL Server provider

**Storage**: SQL Server; `Proyectos.Proyectos`, relacionada con `Seguridad.Estudiantes`; la tabla BOM existente queda detrás de `IBomService`

**Testing**: xUnit; pruebas unitarias de aplicación/controlador, pruebas web del contrato y prueba SQL opcional para persistencia/migración

**Target Platform**: ASP.NET Core en Windows para desarrollo académico local; servidor compatible con .NET 10 en despliegue

**Project Type**: Aplicación web MVC con endpoint API JSON

**Performance Goals**: Confirmación local en menos de dos segundos cuando el generador base no realiza trabajo externo

**Constraints**: Identidad derivada de cookie autenticada; DTO compatible con `EstudianteID` pero sin confiar en él; fecha UTC; transacción sin registros parciales; migración no destructiva; secretos fuera de Git

**Scale/Scope**: Un endpoint de creación, una entidad, dos contratos de aplicación, una implementación base de BOM y pruebas asociadas; no incluye CRUD adicional ni generación real de materiales

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicidad académica**: PASS. Se añade solo el flujo de alta y un generador vacío, sin infraestructura externa.
- **II. Especificación antes de código**: PASS. `spec.md`, este plan y `tasks.md` preceden la implementación.
- **III. Capas y datos claros**: PASS. Dominio contiene la entidad; aplicación contratos/orquestación; infraestructura EF/BOM; web el DTO/controlador. El cambio de esquema será idempotente y no destructivo.
- **IV. Seguridad proporcional**: PASS. La ruta requiere sesión y compara el ID declarado contra `ICurrentStudentContext`; no se versionan secretos.
- **V. Calidad verificable**: PASS. Se planifican pruebas de validación, propiedad, invocación BOM, transacción y contrato HTTP.

**Revisión posterior al diseño**: PASS. Los artefactos conservan el alcance, la separación y las verificaciones anteriores sin excepciones constitucionales.

## Project Structure

### Documentation (this feature)

```text
specs/002-register-prototype-ideas/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/           # Phase 1 output ($speckit-plan command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

### Source Code (repository root)

```text
MecaPlan.Domain/
└── Entities/Proyecto.cs

MecaPlan.Application/
└── Projects/
    ├── IBomService.cs
    └── IProyectoCreationService.cs

MecaPlan.Infrastructure/
├── Persistence/
│   ├── MecaPlanDbContext.cs
│   └── Configurations/ProyectoConfiguration.cs
├── Projects/ProyectoCreationService.cs
├── Bom/DummyBomService.cs
└── Migrations/

MecaPlan/
├── Controllers/ProyectosController.cs
└── Dtos/Projects/CrearProyectoDto.cs

tests/
├── MecaPlan.Application.Tests/Projects/
├── MecaPlan.Infrastructure.IntegrationTests/Persistence/
└── MecaPlan.Web.IntegrationTests/Projects/

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: Extender las cuatro capas existentes. El controlador no accede directamente al contexto; el servicio de creación en infraestructura coordina EF Core y `IBomService`, mientras aplicación conserva contratos independientes de SQL/HTTP.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
No hay violaciones que justificar.
