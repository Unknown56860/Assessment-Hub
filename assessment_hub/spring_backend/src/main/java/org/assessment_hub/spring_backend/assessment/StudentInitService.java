package org.assessment_hub.spring_backend.assessment;

import java.util.LinkedHashMap;
import java.util.Map;

import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentInitDto;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentInitService {

    private final RedisService redis;
    private final BroadcastService broadcast;

    public StudentInitDto buildInit(String code, String roll) {
        Map<String, String> info = redis.getInfo(code);
        if (info == null) return null;
        StudentDto me = redis.getStudents(code).get(roll);
        if (me == null) return null;
        Map<String, Object> saved = new LinkedHashMap<>();
        redis.getAnswers(code, roll).forEach(saved::put);
        return new StudentInitDto(info.get("title"), Long.parseLong(info.get("question_set_id")),
                redis.getQuestions(code), saved, me.joinedAt(),Long.parseLong(info.get("duration")),
                Long.parseLong(info.get("end_ts")), System.currentTimeMillis(), info.get("host_utc"));
    }

    public void sendInit(String code, String roll) {
        StudentInitDto payload = buildInit(code, roll);
        if (payload != null) broadcast.pushToStudent(code, roll, payload);
    }
}
