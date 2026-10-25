package com.securelan.messenger.admin.dto;
import com.securelan.messenger.user.UserStatus;
import jakarta.validation.constraints.NotNull;
public record UpdateStatusRequest(@NotNull UserStatus status) {}
