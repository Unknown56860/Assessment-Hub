package org.assessment_hub.spring_backend.assessment.dtos;

import java.util.List;

import org.assessment_hub.spring_backend.assessment.StudentStatus;

public record StudentListDto(String type, List<StudentRowDto> students,
                             int connected, int submitted, int kicked, int total) {
    public static StudentListDto of(List<StudentRowDto> rows) {
        int connected = 0; int submitted = 0; int kicked = 0;
        for (StudentRowDto r : rows) {
            switch (r.status()) {
                case StudentStatus.CONNECTED -> connected++;
                case StudentStatus.SUBMITTED -> submitted++;
                case StudentStatus.KICKED -> kicked++;
                default -> { }
            }
        }
        return new StudentListDto("STUDENTS", rows, connected, submitted, kicked, rows.size());
    }
}
