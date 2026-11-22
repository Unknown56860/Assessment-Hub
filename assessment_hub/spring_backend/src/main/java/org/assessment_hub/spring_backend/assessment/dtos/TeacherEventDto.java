package org.assessment_hub.spring_backend.assessment.dtos;

public record TeacherEventDto(String type, String message, String roll, long ts) {
    public static TeacherEventDto of(String type, String message, String roll) {
        return new TeacherEventDto(type, message, roll, System.currentTimeMillis());
    }
}
