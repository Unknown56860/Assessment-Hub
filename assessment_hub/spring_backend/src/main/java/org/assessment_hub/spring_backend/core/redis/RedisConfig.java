package org.assessment_hub.spring_backend.core.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration 
public class RedisConfig {

    /** String-only template: every live-module value is a UTF-8 string (JSON or number). */
    @Bean 
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        StringRedisTemplate template = new StringRedisTemplate(factory);
        template.setEnableTransactionSupport(false);
        return template;
    }
}
