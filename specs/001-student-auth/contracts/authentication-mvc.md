# Contrato MVC: autenticación de estudiantes (SP1)

Este contrato define el comportamiento observable de las páginas MVC. No es una API pública ni autoriza almacenamiento de secretos en el navegador.

## Rutas públicas

| Ruta | Método | Entrada | Resultado correcto | Errores seguros |
|---|---|---|---|---|
| `/Account/Register` | GET | Ninguna | Muestra formulario de registro accesible. | No aplica. |
| `/Account/Register` | POST | Nombre, apellido, carnet, correo, contraseña y confirmación; token antiforgery. | Crea cuenta y muestra confirmación o dirige al login según la decisión de UX fijada en tareas. | Datos inválidos: errores de campo. Conflicto: mensaje seguro, sin datos de otra cuenta. |
| `/Account/Login` | GET | Parámetro de retorno local opcional y validado. | Muestra formulario de inicio de sesión. | Ignora destinos externos o no válidos. |
| `/Account/Login` | POST | Correo, contraseña, destino local opcional y token antiforgery. | Crea sesión y dirige al dashboard, o a un destino local autorizado. | Credenciales inválidas/inactivo: mismo mensaje genérico. |

## Rutas autenticadas

| Ruta | Método | Requisito | Resultado |
|---|---|---|---|
| `/Dashboard/Index` | GET | Sesión de estudiante válida. | Muestra dashboard protegido del estudiante. |
| `/Account/Logout` | POST | Sesión válida y token antiforgery. | Elimina sesión y redirige al login o inicio público. |

## Contrato de autorización reutilizable

- El contexto autenticado expone un único identificador `StudentId` verificable.
- Ninguna acción acepta un identificador de estudiante del cliente para decidir propiedad.
- Un recurso personal solicitado con otro identificador se rechaza sin revelar su existencia ni contenido.
- Una página MVC protegida sin sesión redirige a `/Account/Login` con un destino local validado; futuras rutas de datos no HTML deben responder con estado de no autenticado/no autorizado.

## Mensajes y estados

- Inicio inválido: un único mensaje, por ejemplo, "No fue posible iniciar sesión con las credenciales proporcionadas." No distingue correo, contraseña, estado o existencia de cuenta.
- Registro: los errores de formato y obligatoriedad identifican el campo a corregir; la contraseña exige 8 caracteres con mayúscula, minúscula, número y símbolo. Los errores de unicidad no exponen datos de la cuenta existente.
- Bloqueo temporal: después de 5 intentos inválidos en 15 minutos, los nuevos intentos se bloquean durante 15 minutos con un mensaje que no revela el detalle de la protección.
- Errores inesperados: mensaje general con identificador de correlación, sin detalle técnico.
- Cada POST muestra estado de procesamiento y evita representar éxito si la operación falla.
