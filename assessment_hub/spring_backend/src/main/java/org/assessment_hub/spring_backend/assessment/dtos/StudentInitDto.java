package org.assessment_hub.spring_backend.assessment.dtos;

import java.util.Map;

public record StudentInitDto(
    String title, 
    long questionSetId, 
    String questions,
    Map<String, Object> savedAnswers, 
    long joinedAt, 
    long durationMin,
    long endTs, 
    long serverTs, 
    String hostUtc
) {}
