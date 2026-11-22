package org.assessment_hub.spring_backend.evaluation.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record EvaluationUpdateDto(
    @NotNull (message = "Submission id is required.")
    Long assessmentId,
    @NotBlank (message = "Evaluation JSON is required.")
    String evaluationJson
) {}
