package org.assessment_hub.spring_backend.assessment.dtos;

import java.util.List;

public record TeacherSnapshotDto(String status, long endTs, long serverTs,
                                 List<StudentRowDto> students, List<EventLogDto> events,
                                 int connected, int submitted, int kicked, int total) {}
