/*
  Despliegue idempotente de SP1.

  La migración EF 20260825055445_InitialStudentAuthentication es la fuente
  versionada del DDL y registra su ejecución en __EFMigrationsHistory.
  Antes: use una copia aislada, configure ConnectionStrings__MecaPlan fuera del
  repositorio y ejecute el preflight.

  dotnet ef database update --project MecaPlan.Infrastructure/MecaPlan.Infrastructure.csproj --startup-project MecaPlan/MecaPlan.csproj

  La migración se bloquea ante hashes vacíos, EstadoBit nulo/ausente, carnets
  duplicados o correos duplicados tras normalización.
*/
