package org.assessment_hub.spring_backend.assessment.dtos;

import jakarta.validation.constraints.NotNull;

public record SaveCommandDto(@NotNull Long questionId, Object answer) {}
