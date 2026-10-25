package com.securelan.messenger.auth;

import tools.jackson.databind.ObjectMapper;
import com.securelan.messenger.common.ApiError;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class BearerTokenFilter extends OncePerRequestFilter {
    private final SessionAuthenticationService authenticationService;
    private final ObjectMapper mapper;

    public BearerTokenFilter(SessionAuthenticationService authenticationService, ObjectMapper mapper) {
        this.authenticationService = authenticationService;
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }
        var raw = header.substring(7);
        if (raw.length() < 40 || raw.length() > 200) {
            reject(request, response, "UNAUTHORIZED", "Invalid session token");
            return;
        }
        var validation = authenticationService.validate(raw);
        var now = Instant.now();
        if (validation.principal().isEmpty()) {
            reject(request, response, validation.errorCode(), validation.errorMessage());
            return;
        }
        var principal = validation.principal().orElseThrow();
        var authentication = new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name())));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        var path = request.getRequestURI();
        if (validation.mustChangePassword()
                && !(path.equals("/api/v1/auth/change-password") || path.equals("/api/v1/auth/logout")
                        || path.equals("/api/v1/auth/me"))) {
            response.setStatus(403);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            mapper.writeValue(response.getOutputStream(),
                    new ApiError(now, 403, "PASSWORD_CHANGE_REQUIRED", "Change the temporary password before continuing", path));
            return;
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, String code, String message)
            throws IOException {
        response.setStatus(401);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(),
                new ApiError(Instant.now(), 401, code, message, request.getRequestURI()));
    }
}
