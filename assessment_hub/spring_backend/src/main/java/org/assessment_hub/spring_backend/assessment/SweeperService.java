package org.assessment_hub.spring_backend.assessment;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.evaluation.AssessmentRepo;
import org.assessment_hub.spring_backend.evaluation.AssessmentStatus;
import org.assessment_hub.spring_backend.question.QuestionSetRepo;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.exception.SdkException;

@Service
@Slf4j
@RequiredArgsConstructor
public class SweeperService {

    private final RedisService redis;
    private final QuestionSetRepo questionSets;
    private final SeaweedStorageService storage;
    private final AssessmentRepo submissions;
    private final FlushService flushService;
    private final BroadcastService broadcast;

    /** The only time authority in the system. */
    @Scheduled(fixedRate = Constants.SWEEPER_RATE_MS)
    public void sweep() {
        long now = System.currentTimeMillis();
        for (String code : redis.allCodes()) {
            try {
                Map<String, String> info = redis.getInfo(code);
                if (info == null) continue; // claim written but host request died before info — harmless
                switch (info.get("status")) {
                    case "SCHEDULED" -> { if (now >= Long.parseLong(info.get("start_ts"))) startAssessment(code, info); }
                    case "LIVE" -> {
                        heartbeatPass(code, now);
                        if (now >= Long.parseLong(info.get("end_ts"))) flushService.beginEnd(code, "sweeper");
                    }
                    case "FLUSHING", "FAILED" -> flushService.maybeRetry(code);
                    default -> { /* ENDED never lingers here (purged on commit) */ }
                }
            } catch (Exception e) {
                log.error("Sweep tick failed for {}", code, e);
            }
        }
    }

    /** Fetch-questions-FIRST (A7): a SeaweedFS outage leaves the assessment safely SCHEDULED. */
    private void startAssessment(String code, Map<String, String> info) {
        String questionJsonKey = questionSets.findQuestionJsonById(Long.parseLong(info.get("question_set_id")))
                .orElse(null);
        if (questionJsonKey == null) {
            log.error("Question set for {} has no stored JSON key; cannot start.", code);
            return;
        }
        String json;
        try {
            json = new String(storage.download(questionJsonKey).content(), StandardCharsets.UTF_8);
        } catch (SdkException e) {
            log.warn("Storage unavailable while starting {}; will retry next tick.", code);
            return;
        }
        redis.setQuestions(code, json);
        if (!redis.startGuard(code)) return; // someone else flipped it

        try {
            long startTs = Long.parseLong(info.get("start_ts"));
            submissions.markLive(Long.parseLong(info.get("assessment_id")), AssessmentStatus.LIVE,
                    LocalDateTime.ofInstant(Instant.ofEpochMilli(startTs), ZoneId.systemDefault()));
            // total_conducted / last_conducted on the question set
            questionSets.findById(Long.parseLong(info.get("question_set_id"))).ifPresent(qs -> {
                qs.setTotalConducted(qs.getTotalConducted() + 1);
                qs.setLastConducted(LocalDateTime.ofInstant(Instant.ofEpochMilli(startTs), ZoneId.systemDefault()));
                questionSets.save(qs);
            });
        } catch (Exception e) {
            // Redis is truth while live; Postgres gets reconciled at flush. Never block the start.
            log.error("Postgres start-write failed for {} — continuing on Redis truth.", code, e);
        }

        redis.pushEvent(code, "STARTED", "Assessment started", null);
        broadcast.pushTeacherEvent(code, "STARTED", "Assessment started", null);
        broadcast.pushStudentList(code);
        log.info("Assessment {} started", code);
    }

    private void heartbeatPass(String code, long now) {
        Map<String, StudentDto> students = redis.getStudents(code);
        for (Map.Entry<String, StudentDto> e : students.entrySet()) {
            StudentDto s = e.getValue();
            if (StudentStatus.CONNECTED.equals(s.status())
                    && now - s.lastSeen() > Constants.HEARTBEAT_TIMEOUT_MS) {
                if (redis.transitionStudent(code, e.getKey(), s, StudentStatus.DISCONNECTED, StudentStatus.CONNECTED)) {
                    redis.pushEvent(code, "DISCONNECTED", "Lost connection — " + e.getKey(), e.getKey());
                    broadcast.pushStudentList(code);
                }
            }
        }
    }
}
