package org.assessment_hub.spring_backend.assessment.dtos;

public record JoinResponseDto(
    String jwt, 
    String code, 
    String roll, 
    String name,
    long joinedAt, 
    boolean rejoin,
    long endTs, 
    long serverTs, 
    String hostUtc
) {}
