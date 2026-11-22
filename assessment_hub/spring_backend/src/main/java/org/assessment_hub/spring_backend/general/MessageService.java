package org.assessment_hub.spring_backend.general;

import org.assessment_hub.spring_backend.admin.dtos.AdminMessageDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminMessagePageDto;

import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service 
public class MessageService {
    private final MessageRepo messageRepo;

    public MessageService(MessageRepo messageRepo) {
        this.messageRepo = messageRepo;
    }

    @Transactional 
    public void saveMessage(MessageDto request) {
        MessageEntity visitorMessage = new MessageEntity();
        visitorMessage.setName(request.name());
        visitorMessage.setEmail(request.email());
        visitorMessage.setSubject(request.subject());
        visitorMessage.setMessage(request.message());
        messageRepo.save(visitorMessage);
    }

    @Transactional(readOnly = true)
    public AdminMessagePageDto getMessages(int page, int size) {
        Page<MessageEntity> result = messageRepo.findAll(PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 250),
                Sort.by(Sort.Direction.DESC, "createdAt", "messageId")));

        return new AdminMessagePageDto(
                messageRepo.countByStatus(MessageStatus.READ),
                messageRepo.countByStatus(MessageStatus.UNREAD),
                messageRepo.countByStatus(MessageStatus.ANSWERED),
                result.getContent().stream().map(AdminMessageDto::from).toList());
    }

    @Transactional
    public void updateStatus(Long id, MessageStatus status) {
        MessageEntity message = messageRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message #" + id + " does not exist."));
        message.setStatus(status);
        messageRepo.save(message);
    }

    @Transactional
    public void deleteMessage(Long id) {
        if (!messageRepo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message #" + id + " does not exist.");
        messageRepo.deleteById(id);
    }
}
