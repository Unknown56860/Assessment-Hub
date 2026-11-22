package org.assessment_hub.spring_backend.admin.dtos;

import java.time.LocalDateTime;

import org.assessment_hub.spring_backend.general.MessageStatus;
import org.assessment_hub.spring_backend.general.MessageEntity;

public record AdminMessageDto(
        Long message_id,
        String name,
        String email,
        String subject,
        String message,
        LocalDateTime created_at,
        MessageStatus status
) {
    public static AdminMessageDto from(MessageEntity e) {
        return new AdminMessageDto(e.getMessageId(), e.getName(), e.getEmail(),
                e.getSubject(), e.getMessage(), e.getCreatedAt(), e.getStatus());
    }
}
