# Base de pruebas SP-1

Usar una copia aislada de SQL Server, indicada mediante `MECAPLAN_TEST_CONNECTION`. No apuntar pruebas ni migraciones a producción o a una base compartida. Ejecutar preflight y aplicar migraciones únicamente tras revisar el resultado.

Para SQL Server Express local, usar el nombre de instancia y desactivar el cifrado si la instancia no lo admite:

```powershell
$env:MECAPLAN_TEST_CONNECTION = "Server=.\SQLEXPRESS;Database=MecaPlanDB_SP1_Test;Trusted_Connection=True;Encrypt=False;TrustServerCertificate=True"
```
