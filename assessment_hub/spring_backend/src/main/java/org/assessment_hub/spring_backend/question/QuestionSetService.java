package org.assessment_hub.spring_backend.question;

import java.util.regex.Pattern;

import org.assessment_hub.spring_backend.auth.guard.WriteGuard;
import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.profile.ActivityService;
import org.assessment_hub.spring_backend.profile.ProfileService;
import org.assessment_hub.spring_backend.profile.UserEntity;
import org.assessment_hub.spring_backend.question.dtos.PagedQuestionSetsDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetCreateDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetDeleteDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetUpdateDto;

import org.springframework.cglib.core.internal.Function;
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
public class QuestionSetService {
    
    /** Deterministic keys: questionSets/{id}.json and answers/{id}.json (id == question_set_id). */
    private static final Pattern JSON_KEY = Pattern.compile("^(questionSets|answers)/\\d+\\.json$");

    private final QuestionSetRepo sets;

    private final SeaweedStorageService storage;
    private final ActivityService activity;
    private final ProfileService profile;

    private final WriteGuard writeGuard;
    private final ObjectMapper objectMapper;

    // ---------- list ----------
    @Transactional(readOnly = true)
    public PagedQuestionSetsDto list(int page, int size) {
        UserEntity user = profile.getCurrentUser();
        Page<QuestionSetEntity> result = sets.findByUser(user, PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt")));

        return new PagedQuestionSetsDto(
                result.getTotalElements(),
                result.getContent().stream().map(QuestionSetDto::from).toList());
    }

    // ---------- create ----------
    @Transactional
    public QuestionSetDto create(QuestionSetCreateDto dto) {
        writeGuard.requireWriteAccess();
        UserEntity user = profile.getCurrentUser();

        // Save first: the storage key IS the generated id, so the row must be inserted
        // before anything can be uploaded.
        QuestionSetEntity set = sets.save(QuestionSetEntity.builder()
                .user(user)
                .title(dto.title().trim())
                .description(dto.description())
                .build());

        try {
            set.setQuestionJson(storeJson(set.getQuestionSetId(), dto.questionsJson(), "questionsJson"));
            set.setAnswerJson(storeJson(set.getQuestionSetId(), dto.answersJson(), "answersJson"));
        } catch (RuntimeException e) {
            // If the second upload failed after the first succeeded, clean up: the rolled-back
            // row consumed its id, so nothing would ever overwrite/reclaim those objects.
            safeDelete("questionSets/" + set.getQuestionSetId() + ".json");
            safeDelete("answers/" + set.getQuestionSetId() + ".json");
            throw e;
        }

        activity.addLog(user, "Question set created", "Title: " + set.getTitle());
        return QuestionSetDto.from(set);
    }

    // ---------- update (partial — only non-null fields are applied) ----------
    @Transactional
    public QuestionSetDto update(QuestionSetUpdateDto dto) {
        writeGuard.requireWriteAccess();
        UserEntity user = profile.getCurrentUser();
        QuestionSetEntity set = findOwned(dto.questionSetId(), user);

        if (dto.title() != null) set.setTitle(dto.title().trim());
        if (dto.description() != null) set.setDescription(dto.description());
        if (dto.questionsJson() != null)
            set.setQuestionJson(storeJson(set.getQuestionSetId(), dto.questionsJson(), "questionsJson"));
        if (dto.answersJson() != null)
            set.setAnswerJson(storeJson(set.getQuestionSetId(), dto.answersJson(), "answersJson"));

        sets.save(set);

        activity.addLog(user, "Question set updated", "Title: " + set.getTitle());
        return QuestionSetDto.from(set);
    }

    // ---------- delete ----------
    @Transactional
    public void delete(QuestionSetDeleteDto dto) {
        writeGuard.requireWriteAccess();
        if (!"Delete".equals(dto.confirm()))
            throw new IllegalArgumentException("Confirmation must be the exact keyword \"Delete\".");

        UserEntity user = profile.getCurrentUser();
        QuestionSetEntity set = findOwned(dto.questionSetId(), user);

        sets.delete(set);
        sets.flush(); // fail fast here (FK violations etc.) before touching storage

        safeDelete(set.getQuestionJson());
        safeDelete(set.getAnswerJson());

        activity.addLog(user, "Question set deleted", "Title: " + set.getTitle());
    }

    // ---------- JSON ------------
    @Transactional(readOnly = true)
    public QuestionSetDto getOne(long id) {
        return QuestionSetDto.from(findOwned(id, profile.getCurrentUser()));
    }

    @Transactional(readOnly = true)
    public SeaweedStorageService.DownloadedObject getQuestionsJson(long questionSetId) {
        return getJson(questionSetId, QuestionSetEntity::getQuestionJson);
    }

    @Transactional(readOnly = true)
    public SeaweedStorageService.DownloadedObject getAnswersJson(long questionSetId) {
        return getJson(questionSetId, QuestionSetEntity::getAnswerJson);
    }

    // ---------- helpers ----------

    private SeaweedStorageService.DownloadedObject getJson(long id, Function<QuestionSetEntity, String> keyGetter) {
        QuestionSetEntity set = findOwned(id, profile.getCurrentUser());
        String key = keyGetter.apply(set);
        if (key == null || !JSON_KEY.matcher(key).matches())   // defense against tampered/legacy keys
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No stored JSON for this question set.");
        return storage.download(key);
    }

    /** One query, no lazy user proxy round-trip. */
    private QuestionSetEntity findOwned(Long id, UserEntity user) {
        return sets.findByQuestionSetIdAndUser_Email(id, user.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question set not found."));
    }

    /** Validates and uploads JSON to the set's deterministic key. Absent/blank input is rejected. */
    private String storeJson(long questionSetId, String json, String field) {
        if (json == null || json.isBlank())
            throw new IllegalArgumentException(field + " is required.");
        try {
            objectMapper.readTree(json); // must parse as JSON
        } catch (JacksonException e) {
            throw new IllegalArgumentException(field + " must contain valid JSON.");
        }
        return "questionsJson".equals(field)
                ? storage.uploadQuestionsJson(questionSetId, json)
                : storage.uploadAnswersJson(questionSetId, json);
    }

    /** Storage cleanup that never fails the request (DB is the source of truth). */
    private void safeDelete(String key) {
        if (key == null || key.isBlank()) return;
        try {
            storage.delete(key);
        } catch (NoSuchKeyException ignored) {
        } catch (SdkException ex) {
            log.warn("Could not delete stale object {} from storage", key, ex);
        }
    }
}
