# Preflight de SP-1

Antes de aplicar la migración en una copia aislada de `MecaPlanDB`, ejecutar `EstudiantesPreflight` con la cadena de conexión externa configurada como `ConnectionStrings__MecaPlan` o User Secrets.

El despliegue se bloquea si detecta carnets duplicados, correos duplicados tras normalización o hashes nulos/vacíos. Los estados nulos se informan para su revisión; no se eliminan filas, no se fusionan cuentas y nunca se fabrican contraseñas o hashes.

Aplicar primero sobre una copia de la base y guardar el resultado del preflight junto con la evidencia de entrega.
