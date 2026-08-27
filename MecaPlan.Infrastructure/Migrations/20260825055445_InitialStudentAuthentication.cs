using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MecaPlan.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialStudentAuthentication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF SCHEMA_ID(N'Seguridad') IS NULL EXEC(N'CREATE SCHEMA Seguridad');

                IF OBJECT_ID(N'Seguridad.Estudiantes', N'U') IS NULL
                BEGIN
                    CREATE TABLE Seguridad.Estudiantes (
                        EstudianteID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Estudiantes PRIMARY KEY,
                        Nombre NVARCHAR(100) NOT NULL, Apellido NVARCHAR(100) NOT NULL,
                        Carnet NVARCHAR(50) NOT NULL, Email NVARCHAR(256) NOT NULL,
                        EmailNormalizado NVARCHAR(256) NOT NULL, PasswordHash NVARCHAR(512) NOT NULL,
                        FechaRegistro DATETIME2 NOT NULL CONSTRAINT DF_Estudiantes_FechaRegistro DEFAULT SYSUTCDATETIME(),
                        EstadoBit BIT NOT NULL CONSTRAINT DF_Estudiantes_EstadoBit DEFAULT 1);
                END
                ELSE
                BEGIN
                    IF COL_LENGTH(N'Seguridad.Estudiantes', N'PasswordHash') IS NULL
                        THROW 51000, 'Preflight SP1 bloqueado: falta PasswordHash.', 1;
                    IF COL_LENGTH(N'Seguridad.Estudiantes', N'EmailNormalizado') IS NULL
                        ALTER TABLE Seguridad.Estudiantes ADD EmailNormalizado NVARCHAR(256) NULL;
                    EXEC(N'UPDATE Seguridad.Estudiantes
                          SET EmailNormalizado = UPPER(LTRIM(RTRIM(Email)))
                          WHERE EmailNormalizado IS NULL;');
                    IF COL_LENGTH(N'Seguridad.Estudiantes', N'EstadoBit') IS NULL
                        THROW 51000, 'Preflight SP1 bloqueado: falta EstadoBit.', 1;
                    IF EXISTS (SELECT 1 FROM Seguridad.Estudiantes WHERE PasswordHash IS NULL OR LTRIM(RTRIM(PasswordHash)) = '')
                        THROW 51000, 'Preflight SP1 bloqueado: existen PasswordHash vacíos o nulos.', 1;
                    IF EXISTS (SELECT 1 FROM Seguridad.Estudiantes WHERE EstadoBit IS NULL)
                        THROW 51000, 'Preflight SP1 bloqueado: existen EstadoBit nulos.', 1;
                    IF EXISTS (SELECT 1 FROM Seguridad.Estudiantes GROUP BY Carnet HAVING COUNT(*) > 1)
                        THROW 51000, 'Preflight SP1 bloqueado: existen carnets duplicados.', 1;
                    IF EXISTS (SELECT 1 FROM Seguridad.Estudiantes GROUP BY EmailNormalizado HAVING COUNT(*) > 1)
                        THROW 51000, 'Preflight SP1 bloqueado: existen correos duplicados.', 1;
                    ALTER TABLE Seguridad.Estudiantes ALTER COLUMN EmailNormalizado NVARCHAR(256) NOT NULL;
                    ALTER TABLE Seguridad.Estudiantes ALTER COLUMN EstadoBit BIT NOT NULL;
                END

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Estudiantes_Carnet' AND object_id = OBJECT_ID(N'Seguridad.Estudiantes'))
                    CREATE UNIQUE INDEX UX_Estudiantes_Carnet ON Seguridad.Estudiantes(Carnet);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Estudiantes_EmailNormalizado' AND object_id = OBJECT_ID(N'Seguridad.Estudiantes'))
                    CREATE UNIQUE INDEX UX_Estudiantes_EmailNormalizado ON Seguridad.Estudiantes(EmailNormalizado);

                IF OBJECT_ID(N'Seguridad.EventosAutenticacion', N'U') IS NULL
                BEGIN
                    CREATE TABLE Seguridad.EventosAutenticacion (
                        IdEventoAutenticacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventosAutenticacion PRIMARY KEY,
                        EstudianteID INT NULL, TipoEvento NVARCHAR(50) NOT NULL, Resultado NVARCHAR(20) NOT NULL,
                        FechaUtc DATETIME2 NOT NULL CONSTRAINT DF_EventosAutenticacion_FechaUtc DEFAULT SYSUTCDATETIME(),
                        CorrelationId NVARCHAR(100) NOT NULL, OrigenMinimizado NVARCHAR(100) NULL,
                        CONSTRAINT FK_EventosAutenticacion_Estudiantes FOREIGN KEY (EstudianteID)
                            REFERENCES Seguridad.Estudiantes(EstudianteID));
                    CREATE INDEX IX_EventosAutenticacion_Estudiante_FechaUtc
                        ON Seguridad.EventosAutenticacion(EstudianteID, FechaUtc);
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("THROW 51000, 'La reversión de SP1 requiere el procedimiento documentado y un respaldo aprobado.', 1;");
        }
    }
}
