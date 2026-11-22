package org.assessment_hub.spring_backend.question.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record QuestionSetDeleteDto(
        @NotNull(message = "Question set id is required.")
        Long questionSetId,
        @NotBlank(message = "Type \"Delete\" to confirm.")
        String confirm
    ) {}
