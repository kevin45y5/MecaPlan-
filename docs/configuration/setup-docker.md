# Setup local con Docker (SP3+)

Guía alternativa a `local-development.md` para máquinas donde el instalador de
SQL Server falla (Windows en culturas no soportadas como es-SV). Usa SQL Server
2022 en un contenedor y autenticación SQL en lugar de Windows Auth.

## 1. Requisitos

- Git
- Docker Desktop (con el motor iniciado; verificar con `docker ps`)
- .NET SDK **10.0.201** exacto (`winget install Microsoft.DotNet.SDK.10 --version 10.0.201`).
  `global.json` exige esa banda de versión; una más nueva no compila.

## 2. Contenedor de SQL Server

Elegir una contraseña propia que cumpla la política de SQL (mayúscula,
minúscula, número, símbolo, mínimo 8 caracteres). No usar la de otra persona:

```powershell
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<TuPasswordAqui>" `
  -p 1433:1433 --name mecaplan-sql --restart unless-stopped `
  -d mcr.microsoft.com/mssql/server:2022-latest
```

Esperar ~30 s y validar:

```powershell
docker exec mecaplan-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "<TuPasswordAqui>" -C -Q "SELECT @@VERSION"
```

## 3. Crear la base

Desde la raíz del repositorio (el script es idempotente):

```powershell
Get-Content docs\database\create-mecaplandb.sql -Raw | docker exec -i mecaplan-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "<TuPasswordAqui>" -C -d master
```

Luego aplicar la migración SP1:

```powershell
dotnet tool restore
dotnet restore MecaPlan.slnx
dotnet ef database update --project MecaPlan.Infrastructure\MecaPlan.Infrastructure.csproj --startup-project MecaPlan\MecaPlan.csproj
```

## 4. Cadena de conexión privada

Nunca versionar la contraseña. Configurar user-secrets:

```powershell
dotnet user-secrets set "ConnectionStrings:MecaPlan" "Server=localhost,1433;Database=MecaPlanDB;User Id=sa;Password=<TuPasswordAqui>;TrustServerCertificate=True;MultipleActiveResultSets=True;Encrypt=True" --project MecaPlan\MecaPlan.csproj
```

## 5. Base aislada para pruebas de integración

Los tests de persistencia exigen la variable de entorno `MECAPLAN_TEST_CONNECTION`
apuntando a una copia aislada (`docs/testing/SP1-test-database.md`):

```powershell
docker exec mecaplan-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "<TuPasswordAqui>" -C -Q "BACKUP DATABASE MecaPlanDB TO DISK='/var/opt/mssql/data/mp.bak' WITH INIT; RESTORE DATABASE MecaPlanDB_Test FROM DISK='/var/opt/mssql/data/mp.bak' WITH MOVE 'MecaPlanDB' TO '/var/opt/mssql/data/MecaPlanDB_Test.mdf', MOVE 'MecaPlanDB_log' TO '/var/opt/mssql/data/MecaPlanDB_Test_log.ldf';"

[Environment]::SetEnvironmentVariable("MECAPLAN_TEST_CONNECTION", "Server=localhost,1433;Database=MecaPlanDB_Test;User Id=sa;Password=<TuPasswordAqui>;TrustServerCertificate=True;MultipleActiveResultSets=True;Encrypt=True", "User")
```

Cerrar y reabrir la terminal para que la variable se cargue.

## 6. Ejecutar y probar

```powershell
dotnet dev-certs https --trust
dotnet build MecaPlan.slnx
dotnet test MecaPlan.slnx
dotnet run --project MecaPlan\MecaPlan.csproj --launch-profile https
```

La app queda en `https://localhost:7102`. El checklist BOM está en `/Bom`.

## 7. Alcance SP3 (rama propia desde main)

División de archivos acordada para evitar conflictos:

| Quién | Archivos |
|---|---|
| Frontend/UI (rama `feature/sp3-checklist-bom`) | `MecaPlan\Controllers\BomController.cs`, `MecaPlan\Views\Bom\*`, `MecaPlan\Models\Bom\*`, `MecaPlan\wwwroot\js\bom-checklist.js` |
| Backend/persistencia | `MecaPlan.Infrastructure\*` (mapeo EF de Proyectos/BOM/Componentes, servicio o endpoint que actualice `EsFaltante`) y tests |

Contrato que consume el frontend y debe implementar el backend:

```
POST /Bom/Toggle
Content-Type: application/json
Body: { "bomId": <int>, "esFaltante": <bool> }
```

Al recibirlo: actualizar `Proyectos.BOMProyectos.EsFaltante` para ese `BOMID`
(0 = componente disponible, 1 = falta comprar) y responder 200.
El frontend ya envía ese payload en cada cambio de checkbox
(`wwwroot/js/bom-checklist.js`, configurable vía `data-toggle-url`).

Los datos semilla (proyecto Seguidor Solar, componentes y BOM) existen solo en
la BD local compartida; para reproducirlos ver el historial del PR de SP3.
