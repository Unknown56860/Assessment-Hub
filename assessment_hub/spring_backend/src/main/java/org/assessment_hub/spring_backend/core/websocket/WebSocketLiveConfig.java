package org.assessment_hub.spring_backend.core.websocket;

import java.util.List;

import org.assessment_hub.spring_backend.assessment.BroadcastService;
import org.assessment_hub.spring_backend.assessment.SessionRegistry;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.handler.invocation.HandlerMethodArgumentResolver;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.server.HandshakeHandler;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketLiveConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketHandshakeInterceptor handshakeInterceptor;
    private final HandshakeHandler handshakeHandler;
    private final SessionRegistry registry;
    private final RedisService redis;
    private final BroadcastService broadcast;

    @Value ("${app.cors.allowed-origin}")
    private String allowedOrigin;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .addInterceptors(handshakeInterceptor)
                .setHandshakeHandler(handshakeHandler)
                // SockJS fallback: institutional firewalls often strip raw websockets
                .setAllowedOrigins(allowedOrigin)
                .withSockJS();
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        // Capture raw sessions so the server can force-close individual sockets
        registry.addDecoratorFactory(h -> new WebSocketSessionTracker(h, this.registry, this.redis, this.broadcast));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();

        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[] {10_000, 10_000})
                .setTaskScheduler(scheduler);
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> argumentResolvers) {
        argumentResolvers.add(new WebSocketIdentityArgumentResolver());
    }

}
