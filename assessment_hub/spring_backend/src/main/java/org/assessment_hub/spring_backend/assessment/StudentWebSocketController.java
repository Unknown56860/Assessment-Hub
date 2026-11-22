package org.assessment_hub.spring_backend.assessment;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.assessment_hub.spring_backend.assessment.dtos.RemainingDto;
import org.assessment_hub.spring_backend.assessment.dtos.SaveAckDto;
import org.assessment_hub.spring_backend.assessment.dtos.SaveCommandDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentInitDto;
import org.assessment_hub.spring_backend.assessment.dtos.ViolationCommandDto;
import org.assessment_hub.spring_backend.auth.JwtService;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.assessment_hub.spring_backend.core.websocket.WebSocketIdentity;
import org.assessment_hub.spring_backend.evaluation.AssessmentStatus;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.stereotype.Controller;

import lombok.RequiredArgsConstructor;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Controller
@RequiredArgsConstructor
public class StudentWebSocketController {

    private static final long VIOLATION_INTERVAL_MS = 10_000;
    private static final Set<String> REPORT_KINDS =
        Set.of("TAB_SWITCH", "FOCUS_LOST", "FULLSCREEN_EXIT", "COPY_ATTEMPT", "FOCUS_BACK");

    private final ObjectMapper mapper;
    private final RedisService redis;

    private final SessionRegistry registry;
    private final BroadcastService broadcast;
    private final StudentInitService studentInitService;

    /** Rate-limit bookkeeping for violation reports: code|roll|kind -> last report ms. */
    private final Map<String, Long> lastViolation = new ConcurrentHashMap<>();

    @SubscribeMapping("/assessment/{code}/init")
    public StudentInitDto init(@DestinationVariable String code, WebSocketIdentity id) {
        if (id == null || !JwtService.ROLE_STUDENT.equals(id.role()) || !code.equals(id.code())) return null;
        return studentInitService.buildInit(code, id.roll());
    }

    /** Always replies — saved=false lets the client show an honest error toast. */
    @MessageMapping("/assessment/{code}/save")
    @SendToUser("/queue/assessment/ack")
    public SaveAckDto save(@DestinationVariable String code, SaveCommandDto cmd, WebSocketIdentity id) {
        if (id == null) return SaveAckDto.rejected(cmd == null ? null : cmd.questionId());

        Map<String, String> info = redis.getInfo(code);
        boolean accepting = info != null
                && AssessmentStatus.LIVE.name().equals(info.get("status"))
                && System.currentTimeMillis() <= Long.parseLong(info.get("end_ts"));
        StudentDto entry = accepting ? redis.getStudent(code, id.roll()) : null;
        if (entry == null || !StudentStatus.CONNECTED.equals(entry.status()))
            return SaveAckDto.rejected(cmd == null ? null : cmd.questionId());

        if (cmd.questionId() == null || cmd.answer() == null) return SaveAckDto.rejected(cmd.questionId());

        String answerJson;
        try {
            answerJson = mapper.writeValueAsString(cmd.answer());
        } catch (JacksonException e) {
            return SaveAckDto.rejected(cmd.questionId());
        }
        if (answerJson.length() > Constants.MAX_ANSWER_BYTES) return SaveAckDto.rejected(cmd.questionId());

        redis.setAnswer(code, id.roll(), String.valueOf(cmd.questionId()), answerJson);
        redis.touchStudent(code, id.roll());
        return new SaveAckDto(cmd.questionId(), true, System.currentTimeMillis());
    }

    @MessageMapping("/assessment/{code}/submit")
    public void submit(@DestinationVariable String code, WebSocketIdentity id) {
        if (id == null) return;
        if (redis.transitionStudent(code, id.roll(), null, StudentStatus.SUBMITTED, StudentStatus.CONNECTED)) {
            redis.pushEvent(code, "SUBMITTED", "Submitted — " + id.roll(), id.roll());
            registry.closeStudent(code, id.roll(), Constants.ALREADY_SUBMITTED);
            broadcast.pushStudentList(code);
        }
    }

    @MessageMapping("/assessment/{code}/heartbeat")
    public void heartbeat(@DestinationVariable String code, WebSocketIdentity id) {
        if (id == null) return;
        redis.touchStudent(code, id.roll());
        Map<String, String> info = redis.getInfo(code);
        if (info != null) {
            broadcast.pushToStudent(code, id.roll(),
                    RemainingDto.of(Long.parseLong(info.get("end_ts")), System.currentTimeMillis()));
        }
    }

    /** Integrity events: tab switch, focus loss, fullscreen exit, blocked copy/paste.
     *  Rate-limited per kind; only accepted while LIVE and the roll is CONNECTED. */
    @MessageMapping("/assessment/{code}/violation")
    public void violation(@DestinationVariable String code, ViolationCommandDto cmd, WebSocketIdentity id) {
        if (id == null || cmd == null || cmd.kind() == null || !REPORT_KINDS.contains(cmd.kind())) return;
        Map<String, String> info = redis.getInfo(code);
        if (info == null || !AssessmentStatus.LIVE.name().equals(info.get("status"))) return;
        if (System.currentTimeMillis() > Long.parseLong(info.get("end_ts"))) return;
        StudentDto entry = redis.getStudent(code, id.roll());
        if (entry == null || !StudentStatus.CONNECTED.equals(entry.status())) return;

        long now = System.currentTimeMillis();
        String key = code + '|' + id.roll() + '|' + cmd.kind();
        Long last = lastViolation.get(key);
        if (last != null && now - last < VIOLATION_INTERVAL_MS) return;
        lastViolation.put(key, now);

        boolean benign = "FOCUS_BACK".equals(cmd.kind());
        String type = benign ? "FOCUS_BACK" : "VIOLATION";
        String message = (benign ? "Focus back — " : cmd.kind() + " — ") + id.roll();
        redis.pushEvent(code, type, message, id.roll());
        broadcast.pushTeacherEvent(code, type, message, id.roll());
    }
}
