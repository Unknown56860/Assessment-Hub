package org.assessment_hub.spring_backend.assessment.dtos;

import jakarta.validation.constraints.NotBlank;

/** Client-side integrity-event report; kinds are whitelisted server-side. */
public record ViolationCommandDto(@NotBlank String kind) {}