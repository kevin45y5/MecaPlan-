namespace MecaPlan.Services
{
    public interface IAiChatClient
    {
        Task<string> CompleteJsonAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default);
        Task<string> CompleteTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default);
    }
}
