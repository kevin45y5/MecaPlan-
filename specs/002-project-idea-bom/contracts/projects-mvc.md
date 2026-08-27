# Contrato MVC: ideas y BOM (SP2)

| Ruta | Método | Requisito | Resultado |
|---|---|---|---|
| `/Projects/Create` | GET | Sesión válida | Muestra nombre, descripción y Enviar. |
| `/Projects/Create` | POST | Sesión válida y antiforgery | Guarda proyecto y muestra resultado de BOM. |
| `/Projects/Result/{id}` | GET | Sesión válida y propietario | Muestra solo el proyecto propio y su BOM. |

- El formulario no recibe `EstudianteID`.
- Un resultado sin componentes comunica que no se detectaron componentes, sin inventar datos.
