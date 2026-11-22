package org.assessment_hub.spring_backend.assessment;

import java.util.Comparator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.evaluation.AssessmentRepo;
import org.assessment_hub.spring_backend.evaluation.AssessmentStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;

import lombok.extern.slf4j.Slf4j;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
@Slf4j
public class FlushService {

    private final RedisService redis;
    private final SeaweedStorageService storage;
    private final AssessmentRepo submissions;
    private final BroadcastService broadcast;
    private final SessionRegistry registry;
    private final ObjectMapper mapper;

    private final ExecutorService flushPool = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "assessment-flush");
        t.setDaemon(true);
        return t;
    });

    /** code -> last retry attempt; guards against retry storms while S3 is down. */
    private final Map<String, Long> lastAttempt = new ConcurrentHashMap<>();
    private final Set<String> inFlight = ConcurrentHashMap.newKeySet();

    public FlushService(RedisService redis, SeaweedStorageService storage,
                        AssessmentRepo submissions, BroadcastService broadcast,
                        SessionRegistry registry, ObjectMapper mapper) {
        this.redis = redis; this.storage = storage; this.submissions = submissions;
        this.broadcast = broadcast; this.registry = registry; this.mapper = mapper;
    }

    /**
     * Triggered by: sweeper (end_ts passed), teacher end_now (also valid while SCHEDULED).
     * Step 1 (Lua LIVE|SCHEDULED -> FLUSHING) runs synchronously; steps 2-7 run on the
     * flush pool so the sweeper thread is never blocked.
     */
    public void beginEnd(String code, String trigger) {
        String prior = redis.beginFlushGuard(code);
        if (prior == null) {
            if ("teacher".equals(trigger))
                broadcast.pushTeacherEvent(code, "INFO", "Assessment is already being archived.", null);
            return;
        }
        String msg = "SCHEDULED".equals(prior)
                ? "Assessment cancelled before start — archiving."
                : "Assessment ended. Archiving results.";
        redis.pushEvent(code, "ENDED", msg, null);
        broadcast.pushTeacherEvent(code, "ENDED", msg, null);
        broadcast.pushEnded(code);
        inFlight.add(code);
        lastAttempt.put(code, System.currentTimeMillis());
        final boolean firstPass = true;
        flushPool.submit(() -> doFlush(code, firstPass));
    }

    /** Recovery sweeper entry point for FLUSHING / FAILED codes. */
    public void maybeRetry(String code) {
        long now = System.currentTimeMillis();
        Long last = lastAttempt.get(code);
        if (inFlight.contains(code) || (last != null && now - last < Constants.FLUSH_RETRY_MS)) return;
        lastAttempt.put(code, now);
        inFlight.add(code);
        flushPool.submit(() -> doFlush(code, false));
    }

    private void doFlush(String code, boolean firstPass) {
        try {
            Map<String, String> info = redis.getInfo(code);
            if (info == null) { // keys gone (evicted) — nothing recoverable
                redis.allCodes().stream().filter(code::equals).findFirst()
                        .ifPresent(c -> redis.releaseCodeClaim(code));
                log.warn("Flush aborted for {}: keys are gone.", code);
                return;
            }
            long assessmentId = Long.parseLong(info.get("assessment_id"));

            // --- Step 2: grace for in-flight STOMP frames on the first pass only ---
            if (firstPass) {
                try { Thread.sleep(Constants.FLUSH_GRACE_MS); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                finalizeStudentStates(code);
            }

            // --- Step 3-4: read everything FROM REDIS, build the bundle ---
            Map<String, StudentDto> students = redis.getStudents(code);
            ArrayNode submissionsNode = mapper.createArrayNode();
            for (Map.Entry<String, StudentDto> e : students.entrySet().stream()
                    .sorted(Map.Entry.comparingByKey()).toList()) {
                String roll = e.getKey();
                StudentDto s = e.getValue();
                ObjectNode studentNode = mapper.createObjectNode();
                studentNode.put("name", s.name());
                studentNode.put("status", s.status().toString()); // final live status, exactly as in the design sample
                ArrayNode answersNode = studentNode.putArray("answers");
                Map<String, String> answers = redis.getAnswers(code, roll);
                for (Map.Entry<String, String> a : answers.entrySet().stream()
                        .sorted(Comparator.comparingLong(x -> Long.parseLong(x.getKey()))).toList()) {
                    ObjectNode ans = answersNode.addObject();
                    ans.put("question_id", Long.parseLong(a.getKey()));
                    ans.set("answer", mapper.readTree(a.getValue())); // preserve answer shape (array/string)
                }
                ObjectNode wrapper = submissionsNode.addObject();
                wrapper.set(roll, studentNode);
            }
            ObjectNode bundle = mapper.createObjectNode();
            bundle.put("assessment_id", assessmentId);
            bundle.set("submissions", submissionsNode);
            String json = mapper.writeValueAsString(bundle);

            // --- Step 5: deterministic key => retries overwrite, never orphan ---
            String key = storage.uploadSubmissionJson(assessmentId, json);

            // --- Step 6: Postgres commit (guarded against regressing ENDED) ---
            int updated = submissions.markEnded(assessmentId, AssessmentStatus.ENDED, key, AssessmentStatus.ENDED);
            if (updated == 0 && submissions.findById(assessmentId).isEmpty()) {
                log.warn("Flush for {} has no submissions row; cleaning Redis anyway.", code);
            }

            // --- Step 7: ONLY AFTER commit — cleanup ---
            redis.purgeAssessment(code, info.get("host_email"), students.keySet());
            registry.closeTeachers(code, new CloseStatus(1000, "ENDED"));
            log.info("Assessment {} archived to {}", code, key);

        } catch (Exception e) {
            log.error("Flush failed for {}", code, e);
            try {
                Map<String, String> info = redis.getInfo(code);
                if (info != null) {
                    redis.markFailedGuard(code);
                    submissions.markFailed(Long.parseLong(info.get("assessment_id")),
                            AssessmentStatus.FAILED, AssessmentStatus.FLUSHING);
                    redis.pushEvent(code, "FLUSH_FAILED",
                            "Archiving failed — will retry automatically.", null);
                    broadcast.pushTeacherEvent(code, "ERROR",
                            "Archiving failed; automatic retry in progress.", null);
                }
            } catch (Exception inner) {
                log.error("Failed to record FAILED state for {}", code, inner);
            }
        } finally {
            inFlight.remove(code);
        }
    }

    /** CONNECTED -> TIME_OVER (+close 4002). DISCONNECTED students keep their status
     *  (matches the bundle sample) but get a time-over event with the mention. */
    private void finalizeStudentStates(String code) {
        Map<String, StudentDto> students = redis.getStudents(code);
        for (Map.Entry<String, StudentDto> e : students.entrySet()) {
            String roll = e.getKey();
            StudentDto s = e.getValue();
            switch (s.status()) {
                case StudentStatus.CONNECTED -> {
                    if (redis.transitionStudent(code, roll, s, StudentStatus.TIME_OVER, StudentStatus.CONNECTED)) {
                        redis.pushEvent(code, "TIME_OVER", "Time over — " + roll, roll);
                        registry.closeStudent(code, roll, Constants.TIME_OVER);
                    }
                }
                case StudentStatus.DISCONNECTED ->
                        redis.pushEvent(code, "TIME_OVER", "Time over — " + roll + " (was disconnected)", roll);
                default -> { /* SUBMITTED / KICKED already logged at their transition */ }
            }
        }
        broadcast.pushStudentList(code);
    }
}
