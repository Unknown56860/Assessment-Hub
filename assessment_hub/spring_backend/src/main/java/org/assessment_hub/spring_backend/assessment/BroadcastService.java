package org.assessment_hub.spring_backend.assessment;

import java.util.List;
import java.util.Map;

import org.assessment_hub.spring_backend.assessment.dtos.RemainingDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentListDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentRowDto;
import org.assessment_hub.spring_backend.assessment.dtos.TeacherEventDto;
import org.assessment_hub.spring_backend.core.redis.RedisService;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BroadcastService {

    /**
     * Lazy handle to the STOMP broker. Injecting SimpMessagingTemplate directly created a
     * startup cycle:
     *   broadcastService -> SimpMessagingTemplate (defined by DelegatingWebSocketMessageBrokerConfiguration)
     *                    -> webSocketLiveConfig -> sessionRegistry -> broadcastService
     * ObjectProvider defers resolution to the first send, after the broker infra exists.
     */

    private final ObjectProvider<SimpMessagingTemplate> wsProvider;
    private final RedisService redis;

    private SimpMessagingTemplate ws() {
        return wsProvider.getObject();
    }

    /* ---------- teacher: /topic/live/{code} ---------- */

    public void pushTeacherEvent(String code, String type, String message, String roll) {
        sendTopic("/topic/live/" + code, TeacherEventDto.of(type, message, roll));
    }

    /** Full derived list + counts — sent after every mutation that touches students. */
    public void pushStudentList(String code) {
        Map<String, StudentDto> all = redis.getStudents(code);
        List<StudentRowDto> rows = all.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> StudentRowDto.from(e.getKey(), e.getValue()))
                .toList();
        sendTopic("/topic/live/" + code, StudentListDto.of(rows));
    }

    public void pushBoth(String code, String type, String message, String roll) {
        pushTeacherEvent(code, type, message, roll);
        pushStudentList(code);
    }

    /* ---------- students: /topic/assessment/{code} (broadcast) ---------- */

    public void pushRemaining(String code) {
        Map<String, String> info = redis.getInfo(code);
        if (info == null) return;
        sendTopic("/topic/assessment/" + code,
                RemainingDto.of(Long.parseLong(info.get("end_ts")), System.currentTimeMillis()));
    }

    public void pushEnded(String code) {
        sendTopic("/topic/assessment/" + code,
                Map.of("type", "ENDED", "message", "Assessment has ended. Submitting your answers."));
    }

    /* ---------- per-student private ---------- */

    public void pushToStudent(String code, String roll, Object payload) {
        ws().convertAndSendToUser("stu:" + code + ":" + roll, "/queue/assessment/" + code, payload);
    }

    public void pushToTeacher(String email, String code, Object payload) {
        ws().convertAndSendToUser(email, "/queue/live/" + code, payload);
    }

    private void sendTopic(String dest, Object payload) { ws().convertAndSend(dest, payload); }
}
