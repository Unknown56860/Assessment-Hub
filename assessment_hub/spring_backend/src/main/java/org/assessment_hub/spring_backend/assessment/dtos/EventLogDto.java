package org.assessment_hub.spring_backend.assessment.dtos;

public record EventLogDto(long ts, String type, String message, String roll) {}
