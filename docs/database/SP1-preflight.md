# Preflight de SP-1

Antes de aplicar la migración sobre una copia aislada de `MecaPlanDB`, configure
`ConnectionStrings__MecaPlan` o User Secrets y ejecute `EstudiantesPreflight`.

El despliegue se bloquea si hay carnets duplicados, correos duplicados tras
normalización, hashes nulos/vacíos, `EstadoBit` nulo o una columna de estado
ausente. No se eliminan ni fusionan cuentas, ni se fabrican contraseñas o hashes.

Guarde el resultado del preflight junto con la evidencia de entrega antes de
aplicar la migración en la copia aislada.
