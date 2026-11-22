package org.assessment_hub.spring_backend.assessment.dtos;

/** One row of assessment:{code}:students (stored as JSON per roll). */

public record StudentDto(
        String name,
        long joinedAt,      // epoch ms, server clock
        String status,      // StudentStatus
        long lastSeen,      // epoch ms
        long tokenIat       // epoch SECONDS of the JWT this roll currently holds
) {}
