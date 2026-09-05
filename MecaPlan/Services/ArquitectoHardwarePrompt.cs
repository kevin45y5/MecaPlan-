namespace MecaPlan.Services
{
    public static class ArquitectoHardwarePrompt
    {
        public static string Build(
            string nombreProyecto,
            string microcontrolador,
            string idea,
            string? materialesUsuario,
            string? materialesRequeridos)
        {
            var materiales = string.IsNullOrWhiteSpace(materialesUsuario)
                ? "ninguno"
                : materialesUsuario.Trim();
            var requisitos = string.IsNullOrWhiteSpace(materialesRequeridos)
                ? "ninguno"
                : materialesRequeridos.Trim();
            var placa = string.IsNullOrWhiteSpace(microcontrolador)
                ? "no indicada"
                : microcontrolador.Trim();

            return $$"""
                Analiza el proyecto "{{nombreProyecto.Trim()}}" (Placa: {{placa}}, Idea: "{{idea.Trim()}}").
                El usuario ya posee: [{{materiales}}].
                Debe usar aunque no los tenga (requisitos): [{{requisitos}}].
                Devuelve ÚNICAMENTE un JSON con los componentes adicionales estrictamente necesarios.
                No incluyas lo que ya tiene ni los requisitos (esos se agregan aparte).
                Formato: {"faltantes": [{"nombre": "Servo SG90", "cantidad": 2, "motivo": "Para las articulaciones"}]}
                """;
        }
    }
}
