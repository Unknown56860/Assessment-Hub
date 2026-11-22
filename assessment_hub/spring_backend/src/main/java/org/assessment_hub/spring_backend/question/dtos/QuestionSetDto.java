package org.assessment_hub.spring_backend.question.dtos;

import java.time.LocalDateTime;

import org.assessment_hub.spring_backend.question.QuestionSetEntity;

public record QuestionSetDto(
        Long questionSetId, String title, String description,
        Integer totalConducted, LocalDateTime lastConducted,
        LocalDateTime createdAt, LocalDateTime updatedAt) {

    public static QuestionSetDto from(QuestionSetEntity e) {
        return new QuestionSetDto(e.getQuestionSetId(), e.getTitle(), e.getDescription(),
                e.getTotalConducted(), e.getLastConducted(),
                e.getCreatedAt(), e.getUpdatedAt());
    }
}
