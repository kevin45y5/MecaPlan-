# Revisión de seguridad SP-1

- POST de registro, login y logout usan antiforgery.
- La cookie es de sesión, `HttpOnly` y `SameSite=Lax`; es `Secure` fuera de Development y sigue el esquema de la petición en localhost para permitir el perfil HTTP documentado.
- El retorno de login se limita a rutas locales.
- Las contraseñas se procesan únicamente para hashing/verificación y nunca se incluyen en auditoría.
- Los errores de credenciales usan un mensaje uniforme.
- La validación final debe incluir pruebas SQL aisladas y pruebas web antes de entrega.
