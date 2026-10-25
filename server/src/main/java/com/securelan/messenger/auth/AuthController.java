package com.securelan.messenger.auth;

import com.securelan.messenger.auth.dto.*;
import com.securelan.messenger.user.*;
import com.securelan.messenger.user.dto.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth; private final UserRepository users; private final LoginRateLimiter limiter;
    public AuthController(AuthService auth, UserRepository users, LoginRateLimiter limiter) { this.auth=auth; this.users=users; this.limiter=limiter; }
    @PostMapping("/login") public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        var key = UserAccount.normalize(request.username()) + "|" + http.getRemoteAddr(); limiter.check(key);
        try { var result=auth.login(request); limiter.success(key); return result; } catch (RuntimeException ex) { limiter.failure(key); throw ex; }
    }
    @GetMapping("/me") public UserResponse me(@AuthenticationPrincipal AuthPrincipal principal) { return UserResponse.from(users.findById(principal.userId()).orElseThrow()); }
    @PostMapping("/logout") public void logout(@AuthenticationPrincipal AuthPrincipal principal) { auth.logout(principal); }
    @PostMapping("/logout-all") public void logoutAll(@AuthenticationPrincipal AuthPrincipal principal) { auth.logoutAll(principal); }
    @PostMapping("/change-password") public void changePassword(@AuthenticationPrincipal AuthPrincipal principal,@Valid @RequestBody ChangePasswordRequest request) { auth.changePassword(principal,request); }
}
