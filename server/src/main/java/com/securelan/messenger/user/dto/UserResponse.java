package com.securelan.messenger.user.dto;

import com.securelan.messenger.user.*;
import java.time.Instant;
import java.util.UUID;

public record UserResponse(UUID id, String username, String displayName, UserRole role, UserStatus status,
                           boolean mustChangePassword, Instant createdAt, Instant lastLoginAt) {
    public static UserResponse from(UserAccount user) { return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(), user.getStatus(), user.isMustChangePassword(), user.getCreatedAt(), user.getLastLoginAt()); }
}
