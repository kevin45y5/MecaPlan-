# Contrato API: Registro de proyectos

## `POST /api/proyectos`

Requiere una sesión de estudiante autenticada.

### Solicitud JSON

```json
{
  "nombre": "Brazo clasificador",
  "descripcion": "Brazo con sensores para separar piezas por color.",
  "estudianteId": 7
}
```

### Respuesta correcta — `201 Created`

Incluye cabecera `Location: /api/proyectos/{proyectoId}`.

```json
{
  "proyectoId": 42,
  "nombre": "Brazo clasificador",
  "descripcion": "Brazo con sensores para separar piezas por color.",
  "fechaCreacion": "2026-08-25T20:00:00Z",
  "estudianteId": 7
}
```

### Errores

| Estado | Condición |
|---|---|
| `400 Bad Request` | Campos ausentes, en blanco, demasiado largos o `EstudianteID` no positivo. |
| `401 Unauthorized` | No existe una sesión autenticada. |
| `403 Forbidden` | El `EstudianteID` declarado no coincide con la sesión. |
| `500 Internal Server Error` | Persistencia o generación BOM falla; se usa la pantalla/respuesta segura global sin detalles internos. |

Una solicitud rechazada no invoca el generador BOM. Una respuesta `201` implica que el proyecto recibió identificador y la invocación BOM finalizó correctamente.
