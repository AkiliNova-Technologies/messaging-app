package com.securelan.messenger.admin.dto;
import jakarta.validation.constraints.*;
public record ResetPasswordRequest(@NotBlank @Size(min=12,max=200) String temporaryPassword) {}
