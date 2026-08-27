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
    private static readonly TimeSpan AttemptWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan BlockDuration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan Retention = AttemptWindow + BlockDuration;

    private sealed record Attempts(DateTime[] Failures, DateTime? BlockedUntil, DateTime LastSeen);

    private readonly ConcurrentDictionary<string, Attempts> _attempts = new(StringComparer.Ordinal);
    private int _recordedFailures;

    public bool IsBlocked(string key, DateTime utcNow)
    {
        while (_attempts.TryGetValue(key, out var value))
        {
            if (value.BlockedUntil > utcNow)
                return true;

            if (value.BlockedUntil is null)
                return false;

            if (TryRemove(key, value))
                return false;
        }

        return false;
    }

    public void RecordFailure(string key, DateTime utcNow)
    {
        _attempts.AddOrUpdate(
            key,
            _ => new Attempts([utcNow], null, utcNow),
            (_, current) => AddFailure(current, utcNow));

        if ((Interlocked.Increment(ref _recordedFailures) & 63) == 0)
            RemoveExpiredEntries(utcNow);
    }

    public void RecordSuccess(string key) => _attempts.TryRemove(key, out _);

    private static Attempts AddFailure(Attempts current, DateTime utcNow)
    {
        if (current.BlockedUntil > utcNow)
            return current with { LastSeen = utcNow };

        var failures = current.BlockedUntil is not null
            ? [utcNow]
            : current.Failures.Where(time => time > utcNow - AttemptWindow).Append(utcNow).ToArray();

        return failures.Length >= 5
            ? new Attempts([], utcNow + BlockDuration, utcNow)
            : new Attempts(failures, null, utcNow);
    }

    private void RemoveExpiredEntries(DateTime utcNow)
    {
        foreach (var entry in _attempts)
        {
            if (entry.Value.LastSeen <= utcNow - Retention)
                TryRemove(entry.Key, entry.Value);
        }
    }

    private bool TryRemove(string key, Attempts value) =>
        ((ICollection<KeyValuePair<string, Attempts>>)_attempts).Remove(new(key, value));
}
