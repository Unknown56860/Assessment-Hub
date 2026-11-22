package org.assessment_hub.spring_backend.evaluation;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface AssessmentRepo extends JpaRepository<AssessmentEntity, Long> {

    Page<AssessmentEntity> findByQuestionSet_User_EmailAndStatusIn(
            String email, List<AssessmentStatus> statuses, Pageable pageable);

    Optional<AssessmentEntity> findByAssessmentIdAndStatusIn(Long id, List<AssessmentStatus> statuses);

    boolean existsByAssessmentIdAndQuestionSet_User_Email(Long id, String email);

    Optional<AssessmentEntity> findByAssessmentIdAndQuestionSet_User_EmailAndStatusIn(
        Long assessmentId, String email, List<AssessmentStatus> statuses);

    @Modifying
    @Transactional 
    @Query("update AssessmentEntity s set s.status = :status, s.conductedAt = :conductedAt where s.assessmentId = :id")
    int markLive(@Param("id") Long id, @Param("status") AssessmentStatus status, @Param("conductedAt") LocalDateTime conductedAt);

    /** Guarded by status <> ENDED so recovery retries can never regress a committed flush. */
    @Modifying
    @Transactional
    @Query("update AssessmentEntity s set s.status = :status, s.assessmentJson = :submissionJson " +
        "where s.assessmentId = :id and s.status <> :ended")
    int markEnded(@Param("id") Long id, @Param("status") AssessmentStatus status,
                @Param("submissionJson") String submissionJson, @Param("ended") AssessmentStatus ended);

    @Modifying
    @Transactional
    @Query("update AssessmentEntity s set s.status = :failed where s.assessmentId = :id and s.status <> :ended")
    int markFailed(@Param("id") Long id, @Param("failed") AssessmentStatus failed, @Param("ended") AssessmentStatus ended);

}
