package org.assessment_hub.spring_backend.evaluation;

import org.assessment_hub.spring_backend.auth.guard.WriteGuard;
import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.evaluation.dtos.EvaluationUpdateDto;
import org.assessment_hub.spring_backend.evaluation.dtos.PagedAssessmentsDto;
import org.assessment_hub.spring_backend.profile.ActivityService;
import org.assessment_hub.spring_backend.profile.ProfileService;
import org.assessment_hub.spring_backend.profile.UserEntity;
import org.assessment_hub.spring_backend.evaluation.dtos.AssessmentDeleteDto;
import org.assessment_hub.spring_backend.evaluation.dtos.AssessmentDto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Function;
import java.util.regex.Pattern;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationService {

    /** Deterministic keys: submissions/{assessmentId}.json and evaluations/{assessmentId}.json. */
    private static final Pattern JSON_KEY = Pattern.compile("^(submissions|evaluations)/\\d+\\.json$");


    /** Only completed/evaluated assessments are ever visible to the teacher. */
    private static final List<AssessmentStatus> EVALUATABLE = List.of(AssessmentStatus.ENDED, AssessmentStatus.EVALUATED);

    private final AssessmentRepo submissions;

    private final SeaweedStorageService storage;
    private final ActivityService activity;
    private final ProfileService profile;

    private final WriteGuard writeGuard;
    private final ObjectMapper objectMapper;

    // ---------- list ----------
    @Transactional(readOnly = true)
    public PagedAssessmentsDto list(int page, int size) {
        UserEntity user = profile.getCurrentUser();
        Page<AssessmentEntity> result = submissions.findByQuestionSet_User_EmailAndStatusIn(
                user.getEmail(), EVALUATABLE, PageRequest.of(
                        Math.max(page, 0),
                        Math.min(Math.max(size, 1), 100),          // hard cap page size
                        Sort.by(Sort.Direction.DESC, "conductedAt"))); // newest first

        return new PagedAssessmentsDto(
                result.getTotalElements(),
                result.getContent().stream().map(AssessmentDto::from).toList());
    }

    // ---------- get ----------
    @Transactional(readOnly = true)
    public AssessmentDto getOne(long id) {
        return AssessmentDto.from(findOwned(id, profile.getCurrentUser()));
    }

    @Transactional(readOnly = true)
    public SeaweedStorageService.DownloadedObject getSubmissionJson(long id) {
        return getJson(id, AssessmentEntity::getAssessmentJson);
    }

    @Transactional(readOnly = true)
    public SeaweedStorageService.DownloadedObject getEvaluationJson(long id) {
        return getJson(id, AssessmentEntity::getEvaluationJson);
    }

    // ---------- update evaluation ----------
    @Transactional
    public AssessmentDto updateEvaluation(EvaluationUpdateDto dto) {
        writeGuard.requireWriteAccess();
        UserEntity user = profile.getCurrentUser();
        AssessmentEntity submission = findOwned(dto.assessmentId(), user);

        // Deterministic key: re-upload overwrites evaluations/{id}.json in place —
        // no old key to retire, and retries are idempotent.
        submission.setEvaluationJson(storeJson(dto.assessmentId(), dto.evaluationJson()));
        submission.setEvaluatedAt(LocalDateTime.now());
        submission.setStatus(AssessmentStatus.EVALUATED);
        submissions.save(submission);

        activity.addLog(user, "Submission evaluated", "Title: " + submission.getAssessmentTitle());
        return AssessmentDto.from(submission);
    }

    // ---------- delete ----------
    @Transactional 
    public void delete(AssessmentDeleteDto dto) {
        writeGuard.requireWriteAccess();
        if (!"Delete".equals(dto.confirm()))
            throw new IllegalArgumentException("Confirmation must be the exact keyword \"Delete\".");

        UserEntity user = profile.getCurrentUser();
        AssessmentEntity submission = findOwned(dto.assessmentId(), user);

        String assessmentKey = submission.getAssessmentJson();
        String evaluationKey = submission.getEvaluationJson();

        submissions.delete(submission);
        submissions.flush(); // fail fast before touching storage; the @OnDelete FK on AssessmentEntity removes the schedule row

        safeDelete(assessmentKey);
        safeDelete(evaluationKey);

        activity.addLog(user, "Submission deleted", "Id: " + dto.assessmentId());
    }

    // ---------- helpers ----------

    private SeaweedStorageService.DownloadedObject getJson(long id, Function<AssessmentEntity, String> keyGetter) {
        AssessmentEntity submission = findOwned(id, profile.getCurrentUser());
        String key = keyGetter.apply(submission);
        if (key == null || !JSON_KEY.matcher(key).matches())   // defense against tampered/legacy keys
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No stored JSON for this submission.");
        return storage.download(key); // NoSuchKeyException / SdkException handled by ApiExceptionHandler
    }

    private String storeJson(long assessmentId, String json) {
        if (json == null || json.isBlank())
            throw new IllegalArgumentException("Evaluation JSON is required.");
        try {
            objectMapper.readTree(json);
        } catch (JacksonException e) {
            throw new IllegalArgumentException("Evaluation JSON must contain valid JSON.");
        }
        return storage.uploadEvaluationJson(assessmentId, json);
    }

    private void safeDelete(String key) {
        if (key == null || key.isBlank()) return;
        try {
            storage.delete(key);
        } catch (NoSuchKeyException ignored) {
        } catch (SdkException ex) {
            log.warn("Could not delete stale object {} from storage", key, ex);
        }
    }
    
    private AssessmentEntity findOwned(Long id, UserEntity user) {
        return submissions.findByAssessmentIdAndQuestionSet_User_EmailAndStatusIn(
                        id, user.getEmail(), EVALUATABLE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found."));
    }
}
