package org.assessment_hub.spring_backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterDto(
        @NotBlank(message = "Name is required.") @Size(max = 100) String name,
        @NotBlank(message = "Email is required.") @Email @Size(max = 255) String email,
        @NotBlank(message = "Password is required.") @Size(min = 4, max = 64) String password,
        @Pattern (regexp = "^[0-9+\\-\\s]{7,15}$", message = "Enter a valid mobile number.") String mobileNo,
        @Size(max = 100) String designation) {
}
