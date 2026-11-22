package org.assessment_hub.spring_backend.profile;

import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

@Repository 
public interface ActivityLogRepo extends JpaRepository<ActivityLogEntity, Long> {
    Page<ActivityLogEntity> findByUser(UserEntity user, Pageable pageable);
}
