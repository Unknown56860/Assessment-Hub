package org.assessment_hub.spring_backend.auth.guard;

import org.assessment_hub.spring_backend.question.QuestionSetRepo;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service("questionSetGuard")
@RequiredArgsConstructor
public class QuestionSetGuard {

    private final QuestionSetRepo sets;

    public boolean canAccess(Long questionSetId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return false;
        // if (auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return true;
        return sets.existsByQuestionSetIdAndUser_Email(questionSetId, auth.getName());
    }

    public boolean canAccessJson(Long questionSetId) { return canAccess(questionSetId); }
}
