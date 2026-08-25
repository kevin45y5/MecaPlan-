# Evidencia de validación — SP1

**Fecha:** 2026-08-25

## Validación local reproducible

```powershell
dotnet build MecaPlan.slnx --no-restore --verbosity minimal -m:1 -p:UseSharedCompilation=false
dotnet test MecaPlan.slnx --no-build --verbosity minimal -m:1
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

## Ejecución actual

La validación local más reciente terminó con 13 pruebas correctas, 2 pruebas SQL omitidas por no configurar `MECAPLAN_TEST_CONNECTION`, 0 errores y 0 advertencias de compilación. La omisión es intencional: cada integrante ejecuta la cobertura SQL contra su propia copia aislada siguiendo `docs/testing/SP1-test-database.md`.
