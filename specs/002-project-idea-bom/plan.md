# Implementation Plan: SP2 - Idea de prototipo y BOM automática

**Branch**: `002-project-idea-bom` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Agregar una pantalla protegida para registrar el nombre y descripción de una idea. El caso de uso obtiene el estudiante de SP1, guarda el proyecto y ejecuta en la misma operación un generador local de BOM basado en un catálogo pequeño de palabras clave.

## Technical Context

**Language/Version**: C# / .NET 10  
**Primary Dependencies**: ASP.NET Core MVC, Entity Framework Core SQL Server  
**Storage**: SQL Server; esquemas existentes `Proyectos` e `Inventario`  
**Testing**: xUnit; unitarias, SQL opcionales y web MVC  
**Target Platform**: Aplicación web local en Windows con SQL Server Express  
**Project Type**: Monolito MVC en capas  
**Performance Goals**: Resultado visible en menos de 5 segundos localmente  
**Constraints**: Sin IA, APIs externas, precios, compras ni inventario; catálogo académico local y operación atómica  
**Scale/Scope**: Una pantalla de creación y resultado; catálogo inicial de Arduino Uno, sensor ultrasónico, motor DC, servomotor, driver L298N, batería y LED

## Constitution Check

| Principio | Estado | Decisión |
|---|---|---|
| Alcance académico | PASS | Generador local, pequeño y determinista. |
| Especificación antes de cambios | PASS | Artefactos completos de SP2. |
| Capas y datos claros | PASS | Reutiliza las cuatro capas de SP1. |
| Seguridad proporcional | PASS | `StudentId` procede de `ICurrentStudentContext`. |
| Calidad verificable | PASS | Pruebas de generación, propiedad, persistencia y web. |

## Project Structure

```text
MecaPlan.Domain/Entities/Proyecto.cs
MecaPlan.Domain/Entities/EntradaBom.cs
MecaPlan.Application/Projects/
MecaPlan.Infrastructure/Projects/KeywordBomGenerator.cs
MecaPlan.Infrastructure/Persistence/Repositories/ProyectoRepository.cs
MecaPlan/Controllers/ProjectsController.cs
MecaPlan/ViewModels/Projects/
MecaPlan/Views/Projects/
tests/MecaPlan.Application.Tests/Projects/
tests/MecaPlan.Web.IntegrationTests/Projects/
```

**Structure Decision**: Se amplían las cuatro capas existentes; no se agrega ningún proyecto, servicio remoto ni módulo independiente.

## Complexity Tracking

No aplica.
