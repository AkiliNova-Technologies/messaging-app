package com.securelan.messenger.auth;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Base64;
import org.springframework.stereotype.Component;

@Component
public class TokenService {
    private final SecureRandom random = new SecureRandom();
    public String generate() { var bytes = new byte[32]; random.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    public String hash(String raw) {
        try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
