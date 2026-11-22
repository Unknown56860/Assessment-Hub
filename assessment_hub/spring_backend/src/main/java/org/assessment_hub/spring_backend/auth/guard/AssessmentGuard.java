package org.assessment_hub.spring_backend.auth.guard;

import org.assessment_hub.spring_backend.evaluation.AssessmentRepo;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service ("assessmentGuard")
@RequiredArgsConstructor 
public class AssessmentGuard {

    private final AssessmentRepo submissions;

    public boolean canAccess(Long assessmentId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return false;
        // if (auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return true;
        return submissions.existsByAssessmentIdAndQuestionSet_User_Email(assessmentId, auth.getName());
    }
}
