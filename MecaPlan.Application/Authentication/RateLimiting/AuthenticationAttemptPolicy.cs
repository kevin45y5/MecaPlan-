using System.Collections.Concurrent;

namespace MecaPlan.Application.Authentication.RateLimiting;

public interface IAuthenticationAttemptPolicy
{
    bool IsBlocked(string key, DateTime utcNow);
    void RecordFailure(string key, DateTime utcNow);
    void RecordSuccess(string key);
}

/// <summary>In-process guard: five failed attempts in fifteen minutes block for fifteen minutes.</summary>
public sealed class AuthenticationAttemptPolicy : IAuthenticationAttemptPolicy
{
    private sealed class Attempts { public List<DateTime> Failures { get; } = []; public DateTime? BlockedUntil { get; set; } }
    private readonly ConcurrentDictionary<string, Attempts> _attempts = new(StringComparer.Ordinal);
    public bool IsBlocked(string key, DateTime utcNow) => _attempts.TryGetValue(key, out var value) && value.BlockedUntil > utcNow;
    public void RecordFailure(string key, DateTime utcNow)
    {
        var value = _attempts.GetOrAdd(key, _ => new Attempts());
        lock (value)
        {
            value.Failures.RemoveAll(time => time <= utcNow.AddMinutes(-15));
            value.Failures.Add(utcNow);
            if (value.Failures.Count >= 5) { value.BlockedUntil = utcNow.AddMinutes(15); value.Failures.Clear(); }
        }
    }
    public void RecordSuccess(string key) => _attempts.TryRemove(key, out _);
}
