# Alcance por propietario autenticado

Los controladores y servicios obtienen el estudiante actual de `ICurrentStudentContext`. Su `StudentId` proviene exclusivamente del claim emitido por la cookie autenticada; formularios, query strings y rutas no son fuentes válidas de propiedad.

Los módulos futuros deben filtrar lectura y escritura por ese identificador y responder sin revelar la existencia de recursos ajenos.
