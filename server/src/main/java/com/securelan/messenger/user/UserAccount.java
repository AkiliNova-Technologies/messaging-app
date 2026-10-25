package com.securelan.messenger.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id private UUID id;
    @Column(nullable = false, unique = true, length = 100) private String username;
    @Column(name = "display_name", nullable = false, length = 150) private String displayName;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private UserRole role;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private UserStatus status;
    @Column(name = "must_change_password", nullable = false) private boolean mustChangePassword;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "last_login_at") private Instant lastLoginAt;

    protected UserAccount() {}
    public UserAccount(String username, String displayName, String passwordHash, UserRole role, boolean mustChangePassword) {
        var now = Instant.now(); this.id = UUID.randomUUID(); this.username = normalize(username);
        this.displayName = displayName.trim(); this.passwordHash = passwordHash; this.role = role;
        this.status = UserStatus.ACTIVE; this.mustChangePassword = mustChangePassword;
        this.createdAt = now; this.updatedAt = now;
    }
    public static String normalize(String username) { return username.trim().toLowerCase(java.util.Locale.ROOT); }
    public UUID getId() { return id; }
    public String getUsername() { return username; }
    public String getDisplayName() { return displayName; }
    public String getPasswordHash() { return passwordHash; }
    public UserRole getRole() { return role; }
    public UserStatus getStatus() { return status; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setDisplayName(String value) { displayName = value.trim(); touch(); }
    public void setStatus(UserStatus value) { status = value; touch(); }
    public void setPasswordHash(String value, boolean mustChange) { passwordHash = value; mustChangePassword = mustChange; touch(); }
    public void markPasswordChanged(String value) { setPasswordHash(value, false); }
    public void markLogin() { lastLoginAt = Instant.now(); touch(); }
    private void touch() { updatedAt = Instant.now(); }
}
