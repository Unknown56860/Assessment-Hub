package org.assessment_hub.spring_backend.core.websocket;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

@Component
public class WebSocketHandshakeHandler extends DefaultHandshakeHandler {
    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler,
                                      Map<String, Object> attributes) {
        WebSocketIdentity id = (WebSocketIdentity) attributes.get("wsIdentity");
        final String name = id != null ? id.principalName() : "anonymous";
        return () -> name;
    }
}

