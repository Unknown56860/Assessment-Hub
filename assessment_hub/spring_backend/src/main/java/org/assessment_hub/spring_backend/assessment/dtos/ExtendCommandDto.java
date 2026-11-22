package org.assessment_hub.spring_backend.assessment.dtos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ExtendCommandDto(@NotNull @Min(1) @Max(180) Integer minutes) {}
