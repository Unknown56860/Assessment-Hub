package org.assessment_hub.spring_backend.general;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

//  visitor_message
// 	 - message_id
// 	 - name
// 	 - email
// 	 - subject
// 	 - message
// 	 - created_at
// 	 - status

@Entity @Table (name = "visitor_messages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder 
public class MessageEntity {

    @Id 
    @GeneratedValue (strategy = GenerationType.IDENTITY)
    @Column (name = "message_id")
    private Long messageId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(length = 500)
    private String subject;

    @Column(length = 5000)
    private String message;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private MessageStatus status = MessageStatus.UNREAD;

    @PrePersist 
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
