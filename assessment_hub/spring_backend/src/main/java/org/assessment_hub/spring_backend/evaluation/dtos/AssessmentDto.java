package org.assessment_hub.spring_backend.evaluation.dtos;

import java.time.LocalDateTime;

import org.assessment_hub.spring_backend.evaluation.AssessmentEntity;
import org.assessment_hub.spring_backend.evaluation.AssessmentStatus;

public record AssessmentDto(
        Long assessmentId,
        String assessmentTitle,
        String assessmentDescription,
        AssessmentStatus status,
        Long questionSetId,
        LocalDateTime conductedAt,
        LocalDateTime evaluatedAt) {

    public static AssessmentDto from(AssessmentEntity e) {
        return new AssessmentDto(
                e.getAssessmentId(),
                e.getAssessmentTitle(),
                e.getAssessmentDescription(),
                e.getStatus(),
                e.getQuestionSet().getQuestionSetId(),
                e.getConductedAt(),
                e.getEvaluatedAt());
    }
}

