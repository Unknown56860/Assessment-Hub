package org.assessment_hub.spring_backend.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeleteAccountDto(
        @NotBlank String password,
        @NotBlank @Size(max = 10) String confirmation   // must be exactly "Delete"
) {}
