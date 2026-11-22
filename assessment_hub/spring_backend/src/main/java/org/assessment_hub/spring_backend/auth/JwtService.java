package org.assessment_hub.spring_backend.auth;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.assessment_hub.spring_backend.core.config.JwtProperties;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service 
public class JwtService {

    public static final String ROLE_HOST = "host";
    public static final String ROLE_STUDENT = "student";
    private static final long TTL_MS = 7 * 24 * 60 * 60 * 1000L; // 24h

    private final SecretKey key;

    public JwtService(JwtProperties props) {
        String secret = props.secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 characters.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** Host token. iat = now. */
    public String mintHostToken(String email, String code) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(email)
                .claim("role", ROLE_HOST)
                .claim("code", code)
                .issuedAt(new Date(now))
                .expiration(new Date(now + TTL_MS))
                .signWith(key)
                .compact();
    }

    /** Student token. issuedAt is pinned to `iatSeconds` so the students-hash
     *  token_iat check can invalidate superseded tokens. */
    public String mintStudentToken(String code, String roll, long iatSeconds) {
        long iatMs = iatSeconds * 1000;
        return Jwts.builder()
                .subject(roll)
                .claim("role", ROLE_STUDENT)
                .claim("code", code)
                .issuedAt(new Date(iatMs))
                .expiration(new Date(iatMs + TTL_MS))
                .signWith(key)
                .compact();
    }

    /** Returns claims or null (never throws). Verify role/code with the callers. */
    public Claims parse(String token) {
        if (token == null || token.isBlank()) return null;
        try {
            return Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
