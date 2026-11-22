package org.assessment_hub.spring_backend.assessment.dtos;

public record StudentRowDto(String roll, String name, String status, long joinedAt, long lastSeen) {
    public static StudentRowDto from(String roll, StudentDto e) {
        return new StudentRowDto(roll, e.name(), e.status(), e.joinedAt(), e.lastSeen());
    }
}
