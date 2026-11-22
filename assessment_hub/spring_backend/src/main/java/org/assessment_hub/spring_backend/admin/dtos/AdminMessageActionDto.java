package org.assessment_hub.spring_backend.admin.dtos;

import org.assessment_hub.spring_backend.admin.AdminActions;
import org.assessment_hub.spring_backend.general.MessageStatus;

import jakarta.validation.constraints.NotNull;

public record AdminMessageActionDto(
        @NotNull (message = "Message id must be provided")
        Long id,

        @NotNull(message = "Action must be provided")
        AdminActions action,

        /** Required only when action = UPDATE_STATUS (validated in the service). */
        MessageStatus status
) {}
