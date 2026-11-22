package org.assessment_hub.spring_backend.auth.guard;

import org.assessment_hub.spring_backend.profile.ProfileStatus;
import org.assessment_hub.spring_backend.profile.UserEntity;
import org.assessment_hub.spring_backend.profile.UserRepo;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

@Service ("writeGuard")
@RequiredArgsConstructor 
public class WriteGuard {

    private final UserRepo users;

    /** SpEL hook: true only when the signed-in user's profile is ACTIVE. Fresh DB lookup, not the session copy. */
    public boolean canWrite() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return false;
        return users.findByEmail(auth.getName())
                .map(user -> user.getStatus() == ProfileStatus.ACTIVE)
                .orElse(false);
    }

    /** Service-layer belt-and-suspenders — 403 with a status-specific reason. */
    public void requireWriteAccess() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated.");
        }
        ProfileStatus status = users.findByEmail(auth.getName())
                .map(UserEntity::getStatus)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated."));
        if (status == ProfileStatus.ACTIVE) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, status == ProfileStatus.PENDING
                ? "Your profile is pending approval. You can view your resources but not make changes yet."
                : "Your profile is restricted. Editing is disabled. Contact an administrator.");
    }
}
