package org.assessment_hub.spring_backend.core.config;

import org.assessment_hub.spring_backend.core.storage.StorageProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration 
@EnableConfigurationProperties ({ StorageProperties.class, JwtProperties.class })
public class LivePropertiesConfig {}
