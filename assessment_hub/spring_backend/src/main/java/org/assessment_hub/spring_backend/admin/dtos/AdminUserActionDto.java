package org.assessment_hub.spring_backend.admin.dtos;

import org.assessment_hub.spring_backend.profile.ProfileStatus;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AdminUserActionDto(
        @NotBlank (message = "Email must be provided")
        @Email (message = "Invalid email format")
        String email,

        @NotNull (message = "Action must be provided")
        ProfileStatus status
) {}
