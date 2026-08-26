# Modelo de datos: SP2

## Proyecto

| Campo | Regla |
|---|---|
| ProyectoID | Identificador generado por persistencia. |
| EstudianteID | Obligatorio; propietario autenticado. |
| NombreProyecto | Obligatorio, máximo 150 caracteres. |
| DescripcionIdea | Obligatoria, máximo 4,000 caracteres. |
| FechaCreacion | UTC y asignada automáticamente. |

## Entrada BOM

| Campo | Regla |
|---|---|
| BOMID | Identificador generado por persistencia. |
| ProyectoID | Obligatorio; proyecto propietario. |
| Componente | Nombre del componente identificado. |
| CantidadRequerida | Entero mayor que cero. |

## Relaciones

- Un estudiante puede registrar muchos proyectos.
- Un proyecto puede tener cero o muchas entradas de BOM.
