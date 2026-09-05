using MecaPlan.Models;
using Microsoft.EntityFrameworkCore;

namespace MecaPlan.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Estudiante> Estudiantes => Set<Estudiante>();
        public DbSet<Proyecto> Proyectos => Set<Proyecto>();
        public DbSet<Componente> Componentes => Set<Componente>();
        public DbSet<ProyectoComponente> ProyectoComponentes => Set<ProyectoComponente>();
        public DbSet<PasoEnsamblaje> PasosEnsamblaje => Set<PasoEnsamblaje>();
        public DbSet<Diagnostico> Diagnosticos => Set<Diagnostico>();
        public DbSet<SimulacionDiseno> SimulacionDisenos => Set<SimulacionDiseno>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Estudiante>(entity =>
            {
                entity.ToTable("Estudiantes");
                entity.HasKey(e => e.EstudianteID);
                entity.Property(e => e.Nombre).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Apellido).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Email).HasMaxLength(150).IsRequired();
                entity.Property(e => e.PasswordHash).HasMaxLength(255).IsUnicode(false).IsRequired();
                entity.Property(e => e.PasswordSalt).HasMaxLength(255).IsUnicode(false);
                entity.HasIndex(e => e.Email).IsUnique();
            });

            modelBuilder.Entity<Proyecto>(entity =>
            {
                entity.ToTable("Proyectos");
                entity.HasKey(e => e.ProyectoID);
                entity.Property(e => e.NombreProyecto).HasMaxLength(150).IsRequired();
                entity.Property(e => e.NivelComplejidad).HasMaxLength(50);
                entity.Property(e => e.Microcontrolador).HasMaxLength(80);
                entity.HasOne(e => e.Estudiante).WithMany(e => e.Proyectos).HasForeignKey(e => e.EstudianteID);
            });

            modelBuilder.Entity<Componente>(entity =>
            {
                entity.ToTable("Componentes");
                entity.HasKey(e => e.ComponenteID);
                entity.Property(e => e.Nombre).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Categoria).HasMaxLength(50).IsRequired();
                entity.Property(e => e.PrecioEstimado).HasColumnType("decimal(10,2)");
                entity.Property(e => e.UrlImagen).HasMaxLength(255);
            });

            modelBuilder.Entity<ProyectoComponente>(entity =>
            {
                entity.ToTable("ProyectoComponentes");
                entity.HasKey(e => e.ProyectoComponenteID);
                entity.Property(e => e.Motivo).HasMaxLength(300);
                entity.HasOne(e => e.Proyecto).WithMany(e => e.ProyectoComponentes).HasForeignKey(e => e.ProyectoID);
                entity.HasOne(e => e.Componente).WithMany(e => e.ProyectoComponentes).HasForeignKey(e => e.ComponenteID);
            });

            modelBuilder.Entity<PasoEnsamblaje>(entity =>
            {
                entity.ToTable("PasosEnsamblaje");
                entity.HasKey(e => e.PasoID);
                entity.Property(e => e.Titulo).HasMaxLength(150).IsRequired();
                entity.Property(e => e.UrlEsquema).HasMaxLength(255);
                entity.HasOne(e => e.Proyecto).WithMany(e => e.PasosEnsamblaje).HasForeignKey(e => e.ProyectoID);
            });

            modelBuilder.Entity<Diagnostico>(entity =>
            {
                entity.ToTable("Diagnosticos");
                entity.HasKey(e => e.DiagnosticoID);
                entity.HasOne(e => e.Proyecto).WithMany(e => e.Diagnosticos).HasForeignKey(e => e.ProyectoID);
            });

            modelBuilder.Entity<SimulacionDiseno>(entity =>
            {
                entity.ToTable("SimulacionDisenos");
                entity.HasKey(e => e.SimulacionDisenoID);
                entity.Property(e => e.Nombre).HasMaxLength(150).IsRequired();
                entity.Property(e => e.Autor).HasMaxLength(100);
                entity.Property(e => e.ThumbnailBase64);
                entity.HasOne(e => e.Proyecto).WithMany().HasForeignKey(e => e.ProyectoID);
                entity.HasIndex(e => e.ProyectoID);
            });
        }
    }
}
