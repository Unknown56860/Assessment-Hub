package org.assessment_hub.spring_backend.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileUpdateDto(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 50) String mobileNo,
        @Size(max = 100) String designation
) {}
