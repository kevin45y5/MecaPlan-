# Modelo de datos: Registro de ideas de prototipos

## Proyecto

Representa una idea mecatrónica propiedad de un estudiante autenticado.

| Campo | Tipo lógico | Reglas |
|---|---|---|
| `ProyectoID` | Entero | Clave primaria generada por persistencia. |
| `Nombre` | Texto | Obligatorio, recortado, máximo 150 caracteres. |
| `Descripcion` | Texto | Obligatorio, recortado, máximo de entrada 4000 caracteres. |
| `FechaCreacion` | Fecha/hora | Obligatoria, asignada por el servidor en UTC. |
| `EstudianteID` | Entero | Obligatorio, positivo y derivado de la sesión autenticada. Clave foránea a `Seguridad.Estudiantes`. |

**Persistencia**: `Proyectos.Proyectos`. Un estudiante puede tener muchos proyectos; cada proyecto pertenece a un estudiante.

**Compatibilidad**: Si una base heredada conserva `NombreProyecto` o `DescripcionIdea`, la migración las renombra a `Nombre` y `Descripcion` sin modificar el contenido. Columnas heredadas adicionales pueden permanecer mientras tengan valores predeterminados compatibles.

## Lista de materiales del proyecto

Entidad ya prevista por la base de datos y asociada mediante `ProyectoID`. Esta entrega no define materiales ni cantidades; solo establece el contrato que una implementación posterior usará para poblarla.

## Flujo de estado

1. La solicitud se valida y se confirma que el propietario declarado coincide con la sesión.
2. Se crea el proyecto con fecha UTC y se guarda dentro de una transacción para obtener `ProyectoID`.
3. Se invoca la generación BOM con el identificador y descripción.
4. La transacción se confirma únicamente si la invocación finaliza; ante una excepción se revierte.
