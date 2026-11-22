package org.assessment_hub.spring_backend.profile;

import org.assessment_hub.spring_backend.profile.dto.ActivityLogDto;
import org.assessment_hub.spring_backend.profile.dto.PagedLogsDto;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

// Read/Write operations related to activity logs will be delgated to this service.
// This service will ensure any user can only access their own activity log.

@Service 
@RequiredArgsConstructor 
public class ActivityService {
    private final ActivityLogRepo activityRepo;

    public void addLog(UserEntity user, String action, String description) {
        ActivityLogEntity newLog = ActivityLogEntity.builder()
            .user(user).action(action).description(description).build();
        activityRepo.save(newLog);
    }

    public void addLog(String action, String description) {
        UserEntity user = currentUser();
        addLog(user, action, description);
    }

    public PagedLogsDto getAllLogs(int page, int size) {
        UserEntity user = currentUser();
        Page<ActivityLogEntity> result = activityRepo.findByUser(user, PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 250),        // hard cap page size
                Sort.by(Sort.Direction.DESC, "time")));  // newest first

        return new PagedLogsDto(
                result.getTotalElements(),
                result.getContent().stream().map(ActivityLogDto::from).toList());
    }

    private UserEntity currentUser() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid user! Please login again.");
        }

        HttpSession session = attributes.getRequest().getSession(false);
        if (session == null || !(session.getAttribute("USER") instanceof UserEntity user)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid session! Please login again.");
        }

        return user;
    }
}
