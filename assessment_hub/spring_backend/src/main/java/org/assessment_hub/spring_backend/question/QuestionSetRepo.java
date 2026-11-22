package org.assessment_hub.spring_backend.question;

import org.springframework.stereotype.Repository;

import io.lettuce.core.dynamic.annotation.Param;

import org.assessment_hub.spring_backend.profile.UserEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

@Repository
public interface QuestionSetRepo extends JpaRepository<QuestionSetEntity, Long> {

    Page<QuestionSetEntity> findByUser(UserEntity user, Pageable pageable);

    boolean existsByQuestionSetIdAndUser_Email(Long questionSetId, String email);
    
    Optional<QuestionSetEntity> findByQuestionSetIdAndUser_Email(Long questionSetId, String email);

    /** Projection for the sweeper — pulls only the storage key of the question JSON. */
    @Query ("select q.questionJson from QuestionSetEntity q where q.questionSetId = :id")
    Optional<String> findQuestionJsonById(@Param ("id") Long id);
}
