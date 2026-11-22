package org.assessment_hub.spring_backend.general;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record MessageDto (
    @NotBlank(message = "Name must be provided") 
    String name,

    @NotBlank(message = "Email must be provided")
    @Email(message = "Invalid email format")
    String email,
    
    String subject,
    String message
) {}
