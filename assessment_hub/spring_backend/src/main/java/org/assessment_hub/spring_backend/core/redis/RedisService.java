package org.assessment_hub.spring_backend.core.redis;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.assessment_hub.spring_backend.assessment.Constants;
import org.assessment_hub.spring_backend.assessment.dtos.EventLogDto;
import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
@Slf4j
@RequiredArgsConstructor
public class RedisService {

    public static final String CODES_SET = "assessment:codes";
    public static final String HOSTS_HASH = "assessment:hosts";

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    // ---------- Lua scripts (Memurai is Redis-wire-compatible; cjson is available) ----------

    /** Atomic code claim: fails if the info key already exists, else registers the code. */
    private static final DefaultRedisScript<Long> CLAIM_CODE = script("""
            if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
            redis.call('SADD', KEYS[2], ARGV[1])
            return 1
            """);

    /** SCHEDULED -> LIVE guard. */
    private static final DefaultRedisScript<Long> START_GUARD = script("""
            local s = redis.call('HGET', KEYS[1], 'status')
            if s == 'SCHEDULED' then
                redis.call('HSET', KEYS[1], 'status', 'LIVE')
                return 1
            end
            return 0
            """);

    /** LIVE|SCHEDULED -> FLUSHING. Returns previous status, '' when not eligible. */
    private static final DefaultRedisScript<Long> BEGIN_FLUSH = script("""
            local s = redis.call('HGET', KEYS[1], 'status')
            if s == 'LIVE' or s == 'SCHEDULED' then
                redis.call('HSET', KEYS[1], 'status', 'FLUSHING')
                return 2
            end
            return 0
            """);

    /** FLUSHING -> FAILED guard. */
    private static final DefaultRedisScript<Long> FAIL_GUARD = script("""
            local s = redis.call('HGET', KEYS[1], 'status')
            if s == 'FLUSHING' then
                redis.call('HSET', KEYS[1], 'status', 'FAILED')
                return 1
            end
            return 0
            """);

    /** Atomic admission. ARGV: roll, max, json. Returns 1 admitted, -1 full, -2 exists. */
    private static final DefaultRedisScript<Long> ADMIT_STUDENT = script("""
            if redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[2]) then return -1 end
            if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return -2 end
            redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
            return 1
            """);

    /**
     * Guarded student-state transition. ARGV: roll, newStatus, lastSeenMs, allowedStatus...
     * Decodes the entry JSON, checks current status is in the allowed set, then rewrites it.
     */
    private static final DefaultRedisScript<Long> TRANSITION_STUDENT = script("""
            local v = redis.call('HGET', KEYS[1], ARGV[1])
            if not v then return 0 end
            local o = cjson.decode(v)
            for i = 4, #ARGV do
                if o.status == ARGV[i] then
                    o.status = ARGV[2]
                    o.lastSeen = tonumber(ARGV[3])
                    redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(o))
                    return 1
                end
            end
            return 0
            """);

    /** Heartbeat: refresh last_seen, only while CONNECTED. ARGV: roll, nowMs. */
    private static final DefaultRedisScript<Long> TOUCH_STUDENT = script("""
            local v = redis.call('HGET', KEYS[1], ARGV[1])
            if not v then return 0 end
            local o = cjson.decode(v)
            if o.status ~= 'CONNECTED' then return 0 end
            o.lastSeen = tonumber(ARGV[2])
            redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(o))
            return 1
            """);

    private static DefaultRedisScript<Long> script(String lua) {
        DefaultRedisScript<Long> s = new DefaultRedisScript<>();
        s.setScriptText(lua);
        s.setResultType(Long.class);
        return s;
    }

    // ---------- keys ----------

    public static String infoKey(String code)      { return "assessment:" + code + ":info"; }
    public static String questionsKey(String code) { return "assessment:" + code + ":questions"; }
    public static String studentsKey(String code)  { return "assessment:" + code + ":students"; }
    public static String answersKey(String code, String roll) { return "assessment:" + code + ":answers:" + roll; }
    public static String eventsKey(String code)    { return "assessment:" + code + ":events"; }

    // ---------- code registry / hosts ----------

    public boolean claimCode(String code) {
        Long r = redis.execute(CLAIM_CODE, List.of(infoKey(code), CODES_SET), code);
        return r != null && r == 1;
    }

    public void releaseCodeClaim(String code) {
        redis.opsForSet().remove(CODES_SET, code);
        redis.delete(infoKey(code));
    }

    public Set<String> allCodes() { return redis.opsForSet().members(CODES_SET); }

    public void setHost(String email, String code) { redis.opsForHash().put(HOSTS_HASH, email, code); }
    public String getHostCode(String email) { return (String) redis.opsForHash().get(HOSTS_HASH, email); }

    // ---------- info ----------

    public void writeInfo(String code, Map<String, String> fields) {
        redis.opsForHash().putAll(infoKey(code), fields);
    }

    /** Null when the keys are gone. */
    @SuppressWarnings("unchecked")
    public Map<String, String> getInfo(String code) {
        Map<Object, Object> raw = redis.opsForHash().entries(infoKey(code));
        if (raw.isEmpty()) return null;
        return (Map<String, String>) (Map<?, ?>) raw;
    }

