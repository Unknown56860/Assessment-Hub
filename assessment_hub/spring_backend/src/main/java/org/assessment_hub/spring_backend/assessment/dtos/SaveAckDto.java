package org.assessment_hub.spring_backend.assessment.dtos;

/** Per-save reply, pushed to the sender at /user/queue/assessment/ack. */
public record SaveAckDto(long questionId, boolean saved, long serverTs) {
    public static SaveAckDto rejected(Long questionId) {
        return new SaveAckDto(questionId == null ? -1 : questionId, false, System.currentTimeMillis());
    }
}
