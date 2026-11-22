package org.assessment_hub.spring_backend.profile;

import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;

@Repository 
public interface UserRepo extends JpaRepository<UserEntity, Long> {
    
    boolean existsByEmail(String email);

    long countByStatus(ProfileStatus status);
    
    Optional<UserEntity> findByEmail(String email);
}

