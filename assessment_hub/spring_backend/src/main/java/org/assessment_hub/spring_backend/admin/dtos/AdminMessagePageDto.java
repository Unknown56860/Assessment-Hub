package org.assessment_hub.spring_backend.admin.dtos;

import java.util.List;

public record AdminMessagePageDto(
        long total_read,
        long total_unread,
        long total_answered,
        List<AdminMessageDto> messages
) {}
