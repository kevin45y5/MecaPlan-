# Configuración local de MecaPlan

## Requisitos

- .NET SDK 10.0.201 (la versión está fijada en `global.json`).
- Git.
- SQL Server o SQL Server Express.
- SQL Server Management Studio (SSMS), recomendado para administrar la base.
- Visual Studio con desarrollo ASP.NET/.NET, opcional.

## Preparar el repositorio

```powershell
git pull origin main
dotnet restore MecaPlan.slnx --disable-parallel -m:1
dotnet tool restore
```

## Base de datos local

1. Conectarse en SSMS a `localhost\SQLEXPRESS` mediante Autenticación de Windows.
2. Si SSMS pide validar un certificado local, marcar **Confiar en el certificado de servidor**.
3. Ejecutar `docs/database/create-mecaplandb.sql` una sola vez.

## Cadena de conexión privada

La cadena no debe agregarse a `appsettings.json` ni confirmarse en Git. Cada integrante debe ejecutar, desde la raíz del repositorio:

```powershell
dotnet user-secrets set "ConnectionStrings:MecaPlan" "Server=.\SQLEXPRESS;Database=MecaPlanDB;Trusted_Connection=True;Encrypt=False;TrustServerCertificate=True;MultipleActiveResultSets=True" --project MecaPlan\MecaPlan.csproj
```

Si se usa otra instancia, se reemplaza solamente el valor de `Server`.

Aplicar las migraciones a la base local configurada:

```powershell
dotnet ef database update --project MecaPlan.Infrastructure\MecaPlan.Infrastructure.csproj --startup-project MecaPlan\MecaPlan.csproj
```

## Ejecutar

```powershell
dotnet run --project MecaPlan\MecaPlan.csproj --launch-profile http
```

Abrir `http://localhost:5180`. Para probar HTTPS local, usar en su lugar el perfil `https` y ejecutar una vez:

```powershell
dotnet dev-certs https --clean
dotnet dev-certs https --trust
```

No versionar archivos del almacén de secretos ni copias locales de la base de datos.

## API de proyectos

Después de aplicar la migración más reciente, un estudiante autenticado puede registrar una idea mediante `POST /api/proyectos`. El cuerpo, estados y reglas de propiedad están documentados en `specs/002-register-prototype-ideas/contracts/proyectos-api.md`. El `EstudianteID` enviado debe coincidir con el de la sesión; nunca se usa como sustituto de la identidad autenticada.
