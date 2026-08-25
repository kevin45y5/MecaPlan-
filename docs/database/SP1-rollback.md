# Reversión de SP-1

No ejecutar una reversión automática sobre una base compartida. La migración añade tablas, columnas e índices de seguridad; revertir una adaptación de datos existente puede reintroducir valores nulos o duplicados.

La recuperación autorizada consiste en restaurar el respaldo aprobado de la copia aislada y volver a ejecutar el preflight. No borrar estudiantes ni eventos de auditoría como parte de una reversión.
