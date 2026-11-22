package org.assessment_hub.spring_backend.assessment;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class SessionRegistry {

    // code -> (roll -> current live session). A superseding session closes the old one.
    private final Map<String, Map<String, WebSocketSession>> students = new ConcurrentHashMap<>();
    // code -> teacher sessions (multiple tabs allowed)
    private final Map<String, Set<WebSocketSession>> teachers = new ConcurrentHashMap<>();

    private final BroadcastService broadcast;

    public SessionRegistry(BroadcastService broadcast) { this.broadcast = broadcast; }

    public void trackStudent(String code, String roll, WebSocketSession session) {
        WebSocketSession old = students
                .computeIfAbsent(code, c -> new ConcurrentHashMap<>())
                .put(roll, session);
        if (old != null && old.isOpen()) {
            log.warn("Superseding live socket for roll {} in {}", roll, code);
            broadcast.pushTeacherEvent(code, "CONFLICT",
                    "Duplicate session for roll " + roll + " — old session closed.", roll);
            closeQuietly(old, Constants.UNAUTHORIZED);
        }
    }

    public void untrackStudent(String code, String roll, WebSocketSession session) {
        Map<String, WebSocketSession> byRoll = students.get(code);
        if (byRoll != null && byRoll.remove(roll, session) && byRoll.isEmpty()) students.remove(code, byRoll);
    }

    public void closeStudent(String code, String roll, CloseStatus status) {
        Map<String, WebSocketSession> byRoll = students.get(code);
        if (byRoll == null) return;
        WebSocketSession s = byRoll.remove(roll);
        if (s != null) closeQuietly(s, status);
    }

    public void trackTeacher(String code, WebSocketSession session) {
        teachers.computeIfAbsent(code, c -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void untrackTeacher(String code, WebSocketSession session) {
        Set<WebSocketSession> set = teachers.get(code);
        if (set != null) { set.remove(session); if (set.isEmpty()) teachers.remove(code, set); }
    }

    public void closeTeachers(String code, CloseStatus status) {
        Set<WebSocketSession> set = teachers.remove(code);
        if (set != null) set.forEach(s -> closeQuietly(s, status));
    }

    private void closeQuietly(WebSocketSession s, CloseStatus status) {
        try { s.close(status); } catch (IOException ignored) {}
    }
}
