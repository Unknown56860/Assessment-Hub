package org.assessment_hub.spring_backend.assessment.dtos;

public record HostResponseDto(
        Long assessmentId, String code, String title, String description,
        Long questionSetId, Integer maxStudents, Integer durationMin,
        long startTs, long endTs, String hostUtc, String hostJwt) {
    public static HostResponseDto of(Long id, String code, String title, String description,
                                     Long qsetId, Integer max, Integer dur, long s, long e,
                                     String utc, String jwt) {
        return new HostResponseDto(id, code, title, description, qsetId, max, dur, s, e, utc, jwt);
    }
}
