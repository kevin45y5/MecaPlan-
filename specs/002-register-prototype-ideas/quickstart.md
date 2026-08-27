# Guía de validación: Registro de ideas de prototipos

## Prerrequisitos

1. Configurar `ConnectionStrings:MecaPlan` mediante User Secrets.
2. Restaurar herramientas y aplicar migraciones a una base local aislada.
3. Compilar y ejecutar las pruebas.

```powershell
dotnet tool restore
dotnet ef database update --project MecaPlan.Infrastructure --startup-project MecaPlan
dotnet build MecaPlan.slnx --no-restore
dotnet test MecaPlan.slnx --no-build
```

## Escenario válido

1. Iniciar la aplicación con el perfil `http` e iniciar sesión como estudiante.
2. Enviar `POST /api/proyectos` con el JSON de [proyectos-api.md](./contracts/proyectos-api.md), usando el `EstudianteID` de la sesión.
3. Confirmar estado `201`, cabecera `Location`, fecha UTC e identificador generado.
4. Verificar en la base local que el proyecto pertenece al estudiante autenticado.

## Validación y propiedad

1. Repetir sin nombre, sin descripción y con textos fuera de límites; esperar `400` y ninguna fila.
2. Repetir con otro `EstudianteID`; esperar `403` y ninguna fila.
3. Repetir sin sesión; esperar `401` y ninguna fila.

## Integración BOM

Las pruebas automatizadas sustituyen el generador base por un doble registrador y comprueban que una creación válida lo invoca exactamente una vez con `ProyectoID` y descripción correctos. También simulan una excepción para comprobar la reversión de la operación.

La implementación base no inventa materiales. Poblar `BOM_Proyectos` con reglas reales requiere una historia posterior.
