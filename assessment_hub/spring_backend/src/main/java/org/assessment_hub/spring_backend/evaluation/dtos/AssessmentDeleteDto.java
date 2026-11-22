package org.assessment_hub.spring_backend.evaluation.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AssessmentDeleteDto(
    @NotNull (message = "Submission id is required.")
    Long assessmentId,
    @NotBlank (message = "Confirmation is required.")
    String confirm
) {}
