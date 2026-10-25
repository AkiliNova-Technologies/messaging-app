package com.securelan.messenger.auth;

import com.securelan.messenger.common.ApiException;
import java.time.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class LoginRateLimiter {
    private static final int LIMIT = 8;
    private static final Duration WINDOW = Duration.ofMinutes(5);
    private final ConcurrentHashMap<String, Attempt> attempts = new ConcurrentHashMap<>();
    public void check(String key) {
        var now = Instant.now(); var current = attempts.compute(key, (k, old) -> old == null || old.since.plus(WINDOW).isBefore(now) ? new Attempt(now, 0) : old);
        if (current.count >= LIMIT) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many login attempts. Try again later.");
    }
    public void failure(String key) { attempts.computeIfPresent(key, (k, value) -> new Attempt(value.since, value.count + 1)); }
    public void success(String key) { attempts.remove(key); }
    private record Attempt(Instant since, int count) {}
}
