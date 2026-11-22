package org.assessment_hub.spring_backend.evaluation;

import org.assessment_hub.spring_backend.question.QuestionSetEntity;

import java.time.LocalDateTime;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

//  assessments
// 	 - assessment_id
// 	 - question_set_id
// 	 - assessment_title
// 	 - assessment_description
// 	 - submission_json
// 	 - evaluation_json
// 	 - conducted_at
// 	 - evaluated_at
//   - status

@Entity @Table(name = "assessments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder 
public class AssessmentEntity {

    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assessment_id")
    private Long assessmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_set_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private QuestionSetEntity questionSet;

    @Column(name = "assessment_title", nullable = false, length = 250)
    private String assessmentTitle;

    @Column(name = "assessment_description", length = 2500)
    private String assessmentDescription;

    @Column(name = "assessment_json",length = 2048)
    private String assessmentJson;

    @Column(name = "evaluation_json", length = 2048)
    private String evaluationJson;

    @Column(name = "conducted_at")
    private LocalDateTime conductedAt;

    @Column(name = "evaluated_at")
    private LocalDateTime evaluatedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private AssessmentStatus status;
}
