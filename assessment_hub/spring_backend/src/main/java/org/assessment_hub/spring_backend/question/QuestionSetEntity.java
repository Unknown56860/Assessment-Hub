package org.assessment_hub.spring_backend.question;

import java.time.LocalDateTime;

import org.assessment_hub.spring_backend.profile.UserEntity;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

//  question_sets
// 	 - question_set_id
// 	 - user_id
// 	 - title
// 	 - description
// 	 - questions_json
// 	 - answers_json
// 	 - total_conducted
// 	 - last_conducted_at
// 	 - created_at
// 	 - updated_at

@Entity @Table(name = "question_sets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder 
public class QuestionSetEntity {
    
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "question_set_id")
    private Long questionSetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private UserEntity user;

    @Column(nullable = false, length = 250)
    private String title;

    @Column(length = 2500)
    private String description;

    @Column(name = "question_json", length = 2048)
    private String questionJson;

    @Column(name = "answer_json", length = 2048)
    private String answerJson;

    @Builder.Default
    @Column(name = "total_conducted", nullable = false)
    private Integer totalConducted = 0;

    @Column(name = "last_conducted_at")
    private LocalDateTime lastConducted;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist 
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate 
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
