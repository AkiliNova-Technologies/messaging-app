package com.securelan.messenger.auth;

import com.securelan.messenger.auth.dto.*;
import com.securelan.messenger.common.ApiException;
import com.securelan.messenger.user.*;
import com.securelan.messenger.user.dto.UserResponse;
import java.time.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users; private final SessionRepository sessions; private final PasswordEncoder passwords; private final TokenService tokens;
    private final Duration lifetime;
    public AuthService(UserRepository users, SessionRepository sessions, PasswordEncoder passwords, TokenService tokens,
                       @Value("${securelan.auth.session-lifetime:7d}") Duration lifetime) {
        this.users=users; this.sessions=sessions; this.passwords=passwords; this.tokens=tokens; this.lifetime=lifetime;
    }
    @Transactional public LoginResponse login(LoginRequest request) {
        var user = users.findByUsername(UserAccount.normalize(request.username())).orElse(null);
        if (user == null || !passwords.matches(request.password(), user.getPasswordHash())) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_CREDENTIALS","Invalid username or password");
        if (user.getStatus() != UserStatus.ACTIVE) throw new ApiException(HttpStatus.FORBIDDEN,"ACCOUNT_DISABLED","This account is disabled");
        var raw = tokens.generate(); var session = sessions.save(new UserSession(user, tokens.hash(raw), Instant.now().plus(lifetime)));
        user.markLogin(); return new LoginResponse(UserResponse.from(user), new LoginResponse.SessionInfo(session.getExpiresAt()), raw);
    }
    @Transactional public void logout(AuthPrincipal principal) { sessions.findById(principal.sessionId()).ifPresent(UserSession::revoke); }
    @Transactional public void logoutAll(AuthPrincipal principal) { sessions.revokeAll(principal.userId(), Instant.now()); }
    @Transactional public void changePassword(AuthPrincipal principal, ChangePasswordRequest request) {
        var user = users.findById(principal.userId()).orElseThrow();
        if (!passwords.matches(request.currentPassword(), user.getPasswordHash())) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_CURRENT_PASSWORD","Current password is incorrect");
        if (passwords.matches(request.newPassword(), user.getPasswordHash())) throw new ApiException(HttpStatus.BAD_REQUEST,"PASSWORD_REUSED","New password must be different");
        user.markPasswordChanged(passwords.encode(request.newPassword()));
        sessions.revokeOthers(user.getId(), principal.sessionId(), Instant.now());
    }
}
