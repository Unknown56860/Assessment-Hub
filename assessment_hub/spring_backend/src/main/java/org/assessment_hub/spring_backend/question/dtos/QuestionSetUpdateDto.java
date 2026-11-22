package org.assessment_hub.spring_backend.question.dtos;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record QuestionSetUpdateDto(
    @NotNull(message = "Question set id is required.")
    Long questionSetId,
    @Size(max = 250, message = "Title must be 250 characters or fewer.")
    String title,           // null = leave unchanged
    @Size(max = 2500, message = "Description must be 2500 characters or fewer.")
    String description,
    String questionsJson,
    String answersJson
) {}
