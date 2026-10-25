package com.securelan.messenger.auth;

import com.securelan.messenger.user.UserStatus;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionAuthenticationService {
    private final SessionRepository sessions;
    private final TokenService tokens;

    public SessionAuthenticationService(SessionRepository sessions, TokenService tokens) {
        this.sessions = sessions;
        this.tokens = tokens;
    }

    @Transactional
    public ValidationResult validate(String rawToken) {
        var session = sessions.findByTokenHash(tokens.hash(rawToken)).orElse(null);
        var now = Instant.now();
        if (session == null || session.getRevokedAt() != null) {
            return ValidationResult.rejected("UNAUTHORIZED", "Invalid session token");
        }
        if (!session.getExpiresAt().isAfter(now)) {
            session.revoke();
            return ValidationResult.rejected("SESSION_EXPIRED", "Session has expired");
        }
        if (session.getUser().getStatus() != UserStatus.ACTIVE) {
            session.revoke();
            return ValidationResult.rejected("ACCOUNT_DISABLED", "This account is disabled");
        }
        session.touch();
        var user = session.getUser();
        return ValidationResult.accepted(
                new AuthPrincipal(user.getId(), session.getId(), user.getRole()), user.isMustChangePassword());
    }

    public record ValidationResult(Optional<AuthPrincipal> principal, boolean mustChangePassword, String errorCode,
            String errorMessage) {
        static ValidationResult accepted(AuthPrincipal principal, boolean mustChangePassword) {
            return new ValidationResult(Optional.of(principal), mustChangePassword, null, null);
        }

        static ValidationResult rejected(String code, String message) {
            return new ValidationResult(Optional.empty(), false, code, message);
        }
    }
}
