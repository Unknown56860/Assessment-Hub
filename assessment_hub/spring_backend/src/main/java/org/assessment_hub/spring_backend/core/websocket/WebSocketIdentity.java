package org.assessment_hub.spring_backend.core.websocket;

import org.assessment_hub.spring_backend.auth.JwtService;

import org.springframework.web.socket.WebSocketSession;

/** Identity stashed in the session attributes by the handshake interceptor. */
public record WebSocketIdentity(String role, String code, String roll, String email) {
    public static WebSocketIdentity from(WebSocketSession session) {
        Object o = session.getAttributes().get("wsIdentity");
        return o instanceof WebSocketIdentity w ? w : null;
    }
    public String principalName() {
        return JwtService.ROLE_STUDENT.equals(role) ? "stu:" + code + ":" + roll : email;
    }
}
