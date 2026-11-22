package org.assessment_hub.spring_backend.profile.dto;

import java.util.List;

public record PagedLogsDto(long total, List<ActivityLogDto> logs) {}

