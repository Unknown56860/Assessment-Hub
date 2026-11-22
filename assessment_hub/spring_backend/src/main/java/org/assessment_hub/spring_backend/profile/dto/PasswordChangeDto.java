package org.assessment_hub.spring_backend.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordChangeDto(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 4, max = 64) String newPassword
) {}

