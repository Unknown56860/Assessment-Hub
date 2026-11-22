package org.assessment_hub.spring_backend.assessment.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record JoinRequestDto(
        @NotBlank @Pattern(regexp = "[a-zA-Z]{6}") String code,
        @NotBlank @Size(max = 64) @Pattern(regexp = "[A-Za-z0-9._\\-]+") String roll,
        @NotBlank @Size(max = 100) String name
) {}
