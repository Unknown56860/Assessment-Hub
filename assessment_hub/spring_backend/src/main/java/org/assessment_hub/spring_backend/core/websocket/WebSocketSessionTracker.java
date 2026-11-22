package org.assessment_hub.spring_backend.core.websocket;

import org.assessment_hub.spring_backend.assessment.BroadcastService;
import org.assessment_hub.spring_backend.assessment.SessionRegistry;
import org.assessment_hub.spring_backend.assessment.StudentStatus;
import org.assessment_hub.spring_backend.auth.JwtService;
import org.assessment_hub.spring_backend.core.redis.RedisService;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

public class WebSocketSessionTracker extends WebSocketHandlerDecorator {

    private final SessionRegistry registry;
    private final RedisService redis;
    private final BroadcastService broadcast;

    public WebSocketSessionTracker(WebSocketHandler delegate, SessionRegistry registry,
                            RedisService redis, BroadcastService broadcast) {
        super(delegate);
        this.registry = registry;
        this.redis = redis;
        this.broadcast = broadcast;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        WebSocketIdentity id = WebSocketIdentity.from(session);
        if (id != null) {
            if (JwtService.ROLE_STUDENT.equals(id.role())) registry.trackStudent(id.code(), id.roll(), session);
            else registry.trackTeacher(id.code(), session);
        }
        super.afterConnectionEstablished(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        WebSocketIdentity id = WebSocketIdentity.from(session);
        if (id != null) {
            if (JwtService.ROLE_STUDENT.equals(id.role())) {
                registry.untrackStudent(id.code(), id.roll(), session);
                // Guarded: no-op if already KICKED/SUBMITTED/TIME_OVER (e.g. our own close)
                boolean changed = redis.transitionStudent(id.code(), id.roll(), null,
                        StudentStatus.DISCONNECTED, StudentStatus.CONNECTED);
                if (changed) {
                    redis.pushEvent(id.code(), "DISCONNECTED",
                            "Lost connection — " + id.roll(), id.roll());
                    broadcast.pushStudentList(id.code());
                }
            } else {
                registry.untrackTeacher(id.code(), session);
            }
        }
        super.afterConnectionClosed(session, closeStatus);
    }
}
