package org.assessment_hub.spring_backend.core.security;

import java.io.IOException;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component 
public class CsrfCookieFilter extends OncePerRequestFilter {

    /** Touching the deferred CsrfToken makes CookieCsrfTokenRepository write the
     *  XSRF-TOKEN cookie on every response; the SPA echoes it as X-XSRF-TOKEN. */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (token != null) token.getToken();
        chain.doFilter(request, response);
    }
}
