package com.securelan.messenger.auth.dto;
import com.securelan.messenger.user.dto.UserResponse;
import java.time.Instant;
public record LoginResponse(UserResponse user, SessionInfo session, String accessToken) { public record SessionInfo(Instant expiresAt) {} }
