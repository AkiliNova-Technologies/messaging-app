package com.securelan.messenger.auth.dto;
import jakarta.validation.constraints.*;
public record LoginRequest(@NotBlank @Size(max=100) String username, @NotBlank @Size(max=200) String password) {}
