using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MecaPlan.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Sp2ProjectIdeaBom : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF SCHEMA_ID(N'Inventario') IS NULL EXEC(N'CREATE SCHEMA Inventario');
                IF SCHEMA_ID(N'Proyectos') IS NULL EXEC(N'CREATE SCHEMA Proyectos');
                IF OBJECT_ID(N'Inventario.Componentes', N'U') IS NULL
                    CREATE TABLE Inventario.Componentes (ComponenteID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Componentes PRIMARY KEY, Nombre NVARCHAR(150) NOT NULL, Tipo NVARCHAR(100) NOT NULL);
                IF OBJECT_ID(N'Proyectos.Proyectos', N'U') IS NULL
                    CREATE TABLE Proyectos.Proyectos (ProyectoID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Proyectos PRIMARY KEY, EstudianteID INT NOT NULL, NombreProyecto NVARCHAR(150) NOT NULL, DescripcionIdea NVARCHAR(4000) NOT NULL, FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Proyectos_FechaCreacion DEFAULT SYSUTCDATETIME(), CONSTRAINT FK_Proyectos_Estudiantes FOREIGN KEY (EstudianteID) REFERENCES Seguridad.Estudiantes(EstudianteID));
                IF OBJECT_ID(N'Proyectos.BOMProyectos', N'U') IS NULL
                    CREATE TABLE Proyectos.BOMProyectos (BOMID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BOMProyectos PRIMARY KEY, ProyectoID INT NOT NULL, ComponenteID INT NOT NULL, CantidadRequerida INT NOT NULL, CONSTRAINT FK_BOMProyectos_Proyectos FOREIGN KEY (ProyectoID) REFERENCES Proyectos.Proyectos(ProyectoID), CONSTRAINT FK_BOMProyectos_Componentes FOREIGN KEY (ComponenteID) REFERENCES Inventario.Componentes(ComponenteID), CONSTRAINT CK_BOMProyectos_Cantidad CHECK (CantidadRequerida > 0));
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Componentes_Nombre' AND object_id = OBJECT_ID(N'Inventario.Componentes')) CREATE UNIQUE INDEX IX_Componentes_Nombre ON Inventario.Componentes(Nombre);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Proyectos_EstudianteID' AND object_id = OBJECT_ID(N'Proyectos.Proyectos')) CREATE INDEX IX_Proyectos_EstudianteID ON Proyectos.Proyectos(EstudianteID);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BOMProyectos_ProyectoID_ComponenteID' AND object_id = OBJECT_ID(N'Proyectos.BOMProyectos')) CREATE UNIQUE INDEX IX_BOMProyectos_ProyectoID_ComponenteID ON Proyectos.BOMProyectos(ProyectoID, ComponenteID);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("THROW 51000, 'La reversión de SP2 requiere un respaldo aprobado; no elimina proyectos académicos automáticamente.', 1;");
        }
    }
}