    public void updateInfo(String code, Map<String, String> fields) { writeInfo(code, fields); }

    public boolean startGuard(String code) {
        Long r = redis.execute(START_GUARD, List.of(infoKey(code)));
        return r != null && r == 1;
    }

    /** Returns the previous status ("LIVE"/"SCHEDULED") or null when not eligible. */
    public String beginFlushGuard(String code) {
        Long r = redis.execute(BEGIN_FLUSH, List.of(infoKey(code)));
        if (r == null || r == 0) return null;
        return r == 2 ? "LIVE" : "SCHEDULED";
    }

    public boolean markFailedGuard(String code) {
        Long r = redis.execute(FAIL_GUARD, List.of(infoKey(code)));
        return r != null && r == 1;
    }

    public boolean existsInfo(String code) { return Boolean.TRUE.equals(redis.hasKey(infoKey(code))); }

    // ---------- questions / answers ----------

    public void setQuestions(String code, String json) { redis.opsForValue().set(questionsKey(code), json); }
    public String getQuestions(String code) { return redis.opsForValue().get(questionsKey(code)); }

    public void setAnswer(String code, String roll, String questionId, String answerJson) {
        redis.opsForHash().put(answersKey(code, roll), questionId, answerJson);
    }

    public Map<String, String> getAnswers(String code, String roll) {
        Map<Object, Object> raw = redis.opsForHash().entries(answersKey(code, roll));
        Map<String, String> out = new LinkedHashMap<>();
        raw.forEach((k, v) -> out.put(String.valueOf(k), String.valueOf(v)));
        return out;
    }

    // ---------- students ----------

    public int admitStudent(String code, String roll, int maxStudents, StudentDto entry) {
        Long r = redis.execute(ADMIT_STUDENT, List.of(studentsKey(code)),
                roll, String.valueOf(maxStudents), toJson(entry));
        if (r == null) return -1;
        return r.intValue();
    }

    public StudentDto getStudent(String code, String roll) {
        String raw = (String) redis.opsForHash().get(studentsKey(code), roll);
        return raw == null ? null : fromJson(raw);
    }

    public Map<String, StudentDto> getStudents(String code) {
        Map<Object, Object> raw = redis.opsForHash().entries(studentsKey(code));
        Map<String, StudentDto> out = new LinkedHashMap<>();
        raw.forEach((k, v) -> out.put(String.valueOf(k), fromJson(String.valueOf(v))));
        return out;
    }

    /** Guarded transition; returns true when the guard passed. */
    public boolean transitionStudent(String code, String roll, StudentDto from,
                                     String newStatus, String... allowedFrom) {
        String[] args = new String[allowedFrom.length + 3];
        args[0] = roll;
        args[1] = newStatus;
        args[2] = String.valueOf(System.currentTimeMillis());
        System.arraycopy(allowedFrom, 0, args, 3, allowedFrom.length);
        Long r = redis.execute(TRANSITION_STUDENT, List.of(studentsKey(code)), (Object[]) args);
        return r != null && r == 1;
    }

    public void refreshAfterRejoin(String code, String roll, StudentDto updated) {
        redis.opsForHash().put(studentsKey(code), roll, toJson(updated));
    }

    public boolean touchStudent(String code, String roll) {
        Long r = redis.execute(TOUCH_STUDENT, List.of(studentsKey(code)),
                roll, String.valueOf(System.currentTimeMillis()));
        return r != null && r == 1;
    }

    // ---------- events ----------

    public void pushEvent(String code, String type, String message, String roll) {
        EventLogDto e = new EventLogDto(System.currentTimeMillis(), type, message, roll);
        redis.opsForList().leftPush(eventsKey(code), toJson(e));
        redis.opsForList().trim(eventsKey(code), 0, Constants.EVENT_LOG_CAP - 1);
    }

    /** Chronological (oldest first) — used for teacher snapshot replay. */
    public List<EventLogDto> getEvents(String code) {
        List<String> raw = redis.opsForList().range(eventsKey(code), 0, Constants.EVENT_LOG_CAP - 1);
        if (raw == null) return List.of();
        List<EventLogDto> out = new ArrayList<>(raw.size());
        for (String s : raw) out.add(fromJson(s, EventLogDto.class));
        Collections.reverse(out);
        return out;
    }

    // ---------- cleanup (always last) ----------

    public void purgeAssessment(String code, String hostEmail, Collection<String> rolls) {
        List<String> keys = new ArrayList<>(List.of(infoKey(code), questionsKey(code), studentsKey(code), eventsKey(code)));
        for (String roll : rolls) keys.add(answersKey(code, roll));
        redis.delete(keys);
        redis.opsForSet().remove(CODES_SET, code);
        redis.opsForHash().delete(HOSTS_HASH, hostEmail);
    }

    // ---------- json helpers ----------

    private String toJson(Object o) {
        try { return mapper.writeValueAsString(o); }
        catch (JacksonException e) { throw new IllegalStateException("Redis JSON serialization failed", e); }
    }

    private <T> T fromJson(String json, Class<T> type) {
        try { return mapper.readValue(json, type); }
        catch (JacksonException e) { throw new IllegalStateException("Corrupt Redis JSON", e); }
    }

    private StudentDto fromJson(String json) { return fromJson(json, StudentDto.class); }
}

