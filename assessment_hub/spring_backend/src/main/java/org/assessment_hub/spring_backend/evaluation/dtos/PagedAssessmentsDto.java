package org.assessment_hub.spring_backend.evaluation.dtos;

import java.util.List;

public record PagedAssessmentsDto(long totalElements, List<AssessmentDto> content) {}
