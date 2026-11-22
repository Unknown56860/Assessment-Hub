package org.assessment_hub.spring_backend.question.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record QuestionSetCreateDto(
        @NotBlank(message = "Title is required.") @Size(max = 250, message = "Title must be 250 characters or fewer.")
        String title,
        @Size(max = 2500, message = "Description must be 2500 characters or fewer.")
        String description,
        String questionsJson,   // optional on create; must be valid JSON when present
        String answersJson
    ) {}
