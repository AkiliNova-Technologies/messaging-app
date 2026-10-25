package com.securelan.messenger.auth;
import com.securelan.messenger.user.*;
import java.util.UUID;
public record AuthPrincipal(UUID userId, UUID sessionId, UserRole role) {}
