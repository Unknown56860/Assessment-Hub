package org.assessment_hub.spring_backend.evaluation;

import org.assessment_hub.spring_backend.evaluation.dtos.AssessmentDto;
import org.assessment_hub.spring_backend.evaluation.dtos.EvaluationUpdateDto;
import org.assessment_hub.spring_backend.evaluation.dtos.PagedAssessmentsDto;
import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.evaluation.dtos.AssessmentDeleteDto;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

//  - /submission/all?page=0&size=10        (GET), list of all submissions/assessments
 
//  - /submission                      (PUT), Update the evaluation data for the submission
//  - /submission                      (DELETE), Delete the submission

//  - /submission/{id}                 (GET), Individual submission metadata
//  - /submission/{id}/submission      (GET), Submission json file
//  - /submission/{id}/evaluation      (GET), Evaluation json file 

@RestController
@RequestMapping("/submission")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor 
public class EvaluationController {

    private final EvaluationService service;

    @GetMapping("/all")
    public PagedAssessmentsDto list(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "10") int size) {
        return service.list(page, size);
    }

    @PutMapping
    @PreAuthorize("hasRole('TEACHER') and @writeGuard.canWrite()")
    public AssessmentDto update(@Valid @RequestBody EvaluationUpdateDto dto) {
        return service.updateEvaluation(dto);
    }

    @DeleteMapping
    @PreAuthorize("hasRole('TEACHER') and @writeGuard.canWrite()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@Valid @RequestBody AssessmentDeleteDto dto) {
        service.delete(dto);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('TEACHER') and @assessmentGuard.canAccess(#id)")
    public AssessmentDto get(@PathVariable long id) {
        return service.getOne(id);
    }

    @GetMapping("/{id}/submission")
    @PreAuthorize("hasRole('TEACHER') and @assessmentGuard.canAccess(#id)")
    public ResponseEntity<byte[]> submission(@PathVariable long id) {
        return json(service.getSubmissionJson(id));
    }

    @GetMapping("/{id}/evaluation")
    @PreAuthorize("hasRole('TEACHER') and @assessmentGuard.canAccess(#id)")
    public ResponseEntity<byte[]> evaluation(@PathVariable long id) {
        return json(service.getEvaluationJson(id));
    }

    private ResponseEntity<byte[]> json(SeaweedStorageService.DownloadedObject obj) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(obj.content());
    }
}
