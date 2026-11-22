package org.assessment_hub.spring_backend.admin.dtos;

import java.util.List;

import org.assessment_hub.spring_backend.profile.dto.UserDto;

public record AdminUserPageDto(
        long total_pending,
        long total_active,
        long total_restricted,
        List<UserDto> users
) {}
