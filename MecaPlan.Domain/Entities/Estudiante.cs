namespace MecaPlan.Domain.Entities;

public sealed class Estudiante
{
    private Estudiante() { }
    public Estudiante(string nombre, string apellido, string carnet, string email, string emailNormalizado, string passwordHash)
    {
        Nombre = nombre; Apellido = apellido; Carnet = carnet; Email = email; EmailNormalizado = emailNormalizado;
        PasswordHash = passwordHash; FechaRegistro = DateTime.UtcNow; EstadoBit = true;
    }
    public int EstudianteID { get; private set; }
    public string Nombre { get; private set; } = null!;
    public string Apellido { get; private set; } = null!;
    public string Carnet { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public string EmailNormalizado { get; private set; } = null!;
    public string PasswordHash { get; private set; } = null!;
    public DateTime FechaRegistro { get; private set; }
    public bool EstadoBit { get; private set; }
}
