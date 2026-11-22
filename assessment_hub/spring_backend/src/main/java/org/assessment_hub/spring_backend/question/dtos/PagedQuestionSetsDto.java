package org.assessment_hub.spring_backend.question.dtos;

import java.util.List;

public record PagedQuestionSetsDto(long totalElements, List<QuestionSetDto> content) {}
