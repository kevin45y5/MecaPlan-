using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MecaPlan.Services
{
    public class AnthropicChatClient : IAiChatClient
    {
        private readonly HttpClient _http;
        private readonly AiOptions _options;

        public AnthropicChatClient(HttpClient http, IOptions<AiOptions> options)
        {
            _http = http;
            _options = options.Value;
        }

        public Task<string> CompleteJsonAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            return LlamarClaudeAsync(systemPrompt, userPrompt, json: true, cancellationToken);
        }

        public Task<string> CompleteTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            return LlamarClaudeAsync(systemPrompt, userPrompt, json: false, cancellationToken);
        }

        private async Task<string> LlamarClaudeAsync(string systemPrompt, string userPrompt, bool json, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_options.ApiKey))
            {
                throw new InvalidOperationException(
                    "Falta la clave de Claude. Configura Ai:ApiKey en appsettings o user-secrets.");
            }

            var endpoint = string.IsNullOrWhiteSpace(_options.Endpoint)
                ? "https://api.anthropic.com/v1/messages"
                : _options.Endpoint;

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.TryAddWithoutValidation("x-api-key", _options.ApiKey.Trim());
            request.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");

            var payload = new
            {
                model = string.IsNullOrWhiteSpace(_options.Model) ? "claude-sonnet-4-5" : _options.Model,
                max_tokens = 8192,
                temperature = 0.3,
                system = json ? systemPrompt + "\nResponde solo con JSON válido, sin markdown." : systemPrompt,
                messages = new object[]
                {
                    new { role = "user", content = userPrompt }
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            using var response = await _http.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(MensajeError(response.StatusCode, body));
            }

            using var doc = JsonDocument.Parse(body);
            var text = ExtraerTexto(doc.RootElement);
            if (string.IsNullOrWhiteSpace(text))
            {
                throw new InvalidOperationException("Claude devolvió una respuesta vacía.");
            }

            return json ? OpenAiChatClient.ExtractJson(text) : text;
        }

        private static string ExtraerTexto(JsonElement root)
        {
            if (!root.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            {
                return string.Empty;
            }

            var builder = new StringBuilder();
            foreach (var part in content.EnumerateArray())
            {
                if (part.TryGetProperty("type", out var type)
                    && type.GetString() == "text"
                    && part.TryGetProperty("text", out var text))
                {
                    builder.Append(text.GetString());
                }
            }

            return builder.ToString();
        }

        private static string MensajeError(System.Net.HttpStatusCode status, string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("error", out var error)
                    && error.TryGetProperty("message", out var message))
                {
                    return $"Claude no respondió ({(int)status}): {message.GetString()}";
                }
            }
            catch (JsonException)
            {
            }

            return $"Claude no respondió ({(int)status}).";
        }
    }
}
