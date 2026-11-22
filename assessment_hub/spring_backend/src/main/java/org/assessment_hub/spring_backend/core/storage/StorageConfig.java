package org.assessment_hub.spring_backend.core.storage;

import java.net.URI;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {

    @Bean
    public S3Client s3Client(StorageProperties props) {
        return S3Client.builder()
                .region(Region.of(props.region()))
                .endpointOverride(URI.create(props.endpoint()))
                .forcePathStyle(true) // SeaweedFS is path-style only
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(props.accessKey(), props.secretKey())))
                .build();
    }

    @Bean
    ApplicationRunner ensureBucketExists(S3Client s3, StorageProperties props) {
        return args -> {
            try {
                boolean exists = s3.listBuckets().buckets().stream()
                        .anyMatch(b -> props.bucket().equals(b.name()));
                if (!exists) {
                    s3.createBucket(CreateBucketRequest.builder().bucket(props.bucket()).build());
                }
            } catch (S3Exception e) {
                String msg = e.awsErrorDetails() != null ? e.awsErrorDetails().errorMessage() : e.getMessage();
                System.err.println("Could not verify bucket '" + props.bucket() + "': " + msg);
            }

        };
    }
}
