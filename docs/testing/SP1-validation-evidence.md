# Evidencia de validación — SP1

**Fecha:** 2026-08-25

## Validación local reproducible

```powershell
dotnet test MecaPlan.slnx --no-restore --verbosity minimal
```

Resultado: 15 pruebas correctas, 0 errores y 0 advertencias de compilación.

| Área | Resultado | Cobertura principal |
|---|---:|---|
| Dominio | 1 correcta | Estado inicial y fecha UTC del estudiante. |
| Aplicación | 6 correctas | Contraseña, hash, normalización y límite de intentos. |
| Infraestructura | 2 correctas | Repositorio, hash, duplicados y concurrencia contra SQL Server aislado. |
| Web MVC | 6 correctas | Registro, antiforgery, retorno local, cookie, login/logout, dashboard y `StudentId`. |

La migración `20260825055445_InitialStudentAuthentication` se verificó contra
`MecaPlanDB_SP1_Test`: la base ya estaba actualizada y no se modificó `MecaPlanDB`.
La prueba SQL exige `MECAPLAN_TEST_CONNECTION`; fallará explícitamente si falta para
evitar falsos positivos. No se versiona esa cadena.
