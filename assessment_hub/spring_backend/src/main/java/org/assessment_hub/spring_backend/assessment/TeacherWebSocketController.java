package org.assessment_hub.spring_backend.assessment;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.security.Principal;

import org.assessment_hub.spring_backend.assessment.dtos.ExtendCommandDto;
import org.assessment_hub.spring_backend.assessment.dtos.RemainingDto;
import org.assessment_hub.spring_backend.assessment.dtos.RollCommandDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentRowDto;
import org.assessment_hub.spring_backend.assessment.dtos.TeacherSnapshotDto;
import org.assessment_hub.spring_backend.auth.JwtService;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.assessment_hub.spring_backend.core.websocket.WebSocketIdentity;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.stereotype.Controller;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class TeacherWebSocketController {

    private final RedisService redis;
    private final SessionRegistry registry;
    private final FlushService flushService;
    private final BroadcastService broadcast;

    @SubscribeMapping("/live/{code}/init")
    public TeacherSnapshotDto init(@DestinationVariable String code, WebSocketIdentity id) {
        if (id == null || !JwtService.ROLE_HOST.equals(id.role()) || !code.equals(id.code())
                || !code.equals(redis.getHostCode(id.email()))) return null;
        Map<String, String> info = redis.getInfo(code);
        if (info == null) return null;
        List<StudentRowDto> rows = redis.getStudents(code).entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> StudentRowDto.from(e.getKey(), e.getValue())).toList();
        int connected = 0, submitted = 0, kicked = 0;
        for (StudentRowDto r : rows) switch (r.status()) {
            case StudentStatus.CONNECTED -> connected++;
            case StudentStatus.SUBMITTED -> submitted++;
            case StudentStatus.KICKED -> kicked++;
            default -> { }
        }
        return new TeacherSnapshotDto(info.get("status"), Long.parseLong(info.get("end_ts")),
                System.currentTimeMillis(), rows, redis.getEvents(code), connected, submitted, kicked, rows.size());
    }

    @MessageMapping("/live/{code}/kick")
    public void kick(@DestinationVariable String code, RollCommandDto cmd, Principal principal) {
        if (!assertHost(code, principal)) return;
        StudentDto entry = redis.getStudent(code, cmd.roll());
        if (entry == null) { reject(code, "Unknown roll " + cmd.roll()); return; }
        if (redis.transitionStudent(code, cmd.roll(), entry, StudentStatus.KICKED,
                StudentStatus.CONNECTED, StudentStatus.DISCONNECTED)) {
            registry.closeStudent(code, cmd.roll(), Constants.KICKED);
            redis.pushEvent(code, "KICKED", "Removed by teacher — " + cmd.roll(), cmd.roll());
            broadcast.pushStudentList(code);
        } else {
            reject(code, "Roll " + cmd.roll() + " cannot be kicked right now.");
        }
    }

    @MessageMapping("/live/{code}/unkick")
    public void unkick(@DestinationVariable String code, RollCommandDto cmd, Principal principal) {
        if (!assertHost(code, principal)) return;
        if (redis.transitionStudent(code, cmd.roll(), null, StudentStatus.DISCONNECTED, StudentStatus.KICKED)) {
            redis.pushEvent(code, "UNKICKED", "Readmitted by teacher — " + cmd.roll(), cmd.roll());
            broadcast.pushStudentList(code);
        } else {
            reject(code, "Roll " + cmd.roll() + " is not kicked.");
        }
    }

    @MessageMapping("/live/{code}/end")
    public void endNow(@DestinationVariable String code, Principal principal) {
        if (!assertHost(code, principal)) return;
        flushService.beginEnd(code, "teacher");
    }

    @MessageMapping("/live/{code}/extend")
    public void extend(@DestinationVariable String code, ExtendCommandDto cmd, Principal principal) {
        if (!assertHost(code, principal)) return;
        if (cmd.minutes() == null || cmd.minutes() < 1 || cmd.minutes() > Constants.EXTEND_MIN_LIMIT) {
            reject(code, "Extension must be between 1 and " + Constants.EXTEND_MIN_LIMIT + " minutes.");
            return;
        }
        Map<String, String> info = redis.getInfo(code);
        if (info == null) return;
        long newEnd = Long.parseLong(info.get("end_ts")) + TimeUnit.MINUTES.toMillis(cmd.minutes());
        long startTs = Long.parseLong(info.get("start_ts"));
        if (newEnd > startTs + TimeUnit.HOURS.toMillis(24)) {
            reject(code, "Total assessment window cannot exceed 24 hours.");
            return;
        }
        redis.updateInfo(code, Map.of("end_ts", String.valueOf(newEnd)));
        redis.pushEvent(code, "EXTENDED", "Time extended by " + cmd.minutes() + " min", null);
        broadcast.pushTeacherEvent(code, "EXTENDED", "Time extended by " + cmd.minutes() + " min", null);
        broadcast.pushRemaining(code);
        broadcast.pushToTeacher(principal.getName().replaceFirst("^teacher:", ""), code,
            RemainingDto.of(newEnd, System.currentTimeMillis()));
    }

    /** Teacher commands are validated against assessment:hosts on EVERY command (§3). */
    private boolean assertHost(String code, Principal principal) {
        String email = principal == null ? null : principal.getName().replaceFirst("^teacher:", "");
        if (email == null || !code.equals(redis.getHostCode(email))) {
            reject(code, "You are not the host of this assessment.");
            return false;
        }
        return true;
    }

    private void reject(String code, String message) {
        broadcast.pushTeacherEvent(code, "ERROR", message, null);
    }
}
