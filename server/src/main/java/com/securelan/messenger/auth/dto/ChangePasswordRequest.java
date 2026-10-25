package com.securelan.messenger.auth.dto;
import jakarta.validation.constraints.*;
public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min=12,max=200) String newPassword) {}
