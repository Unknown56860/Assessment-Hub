package org.assessment_hub.spring_backend.profile.dto;

import java.time.LocalDateTime;

import org.assessment_hub.spring_backend.profile.ActivityLogEntity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ActivityLogDto (
    @NotBlank String action,
    String description,
    @NotNull LocalDateTime time
) {
    public static ActivityLogDto from(ActivityLogEntity entity) {
        return new ActivityLogDto(
            entity.getAction(),
            entity.getDescription(),
            entity.getTime()
        );
    }
}
