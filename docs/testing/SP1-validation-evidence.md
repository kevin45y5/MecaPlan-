# Evidencia de validación — SP1

**Fecha:** 2026-08-25  
**Entorno SQL:** `MecaPlanDB_SP1_Test` (copia aislada sin datos de `MecaPlanDB`).

## Migración

- Migración aplicada: `20260825055445_InitialStudentAuthentication`.
- Resultado: correcta sobre el esquema existente, sin recrear `Seguridad.Estudiantes`.
- Base principal `MecaPlanDB`: no modificada.

## Validación automatizada

| Área | Resultado | Evidencia |
|---|---:|---|
| Aplicación | 6 correctas | Contraseña, registro y política de intentos. |
| Web MVC | 3 correctas | Dashboard protegido y contexto `StudentId`. |
| Integración SQL | 1 correcta | Hash persistido y rechazo de correo duplicado en SQL Server. |
| Compilación | Correcta | 0 advertencias, 0 errores. |

## Requisitos respaldados

- FR-002 y FR-003: contraseña fuerte y hash no reversible.
- FR-004: correo duplicado rechazado por persistencia SQL.
- FR-008 y FR-009: dashboard protegido y contexto autenticado.
- FR-014: limitación temporal de intentos cubierta en aplicación.

## Límite de la evidencia

La validación usa exclusivamente la base aislada. Antes de aplicar cualquier migración a `MecaPlanDB`, se requiere una autorización independiente del propietario.
