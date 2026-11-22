package org.assessment_hub.spring_backend.admin;

import org.assessment_hub.spring_backend.admin.dtos.AdminDashboardDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminMessageActionDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminMessagePageDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminUserActionDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminUserPageDto;
import org.assessment_hub.spring_backend.general.MessageService;
import org.assessment_hub.spring_backend.profile.ActivityService;
import org.assessment_hub.spring_backend.profile.ProfileService;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

@Service 
@RequiredArgsConstructor 
public class AdminService {

    private final MessageService messageService;
    private final ProfileService profileService;
    private final ActivityService activity;

    @Transactional(readOnly = true)
    public AdminMessagePageDto getMessages(int page, int size) {
        return messageService.getMessages(page, size);
    }

    @Transactional
    public void handleMessageAction(AdminMessageActionDto dto) {
        switch (dto.action()) {
            case UPDATE_STATUS -> {
                if (dto.status() == null)
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required when updating a message.");
                messageService.updateStatus(dto.id(), dto.status());
                activity.addLog("Message status updated",
                        String.format("Message #%d marked as %s", dto.id(), dto.status()));
            }
            case DELETE -> {
                messageService.deleteMessage(dto.id());
                activity.addLog("Message deleted", "Visitor's message deleted #" + dto.id());
            }
        }
    }

    @Transactional(readOnly = true)
    public AdminUserPageDto getUsers(int page, int size) {
        return profileService.getAllUsers(page, size);
    }

    @Transactional
    public void handleUserAction(AdminUserActionDto dto) {
        profileService.updateStatusByEmail(dto.email(), dto.status());
        activity.addLog("User profile status updated",
                String.format("Updated status of %s as %s", dto.email(), dto.status()));
    }

    /** TODO: wire real metrics later. Mock data for now to verify the endpoint is admin-gated. */
    public AdminDashboardDto getStats() {
        return AdminDashboardDto.mock();
    }
}
