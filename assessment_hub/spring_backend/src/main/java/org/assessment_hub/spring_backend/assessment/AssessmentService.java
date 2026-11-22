package org.assessment_hub.spring_backend.assessment;

import org.assessment_hub.spring_backend.assessment.dtos.HostRequestDto;
import org.assessment_hub.spring_backend.assessment.dtos.HostResponseDto;
import org.assessment_hub.spring_backend.assessment.dtos.JoinRequestDto;
import org.assessment_hub.spring_backend.assessment.dtos.JoinResponseDto;
import org.assessment_hub.spring_backend.assessment.dtos.JoinWaitDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.auth.JwtService;
import org.assessment_hub.spring_backend.auth.guard.WriteGuard;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.assessment_hub.spring_backend.evaluation.AssessmentEntity;
import org.assessment_hub.spring_backend.evaluation.AssessmentRepo;
import org.assessment_hub.spring_backend.evaluation.AssessmentStatus;
import org.assessment_hub.spring_backend.profile.ActivityService;
import org.assessment_hub.spring_backend.question.QuestionSetEntity;
import org.assessment_hub.spring_backend.question.QuestionSetRepo;

import java.security.SecureRandom;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class AssessmentService {

    private static final String CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

    private final RedisService redis;
    private final AssessmentRepo submissions;
    private final QuestionSetRepo questionSets;
    private final JwtService jwt;
    private final BroadcastService broadcast;
    private final WriteGuard writeGuard;
    private final ActivityService activity;
    private final SecureRandom random = new SecureRandom();

    // ============================ HOST ============================

    /** GET /assessment/code — candidate only; uniqueness re-verified atomically at POST. */
    public String generateCode() {
        for (int attempt = 0; attempt < 50; attempt++) {
            StringBuilder sb = new StringBuilder(Constants.CODE_LENGTH);
            for (int i = 0; i < Constants.CODE_LENGTH; i++)
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            String code = sb.toString();
            if (!redis.allCodes().contains(code) && !redis.existsInfo(code)) return code;
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Could not allocate an assessment code. Please try again.");
    }

    @Transactional 
    public HostResponseDto host(String teacherEmail, HostRequestDto dto) {
        writeGuard.requireWriteAccess();

        if (redis.getHostCode(teacherEmail) != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You already have an active assessment. End it before hosting another.");

        QuestionSetEntity qs = questionSets.findById(dto.questionSetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question set not found."));
        if (!qs.getUser().getEmail().equals(teacherEmail))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This question set belongs to another teacher.");

        String code = dto.assessmentCode() == null ? null : dto.assessmentCode().trim().toLowerCase();
        if (code == null || !code.matches("[a-z]{6}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assessment code must be 6 lowercase letters.");

        // Atomic claim FIRST (fails if the info key already appeared meanwhile) — the info
        // key is written immediately after, per the design.
        if (!redis.claimCode(code))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This assessment code is already in use.");

        long nowMs = System.currentTimeMillis();
        long startTs;
        long endTs;
        String hostUtc;
        try {
            ZoneOffset utc = resolveUtc(dto.utc(), dto.startAt(), dto.endAt());
            hostUtc = utc.getId();

            startTs = resolveInstant(dto.startAt(), utc).toEpochMilli();
            if (startTs < nowMs - 1000)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start time cannot be in the past.");
            if (startTs > nowMs + TimeUnit.DAYS.toMillis(7))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start time cannot be more than 7 days ahead.");

            long durationMs = TimeUnit.MINUTES.toMillis(requireDuration(dto.durationMin()));
            endTs = resolveInstant(dto.endAt(), utc).toEpochMilli();
            if (endTs - startTs < durationMs)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "End time must leave at least the full duration after the start time.");
        } catch (ResponseStatusException e) {
            redis.releaseCodeClaim(code);
            throw e;
        } catch (DateTimeParseException e) {
            redis.releaseCodeClaim(code);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ISO-8601 date/time or utc offset.");
        }

        AssessmentEntity row = AssessmentEntity.builder()
                .questionSet(qs)
                .assessmentTitle(dto.title())
                .assessmentDescription(dto.description())
                .status(AssessmentStatus.SCHEDULED)
                .build();
        row = submissions.save(row); // Postgres is truth at rest — created before Redis goes live

        try {
            Map<String, String> info = new LinkedHashMap<>();
            info.put("assessment_id", String.valueOf(row.getAssessmentId()));
            info.put("status", AssessmentStatus.SCHEDULED.name());
            info.put("host_email", teacherEmail);
            info.put("question_set_id", String.valueOf(qs.getQuestionSetId()));
            info.put("title", dto.title());
            info.put("description", dto.description() == null ? "" : dto.description());
            info.put("max_students", String.valueOf(resolveMaxStudents(dto.maxStudents())));
            info.put("duration", String.valueOf(dto.durationMin()));
            info.put("start_ts", String.valueOf(startTs));
            info.put("end_ts", String.valueOf(endTs));
            info.put("host_utc", hostUtc);
            info.put("created_at", String.valueOf(nowMs));
            redis.writeInfo(code, info);
            redis.setHost(teacherEmail, code);
            redis.pushEvent(code, "READY",
                    "Assessment ready and starts at " + fmt(startTs, hostUtc), null);
        } catch (RuntimeException e) {
            submissions.deleteById(row.getAssessmentId()); // compensate the DB write
            redis.releaseCodeClaim(code);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not initialize the live session. Please retry.", e);
        }

        activity.addLog("Hosted live assessment",
                String.format("Code: %s, Title: %s, Question set: %d, Starts: %s, Ends: %s",
                        code, dto.title(), qs.getQuestionSetId(), fmt(startTs, hostUtc), fmt(endTs, hostUtc)));

        return HostResponseDto.of(row.getAssessmentId(), code, dto.title(), dto.description(),
                qs.getQuestionSetId(), resolveMaxStudents(dto.maxStudents()), dto.durationMin(),
                startTs, endTs, hostUtc, jwt.mintHostToken(teacherEmail, code));
    }

    /** GET /assessment/host — reattach instead of re-hosting. 404 when not actively hosting. */
    @Transactional(readOnly = true)
    public HostResponseDto activeHostView(String teacherEmail) {
        String code = redis.getHostCode(teacherEmail);
        if (code == null) throw notHosting();
        Map<String, String> info = redis.getInfo(code);
        if (info == null) throw notHosting();
        String status = info.get("status");
        if (!AssessmentStatus.SCHEDULED.name().equals(status) && !AssessmentStatus.LIVE.name().equals(status))
            throw notHosting();

        return HostResponseDto.of(Long.parseLong(info.get("assessment_id")), code,
                info.get("title"), info.get("description"),
                Long.parseLong(info.get("question_set_id")),
                Integer.parseInt(info.get("max_students")), Integer.parseInt(info.get("duration")),
                Long.parseLong(info.get("start_ts")), Long.parseLong(info.get("end_ts")),
                info.get("host_utc"), jwt.mintHostToken(teacherEmail, code));
    }

    private ResponseStatusException notHosting() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "No active assessment.");
    }

    // ============================ JOIN / REJOIN ============================

    public Object join(JoinRequestDto dto) {
        String code = dto.code() == null ? "" : dto.code().trim().toLowerCase();
        String roll = dto.roll() == null ? "" : dto.roll().trim();
        String name = dto.name() == null ? "" : dto.name().trim();
        
        if (!code.matches("[a-z]{6}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid assessment code.");
        if (roll.isEmpty() || roll.length() > 64 || !roll.matches("[A-Za-z0-9._\\-]+"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid roll number.");
        if (name.isEmpty() || name.length() > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid name.");

        Map<String, String> info = redis.getInfo(code);
        if (info == null)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assessment not found.");

        String status = info.get("status");
        if (AssessmentStatus.SCHEDULED.name().equals(status)) {
            // Not started yet — hand back the start time so the student gets a countdown.
            return new JoinWaitDto(AssessmentStatus.SCHEDULED.name(),
                    Long.parseLong(info.get("start_ts")), System.currentTimeMillis(), info.get("host_utc"));
        }
        if (!AssessmentStatus.LIVE.name().equals(status))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This assessment is not accepting participants.");

        long now = System.currentTimeMillis();
        long startTs = Long.parseLong(info.get("start_ts"));
        long durationMs = TimeUnit.MINUTES.toMillis(Long.parseLong(info.get("duration")));
        long windowMs = Math.min(Constants.LATE_JOIN_WINDOW_SECONDS * 1000, durationMs);
        if (now > startTs + windowMs)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The join window for this assessment has closed.");

        StudentDto existing = redis.getStudent(code, roll);
        long iatSeconds = now / 1000;

        if (existing != null) {
            switch (existing.status()) {
                case StudentStatus.SUBMITTED ->
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "This roll has already submitted.");
                case StudentStatus.TIME_OVER ->
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "The time for this roll is over.");
                case StudentStatus.KICKED ->
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "This roll was removed by the teacher and cannot rejoin until readmitted.");
                case StudentStatus.CONNECTED -> {
                    redis.pushEvent(code, "DUPLICATE_JOIN",
                            "Duplicate join attempt rejected for roll " + roll, roll);
                    broadcast.pushTeacherEvent(code, "DUPLICATE_JOIN",
                            "Someone tried to join with roll " + roll + " which is already attempting.", roll);
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "This roll is currently attempting the assessment on another device.");
                }
                case StudentStatus.DISCONNECTED -> {
                    return accept(code, roll, name, existing.joinedAt(), iatSeconds, true, "Reconnected", "REJOINED");
                }
                default -> 
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Unhandled student status: " + existing.status());
            }
        }

        // Fresh roll — atomic admission against the total-attempted cap
        int maxStudents = Integer.parseInt(info.get("max_students"));
        StudentDto fresh = new StudentDto(name, now, StudentStatus.CONNECTED, now, iatSeconds);
        int admitted = redis.admitStudent(code, roll, maxStudents, fresh);
        if (admitted == -1)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The assessment is full.");
        if (admitted == -2)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This roll has already joined.");

        redis.pushEvent(code, "JOINED", name + " (" + roll + ") joined", roll);
        broadcast.pushStudentList(code);
        return buildResponse(code, roll, name, now, iatSeconds, false);
    }

    private JoinResponseDto accept(String code, String roll, String name, long joinedAt,
                                   long iatSeconds, boolean rejoin, String eventMsg, String eventType) {
        StudentDto updated = new StudentDto(name, joinedAt, StudentStatus.CONNECTED,
                System.currentTimeMillis(), iatSeconds);
        redis.refreshAfterRejoin(code, roll, updated);
        redis.pushEvent(code, eventType, eventMsg + " — " + name + " (" + roll + ")", roll);
        broadcast.pushStudentList(code);
        return buildResponse(code, roll, name, joinedAt, iatSeconds, rejoin);
    }

    private JoinResponseDto buildResponse(String code, String roll, String name, long joinedAt, long iatSeconds, boolean rejoin) {
        Map<String, String> info = redis.getInfo(code);
        String jwtToken = jwt.mintStudentToken(code, roll, iatSeconds);
        return new JoinResponseDto(jwtToken, code, roll, name, joinedAt, rejoin,
                Long.parseLong(info.get("end_ts")), System.currentTimeMillis(), info.get("host_utc"));
    }

    // ============================ time helpers ============================

    private ZoneOffset resolveUtc(String utc, String... instants) {
        // Prefer an explicit offset baked into the ISO strings; fall back to the utc field.
        for (String s : instants) {
            if (s == null) continue;
            try { return OffsetDateTime.parse(s).getOffset(); } catch (DateTimeParseException ignored) {}
        }
        if (utc != null && !utc.isBlank()) {
            try { return ZoneOffset.of(utc.trim()); } catch (DateTimeException ignored) {}
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Provide a valid utc offset (e.g. \"+05:30\") or fully offset ISO-8601 datetimes.");
    }

    private Instant resolveInstant(String iso, ZoneOffset fallback) {
        try { return OffsetDateTime.parse(iso).toInstant(); }
        catch (DateTimeParseException e) {
            return LocalDateTime.parse(iso).atOffset(fallback).toInstant();
        }
    }

    private int requireDuration(Integer durationMin) {
        if (durationMin == null || durationMin < Constants.MIN_DURATION_MIN || durationMin > Constants.DURATION_MIN_LIMIT)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "duration_min must be between " + Constants.MIN_DURATION_MIN
                            + " and " + Constants.DURATION_MIN_LIMIT + " minutes.");
        return durationMin;
    }

    private int resolveMaxStudents(Integer maxStudents) {
        if (maxStudents == null) return Constants.MAX_STUDENTS_DEFAULT;
        if (maxStudents < 1 || maxStudents > Constants.MAX_STUDENTS_HARD_CAP)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "max_students must be between 1 and " + Constants.MAX_STUDENTS_HARD_CAP + ".");
        return maxStudents;
    }

    static String fmt(long epochMs, String hostUtc) {
        return Instant.ofEpochMilli(epochMs).atOffset(ZoneOffset.of(hostUtc))
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) + " (" + hostUtc + ")";
    }
}

