package com.securelan.messenger.admin.dto;
import jakarta.validation.constraints.*;
public record CreateUserRequest(@NotBlank @Pattern(regexp="[A-Za-z0-9._-]+") @Size(min=3,max=100) String username,
 @NotBlank @Size(max=150) String displayName, @NotBlank @Size(min=12,max=200) String temporaryPassword) {}
