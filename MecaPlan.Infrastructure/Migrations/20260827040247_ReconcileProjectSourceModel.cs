using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MecaPlan.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReconcileProjectSourceModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Actualiza el snapshot de EF Core. Las tablas se crearon mediante migraciones SQL idempotentes previas.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No se revierten estructuras existentes automáticamente.
        }
    }
}
