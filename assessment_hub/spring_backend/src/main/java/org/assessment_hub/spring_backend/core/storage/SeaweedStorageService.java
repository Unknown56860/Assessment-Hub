package org.assessment_hub.spring_backend.core.storage;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

@Service
@RequiredArgsConstructor
public class SeaweedStorageService{

    private static final String PIC_FOLDER = "profilepics/";
    private static final String QUESTIONS_FOLDER = "questionSets/";
    private static final String ANSWERS_FOLDER = "answers/";
    private static final String SUBMISSIONS_FOLDER = "submissions/";
    private static final String EVALUATIONS_FOLDER = "evaluations/";

    private static final long MAX_PROFILE_PIC_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("image/png", "image/jpeg");
    
    private final S3Client s3;
    private final StorageProperties props;

    public record DownloadedObject(byte[] content, String contentType) {}

    /** Deterministic keys: re-uploads overwrite the same object, so recovery
     *  retries are idempotent and no orphan objects accumulate. */
    public String uploadQuestionsJson(long questionSetId, String json) { return putJson(QUESTIONS_FOLDER + questionSetId + ".json", json); }
    public String uploadAnswersJson(long questionSetId, String json)   { return putJson(ANSWERS_FOLDER + questionSetId + ".json", json); }
    public String uploadSubmissionJson(long assessmentId, String json) { return putJson(SUBMISSIONS_FOLDER + assessmentId + ".json", json); }
    public String uploadEvaluationJson(long assessmentId, String json) { return putJson(EVALUATIONS_FOLDER + assessmentId + ".json", json); }

    private String putJson(String key, String json) {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        s3.putObject(PutObjectRequest.builder()
                        .bucket(props.bucket()).key(key)
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .contentLength((long) bytes.length).build(),
                RequestBody.fromBytes(bytes));
        return key;
    }

    public String uploadProfilePic(MultipartFile file, String userEmail) {
        if (file.isEmpty()) throw new IllegalArgumentException("The profile picture file is empty.");
        if (file.getSize() > MAX_PROFILE_PIC_BYTES) throw new IllegalArgumentException("The image must be 5 MB or smaller.");
        String type = file.getContentType();
        if (type == null || !ALLOWED_TYPES.contains(type))
            throw new IllegalArgumentException("Only PNG or JPEG images are allowed.");

        String key = PIC_FOLDER + userEmail;
        try {
            s3.putObject(PutObjectRequest.builder()
                            .bucket(props.bucket()).key(key).contentType(type).contentLength(file.getSize()).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read the uploaded image.", e);
        }
        return key;
    }

    public DownloadedObject download(String key) {
        ResponseBytes<GetObjectResponse> bytes = s3.getObjectAsBytes(
                GetObjectRequest.builder().bucket(props.bucket()).key(key).build());
        String type = bytes.response().contentType() != null
                ? bytes.response().contentType()
                : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        return new DownloadedObject(bytes.asByteArray(), type);
    }

    public void delete(String key) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(props.bucket()).key(key).build());
    }
}
