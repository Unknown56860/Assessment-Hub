package org.assessment_hub.spring_backend.core.websocket;

import java.util.Map;

import org.springframework.core.MethodParameter;
import org.springframework.messaging.Message;
import org.springframework.messaging.handler.invocation.HandlerMethodArgumentResolver;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;

/**
 * Populates the WebSocketIdentity parameter of @MessageMapping methods from the
 * handshake attributes stashed by WebSocketHandshakeInterceptor. Without it the
 * parameter resolves as null (or as a garbage payload conversion) and every
 * student command silently no-ops.
 */
public class WebSocketIdentityArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return WebSocketIdentity.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, Message<?> message) {
        Map<String, Object> attrs = SimpMessageHeaderAccessor.getSessionAttributes(message.getHeaders());
        if (attrs == null) return null;
        Object id = attrs.get("wsIdentity");
        return id instanceof WebSocketIdentity w ? w : null;
    }
}

