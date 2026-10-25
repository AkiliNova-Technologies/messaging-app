package com.securelan.messenger.auth;

import com.securelan.messenger.user.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_sessions")
public class UserSession {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.EAGER, optional = false) @JoinColumn(name = "user_id") private UserAccount user;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "revoked_at") private Instant revokedAt;
    @Column(name = "last_used_at", nullable = false) private Instant lastUsedAt;
    protected UserSession() {}
    public UserSession(UserAccount user, String tokenHash, Instant expiresAt) {
        var now = Instant.now(); id = UUID.randomUUID(); this.user = user; this.tokenHash = tokenHash;
        createdAt = now; lastUsedAt = now; this.expiresAt = expiresAt;
    }
    public UUID getId() { return id; }
    public UserAccount getUser() { return user; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public boolean isUsable(Instant now) { return revokedAt == null && expiresAt.isAfter(now); }
    public void revoke() { if (revokedAt == null) revokedAt = Instant.now(); }
    public void touch() { lastUsedAt = Instant.now(); }
}
