namespace MecaPlan.Services
{
    public class AiOptions
    {
        public const string SectionName = "Ai";

        public string ApiKey { get; set; } = string.Empty;
        public string Endpoint { get; set; } = "https://api.anthropic.com/v1/messages";
        public string Model { get; set; } = "claude-sonnet-4-5";
        public string Provider { get; set; } = "Anthropic";
        public int TimeoutSeconds { get; set; } = 180;
    }
}
