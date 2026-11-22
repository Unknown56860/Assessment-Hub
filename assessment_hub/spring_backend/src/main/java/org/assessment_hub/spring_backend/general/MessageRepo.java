package org.assessment_hub.spring_backend.general;

import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;

@Repository 
public interface MessageRepo extends JpaRepository<MessageEntity, Long> {
    long countByStatus(MessageStatus status);
}
