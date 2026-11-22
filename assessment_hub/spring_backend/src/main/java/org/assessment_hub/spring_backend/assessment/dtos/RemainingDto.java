package org.assessment_hub.spring_backend.assessment.dtos;

public record RemainingDto(String type, long endTs, long serverTs) {
    public static RemainingDto of(long endTs, long serverTs) {
        return new RemainingDto("REMAINING", endTs, serverTs);
    }
}
