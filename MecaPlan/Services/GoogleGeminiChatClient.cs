using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MecaPlan.Services
{
    public class GoogleGeminiChatClient : IAiChatClient
    {
        private readonly HttpClient _http;
        private readonly AiOptions _options;

        public GoogleGeminiChatClient(HttpClient http, IOptions<AiOptions> options)
        {
            _http = http;
            _options = options.Value;
        }

        public Task<string> CompleteJsonAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            return LlamarGeminiJsonAsync(systemPrompt, userPrompt, cancellationToken);
        }

        public Task<string> CompleteTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            return LlamarGeminiAsync(systemPrompt, userPrompt, cancellationToken);
        }

        private async Task<string> LlamarGeminiJsonAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken)
        {
            var text = await LlamarGeminiAsync(systemPrompt + "\nResponde solo con JSON válido, sin markdown.", userPrompt, cancellationToken);
            return OpenAiChatClient.ExtractJson(text);
        }

        private async Task<string> LlamarGeminiAsync(string systemInstruction, string userPrompt, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_options.ApiKey))
            {
                throw new InvalidOperationException(
                    "Falta la clave de Google Gemini. Configura Ai:ApiKey en appsettings o user-secrets.");
            }

            var model = string.IsNullOrWhiteSpace(_options.Model) ? "gemini-3.6-flash" : _options.Model;
            var endpoint = string.IsNullOrWhiteSpace(_options.Endpoint)
                ? $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                : _options.Endpoint;

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.TryAddWithoutValidation("x-goog-api-key", _options.ApiKey.Trim());

            var payload = new
            {
                system_instruction = new
                {
                    parts = new object[] { new { text = systemInstruction } }
                },
                contents = new object[]
                {
                    new
                    {
                        role = "user",
                        parts = new object[] { new { text = userPrompt } }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.3,
                    maxOutputTokens = 8192
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            using var response = await _http.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(MensajeError(response.StatusCode, body));
            }

            var text = ExtraerTexto(body);
            if (string.IsNullOrWhiteSpace(text))
            {
                throw new InvalidOperationException("Gemini devolvió una respuesta vacía.");
            }

            return text;
        }

        private static string ExtraerTexto(string body)
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("candidates", out var candidates)
                || candidates.ValueKind != JsonValueKind.Array
                || candidates.GetArrayLength() == 0)
            {
                return string.Empty;
            }

            var builder = new StringBuilder();
            var first = candidates[0];
            if (first.TryGetProperty("content", out var content)
                && content.TryGetProperty("parts", out var parts)
                && parts.ValueKind == JsonValueKind.Array)
            {
                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("text", out var text))
                    {
                        builder.Append(text.GetString());
                    }
                }
            }

            return builder.ToString();
        }

        private static string MensajeError(System.Net.HttpStatusCode status, string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("error", out var error))
                {
                    var message = error.TryGetProperty("message", out var m) ? m.GetString() : string.Empty;
                    return $"Gemini no respondió ({(int)status}): {message}";
                }
            }
            catch (JsonException)
            {
            }

            return $"Gemini no respondió ({(int)status}).";
        }
    }
}
