package org.assessment_hub.spring_backend.assessment;

import java.security.Principal;

import org.assessment_hub.spring_backend.assessment.dtos.AssessmentCodeDto;
import org.assessment_hub.spring_backend.assessment.dtos.HostRequestDto;
import org.assessment_hub.spring_backend.assessment.dtos.HostResponseDto;
import org.assessment_hub.spring_backend.assessment.dtos.JoinRequestDto;
import org.assessment_hub.spring_backend.assessment.dtos.JoinWaitDto;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/assessment")
@RequiredArgsConstructor
public class AssessmentController {

    private final AssessmentService live;

    @GetMapping("/code")
    @PreAuthorize("hasRole('TEACHER')")
    public AssessmentCodeDto nextCode() {
        return new AssessmentCodeDto(live.generateCode());
    }

    @GetMapping("/host")
    @PreAuthorize("hasRole('TEACHER')")
    public HostResponseDto reattach(Principal principal) {
        return live.activeHostView(principal.getName());
    }

    @PostMapping("/host")
    @PreAuthorize("hasRole('TEACHER') and @writeGuard.canWrite()")
    public HostResponseDto host(@Valid @RequestBody HostRequestDto dto, Principal principal) {
        return live.host(principal.getName(), dto);
    }

    /** 200 = admitted (JoinResponseDto); 202 = assessment SCHEDULED (JoinWaitDto with the countdown). */
    @PostMapping("/join")
    public ResponseEntity<Object> join(@Valid @RequestBody JoinRequestDto dto) {
        Object outcome = live.join(dto);
        return outcome instanceof JoinWaitDto wait
                ? ResponseEntity.accepted().body(wait)
                : ResponseEntity.ok(outcome);
    }

}


// ##. Acceptance tests (must run these before marking it as done)

// 1. Two browser windows, same roll → newest wins, old window closes, violation logged.
// 2. Kill network mid-test, wait 30s, reconnect → same answers, same remaining time.
// 3. Teacher closes tab → assessment still auto-starts and auto-ends; reattach shows it running.
// 4. Kill the backend during flush → restart → recovery sweeper completes the dump; no duplicate rows.
// 5. Un-kick a kicked student → they rejoin and continue.
// 6. Extend by 5 min at T−1min → all clients' timers update; answer saves past the old `end_ts` still accepted.

