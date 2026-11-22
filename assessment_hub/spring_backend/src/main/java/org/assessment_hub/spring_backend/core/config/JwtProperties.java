package org.assessment_hub.spring_backend.core.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties ("app.jwt")
public record JwtProperties(String secret) {}
