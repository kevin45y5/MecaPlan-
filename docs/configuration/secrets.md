# Configuración externa de SP-1

La cadena de conexión nunca se versiona. Configurarla mediante User Secrets durante desarrollo:

```powershell
dotnet user-secrets set "ConnectionStrings:MecaPlan" "<cadena SQL Server>" --project MecaPlan/MecaPlan.csproj
```

En despliegue usar la configuración administrada del entorno con la clave `ConnectionStrings__MecaPlan`. No registrar ni copiar la cadena, contraseñas, cookies o hashes en documentación, pruebas o logs.
