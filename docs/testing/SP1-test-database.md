# Base de pruebas SP-1

Usar una copia aislada de SQL Server, indicada mediante `MECAPLAN_TEST_CONNECTION`. No apuntar pruebas ni migraciones a producción o a una base compartida. Ejecutar preflight y aplicar migraciones únicamente tras revisar el resultado.

Las pruebas SQL se omiten (no fallan) cuando esa variable no está configurada. Esto permite que un clon nuevo ejecute las pruebas unitarias y web sin acceder a SQL Server; antes de entregar cambios de migración, cada integrante debe configurarla y ejecutar también estas pruebas.

Para SQL Server Express local, usar el nombre de instancia y desactivar el cifrado si la instancia no lo admite:

```powershell
$env:MECAPLAN_TEST_CONNECTION = "Server=.\SQLEXPRESS;Database=MecaPlanDB_SP1_Test;Trusted_Connection=True;Encrypt=False;TrustServerCertificate=True"
```

## Error SSPI

Si SQL Server devuelve `No se puede generar contexto SSPI` o `El nombre principal no es correcto`, es un problema de autenticación Windows/SPN de la instancia local, no del código de SP1. En SSMS pruebe primero `localhost\SQLEXPRESS` con **Autenticación de Windows** y **Confiar en el certificado de servidor**. Si su equipo no puede usar autenticación integrada, use una cuenta SQL local creada por el administrador de la instancia y guarde su cadena solo en la variable de esta sesión; nunca en Git.
