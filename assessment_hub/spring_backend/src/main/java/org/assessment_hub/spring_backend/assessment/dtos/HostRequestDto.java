package org.assessment_hub.spring_backend.assessment.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HostRequestDto(
        @NotBlank @Pattern(regexp = "[a-z]{6}") String assessmentCode,
        @NotNull Long questionSetId,
        @NotBlank @Size(max = 250) String title,
        @Size(max = 2500) String description,
        @Min(1) @Max(10_000) Integer maxStudents,          // null -> 100
        @NotNull @Min(5) @Max(720) Integer durationMin,    // >= 5 min now
        @NotBlank String startAt,                          // ISO-8601, offset-embedded (Z is fine)
        @NotBlank String endAt,                            // ISO-8601, offset-embedded
        String utc                                         // e.g. "+05:30"; fallback only
) {}
