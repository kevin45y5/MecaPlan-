# Prompt de diseño de MecaPlan

Rediseña las vistas de una aplicación web académica llamada **MecaPlan** con una identidad visual editorial, sobria y moderna. El resultado debe sentirse como una herramienta de organización personal para estudiantes: serena, confiable, clara y motivadora; evita el aspecto de plantilla Bootstrap.

Usa una paleta principal de verde bosque `#12372A`, verde secundario `#1D5942`, fondo marfil muy claro `#F7F8F4`, menta suave `#DFF3E7`, texto casi negro verdoso `#15231E`, texto secundario `#64736B`, bordes `#DBE3DC` y acento dorado `#F1B74B`. Emplea tipografía sans-serif del sistema para interfaz (Inter si está disponible) y Georgia para titulares grandes. No dependas de recursos externos ni imágenes remotas.

Construye una barra superior sticky y translúcida: logotipo compacto con una marca cuadrada verde y la letra “M”, enlaces Inicio / Iniciar sesión / Crear cuenta, y menú móvil colapsable. Cuando la sesión esté activa, sustituye las acciones de acceso por “Mi espacio” y “Cerrar sesión”. Añade un pie de página discreto.

La página de inicio debe tener un hero amplio con fondo en degradado verde muy sutil, un gran titular serif: “Tu tiempo merece un buen plan.”, CTA verde y CTA secundaria delineada. A la derecha coloca una tarjeta de vista previa con progreso 72%, barra dorada y lista de tareas completadas. Debajo, tres tarjetas de beneficios limpias, con iconos numéricos y suficiente espacio en blanco.

Para login y registro, usa un fondo marfil con halo verde difuso y una única tarjeta blanca centrada, radio de 18px, borde fino y sombra suave. Inputs de al menos 47px de alto, etiquetas visibles, placeholders, focus verde con halo, errores rojos accesibles y botón primario de ancho completo. En registro, organiza Nombre/Apellido y Contraseña/Confirmar en dos columnas en escritorio y una columna en móvil. Conserva exactamente la semántica y bindings existentes del formulario (`asp-for`, validación, token antiforgery, retorno de URL y acciones MVC); no cambies nombres de campos ni rutas.

El dashboard debe saludar al usuario por su nombre, incluir tres tarjetas de estado y un panel verde profundo de punto de partida. Privacidad y error deben usar tarjetas de contenido amplias y coherentes. Todo debe ser responsive: en menos de 768px, menú, grillas y formularios pasan a una columna; no debe haber desbordamiento horizontal ni campos deformados. Mantén contraste AA, estados hover/focus claros y HTML semántico.
