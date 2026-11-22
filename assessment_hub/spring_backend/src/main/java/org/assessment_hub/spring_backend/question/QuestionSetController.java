package org.assessment_hub.spring_backend.question;

import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.question.dtos.PagedQuestionSetsDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetCreateDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetDeleteDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetDto;
import org.assessment_hub.spring_backend.question.dtos.QuestionSetUpdateDto;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

//  - /question-set/all?page=0&size=10    (GET), list of all the question set

//  - /question-set                    (POST), create a new question set
//  - /question-set                    (PUT), update and existing question set
//  - /question-set                    (DELETE), Delete an existing question set

//  - /question-set/{id}/              (GET), Individual Question set metadata
//  - /question-set/{id}/questions     (GET), Question set json file
//  - /question-set/{id}/answers       (GET), Answers json file

@RestController
@RequestMapping("/question-set")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class QuestionSetController {

    private final QuestionSetService service;

    @GetMapping("/all")
    public PagedQuestionSetsDto list(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "10") int size) {
        return service.list(page, size);
    }

    @PostMapping
    @PreAuthorize("hasRole('TEACHER') and @writeGuard.canWrite()")
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionSetDto create(@Valid @RequestBody QuestionSetCreateDto dto) {
        return service.create(dto);
    }

    @PutMapping
    @PreAuthorize("hasRole('TEACHER') and @writeGuard.canWrite()")
    public QuestionSetDto update(@Valid @RequestBody QuestionSetUpdateDto dto) {
        return service.update(dto);
    }

    @DeleteMapping
    @PreAuthorize("hasRole('TEACHER') and @writeGuard.canWrite()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@Valid @RequestBody QuestionSetDeleteDto dto) {
        service.delete(dto);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('TEACHER') and @questionSetGuard.canAccess(#id)")
    public QuestionSetDto get(@PathVariable long id) {
        return service.getOne(id);
    }

    @GetMapping("/{id}/questions")
    @PreAuthorize("hasRole('TEACHER') and @questionSetGuard.canAccessJson(#id)")
    public ResponseEntity<byte[]> questions(@PathVariable long id) {
        return json(service.getQuestionsJson(id));
    }

    @GetMapping("/{id}/answers")
    @PreAuthorize("hasRole('TEACHER') and @questionSetGuard.canAccessJson(#id)")
    public ResponseEntity<byte[]> answers(@PathVariable long id) {
        return json(service.getAnswersJson(id));
    }

    private ResponseEntity<byte[]> json(SeaweedStorageService.DownloadedObject obj) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore()) // same URL serves changing content; keys in DB rotate instead
                .body(obj.content());
    }
}
