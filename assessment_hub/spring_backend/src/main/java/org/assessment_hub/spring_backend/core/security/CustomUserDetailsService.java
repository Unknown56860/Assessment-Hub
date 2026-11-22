package org.assessment_hub.spring_backend.core.security;

import org.springframework.stereotype.Service;
import org.assessment_hub.spring_backend.profile.UserEntity;
import org.assessment_hub.spring_backend.profile.UserRepo;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import lombok.RequiredArgsConstructor;

@Service 
@RequiredArgsConstructor 
public class CustomUserDetailsService implements UserDetailsService{
    private final UserRepo users;

    public UserDetails loadUserByUsername(String userEmail) throws UsernameNotFoundException {
        UserEntity user = users.findByEmail(userEmail).orElseThrow(() -> new UsernameNotFoundException("Email not registered: " + userEmail));
        return User.withUsername(userEmail).password(user.getPassword()).roles(user.getRole().toString()).build();
    }

}
