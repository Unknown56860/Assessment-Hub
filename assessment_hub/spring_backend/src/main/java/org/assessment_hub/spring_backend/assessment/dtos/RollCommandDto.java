package org.assessment_hub.spring_backend.assessment.dtos;

import jakarta.validation.constraints.NotBlank;

public record RollCommandDto(@NotBlank String roll) {}
