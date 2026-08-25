# Configuración local de MecaPlan

## Requisitos

- .NET SDK 10.0.201 (la versión está fijada en `global.json`).
- SQL Server o SQL Server Express.
- SQL Server Management Studio (SSMS), recomendado para administrar la base.

## Base de datos local

1. Conectarse en SSMS a `localhost\SQLEXPRESS` mediante Autenticación de Windows.
2. Si SSMS pide validar un certificado local, marcar **Confiar en el certificado de servidor**.
3. Ejecutar `docs/database/create-mecaplandb.sql` una sola vez.

## Cadena de conexión privada

La cadena no debe agregarse a `appsettings.json` ni confirmarse en Git. Cada integrante debe ejecutar, desde la raíz del repositorio:

```powershell
dotnet user-secrets set "ConnectionStrings:MecaPlan" "Server=localhost\SQLEXPRESS;Database=MecaPlanDB;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True" --project MecaPlan\MecaPlan.csproj
```

Si se usa otra instancia, se reemplaza solamente el valor de `Server`.

## Ejecutar

```powershell
dotnet restore MecaPlan.slnx --disable-parallel -m:1
dotnet run --project MecaPlan\MecaPlan.csproj --launch-profile https
```

No versionar archivos del almacén de secretos ni copias locales de la base de datos.
