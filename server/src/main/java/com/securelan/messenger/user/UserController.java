package com.securelan.messenger.user;
import com.securelan.messenger.auth.AuthPrincipal;
import com.securelan.messenger.user.dto.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/users/me")
public class UserController {
    private final UserRepository users;
    public UserController(UserRepository users) { this.users=users; }
    @GetMapping public UserResponse get(@AuthenticationPrincipal AuthPrincipal principal) { return UserResponse.from(users.findById(principal.userId()).orElseThrow()); }
    @PatchMapping public UserResponse update(@AuthenticationPrincipal AuthPrincipal principal,@Valid @RequestBody UpdateProfileRequest request) {
        var user=users.findById(principal.userId()).orElseThrow(); user.setDisplayName(request.displayName()); return UserResponse.from(users.save(user));
    }
}
