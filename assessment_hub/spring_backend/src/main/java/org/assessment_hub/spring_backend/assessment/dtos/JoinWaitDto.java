package org.assessment_hub.spring_backend.assessment.dtos;

public record JoinWaitDto(String status, long startTs, long serverTs, String hostUtc) {}
