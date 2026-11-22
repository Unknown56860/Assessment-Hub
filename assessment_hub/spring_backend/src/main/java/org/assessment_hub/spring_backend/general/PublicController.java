package org.assessment_hub.spring_backend.general;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

//  - /            (GET), return a hello message
//  - /message     (POST), get the message from visitor

@RestController
@RequiredArgsConstructor 
public class PublicController {

    private final MessageService messageService;
    
    @GetMapping("/")
    public String greeting() {
        return "Hello from spring backend :)";
    }

    @PostMapping("/message")
    public ResponseEntity<Void> receiveMessage (@Valid @RequestBody MessageDto visitorMessage) {

        messageService.saveMessage(visitorMessage);

        return ResponseEntity.ok().build();
    }

}

