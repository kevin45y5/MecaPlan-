# Guía de validación: SP1 - Registro e inicio de sesión de estudiantes

## Objetivo

Probar de forma reproducible que SP1 registra estudiantes de manera segura, crea sesiones válidas, protege rutas y mantiene aislamiento de datos. Consultar [data-model.md](./data-model.md) y [authentication-mvc.md](./contracts/authentication-mvc.md) para los contratos que se validan.

## Prerrequisitos

1. Solución compilada en limpio con las dependencias aprobadas.
2. Copia aislada de la base SQL Server `MecaPlanDB` existente para desarrollo/pruebas, con cadena de conexión proporcionada fuera del repositorio.
3. Preflight ejecutado y migración SP1 aplicada a la copia aislada, sin modificar la base original ni ignorar conflictos de datos heredados.
4. Navegador con cookies habilitadas. Development admite `http://localhost:5180`; HTTPS se usa en entornos no Development o cuando se elige el perfil `https`.

## Escenarios de validación manual

### A. Registro correcto

1. Abrir `/Account/Register`.
2. Enviar nombre, apellido, carnet y correo únicos, contraseña válida y confirmación coincidente.
3. Confirmar que aparece un resultado de éxito sin mostrar contraseña ni hash.
4. Verificar en la persistencia que existe una sola fila, con `PasswordHash` no nulo, `EstadoBit` activo, y sin contraseña legible.

**Resultado esperado**: cuenta creada una sola vez; datos de identidad y contraseña no aparecen en pantalla, URL ni registros de aplicación.

### B. Duplicados y validación

1. Repetir el registro con el mismo correo y luego con el mismo carnet.
2. Probar correo inválido, datos faltantes, contraseña de menos de 8 caracteres, sin mayúscula, sin minúscula, sin número, sin símbolo y confirmación diferente.
3. Enviar dos registros equivalentes de forma concurrente.

**Resultado esperado**: no aparece una segunda cuenta; la interfaz ofrece corrección segura; la base mantiene sus índices únicos y no hay alta parcial.

### C. Inicio y cierre de sesión

1. Iniciar sesión con la cuenta creada y comprobar redirección a `/Dashboard/Index`.
2. Cerrar sesión.
3. Intentar volver al dashboard mediante URL directa o botón Atrás/recarga.

**Resultado esperado**: el dashboard solo es visible con sesión válida; después del cierre no se muestra contenido protegido.

### D. Credenciales y rutas protegidas

1. Intentar iniciar sesión con correo inexistente, contraseña incorrecta y cuenta inactiva.
2. Comparar los mensajes recibidos.
3. Como visitante, abrir una ruta personal directamente.
4. Enviar 5 credenciales inválidas dentro de 15 minutos e intentar una sexta.

**Resultado esperado**: todos los intentos inválidos reciben el mismo mensaje genérico; después del quinto intento el sexto se bloquea durante 15 minutos, y el visitante es dirigido al login sin datos protegidos.

### E. Contexto de identidad y acceso protegido

1. Crear dos estudiantes de prueba e iniciar sesión con el primero.
2. Manipular URL, formulario o identificador para intentar sustituir el `EstudianteID` de la sesión.
3. Como visitante, abrir `/Dashboard/Index` directamente.

**Resultado esperado**: el valor enviado por el cliente no sustituye la identidad de la sesión y ningún visitante recibe contenido del dashboard. Los recursos de negocio se validarán en sus propios SPs.

## Automatización requerida antes de entrega

- Ejecutar pruebas unitarias, de integración y web descritas en `plan.md`.
- Aplicar migración a una copia controlada de `MecaPlanDB` con cada caso heredado: nulos de estado, hash faltante y duplicados. Los casos inseguros deben bloquearse con informe; no deben alterarse silenciosamente.
- Revisar que respuestas, logs de prueba y archivos versionados no contienen contraseñas, hashes, cookies, cadenas de conexión ni secretos.
- Registrar la evidencia de resultados contra FR-001 a FR-014 y SC-001 a SC-006 antes de considerar SP1 terminado.
