package org.assessment_hub.spring_backend.core.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties ("storage")
public record StorageProperties(String endpoint, String region, String bucket, String accessKey, String secretKey) {}

