package org.assessment_hub.spring_backend.core.websocket;

import java.util.Map;
import java.util.regex.Pattern;

import org.assessment_hub.spring_backend.assessment.StudentStatus;
import org.assessment_hub.spring_backend.assessment.dtos.StudentDto;
import org.assessment_hub.spring_backend.auth.JwtService;
import org.assessment_hub.spring_backend.core.redis.RedisService;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    /** Static SockJS base — /ws plus any SockJS sub-path (/info, /{server}/{session}/{transport}, /websocket). */
    private static final Pattern PATH = Pattern.compile("^/ws(?:/.*)?$");
    private static final Pattern CODE = Pattern.compile("[a-z]{6}");

    private final JwtService jwt;
    private final RedisService redis;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String path = request.getURI().getPath();
        if (!PATH.matcher(path).matches()) return reject(response);

        // SockJS owns the path structure, so kind/code travel as query params —
        // sockjs-client preserves them on every transport request.
        String kind = queryParam(request, "kind");   // "live" = teacher, "assessment" = student
        String code = queryParam(request, "code");
        if (code == null || !CODE.matcher(code).matches()) return reject(response);
        if (!"live".equals(kind) && !"assessment".equals(kind)) return reject(response);

        Claims claims = jwt.parse(queryParam(request, "token"));
        if (claims == null) return reject(response);

        String role = claims.get("role", String.class);
        if (!code.equals(claims.get("code", String.class))) return reject(response);

        if ("live".equals(kind) && JwtService.ROLE_HOST.equals(role)) {
            if (!code.equals(redis.getHostCode(claims.getSubject()))) return reject(response);
            attributes.put("wsIdentity", new WebSocketIdentity(role, code, null, claims.getSubject()));
            return true;
        }

        if ("assessment".equals(kind) && JwtService.ROLE_STUDENT.equals(role)) {
            StudentDto entry = redis.getStudent(code, claims.getSubject());
            if (entry == null) return reject(response);
            if (entry.tokenIat() != (claims.getIssuedAt().getTime() / 1000)) return reject(response);
            if (StudentStatus.SUBMITTED.equals(entry.status()) || StudentStatus.KICKED.equals(entry.status()))
                return reject(response);
            attributes.put("wsIdentity", new WebSocketIdentity(role, code, claims.getSubject(), null));
            return true;
        }
        return reject(response);
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {}

    private String queryParam(ServerHttpRequest request, String name) {
        return UriComponentsBuilder.fromUri(request.getURI()).build()
                .getQueryParams().getFirst(name);
    }

    private boolean reject(ServerHttpResponse response) {
        response.setStatusCode(HttpStatus.FORBIDDEN);
        return false;
    }
}
