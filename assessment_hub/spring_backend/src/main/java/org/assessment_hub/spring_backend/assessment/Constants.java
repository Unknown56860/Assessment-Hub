package org.assessment_hub.spring_backend.assessment;

import org.springframework.web.socket.CloseStatus;

public final class Constants {
    private Constants() {}

    public static final long SWEEPER_RATE_MS = 1000;
    public static final long HEARTBEAT_TIMEOUT_MS = 15_000;
    public static final long LATE_JOIN_WINDOW_SECONDS = 300;
    public static final long FLUSH_GRACE_MS = 3_000;
    public static final long FLUSH_RETRY_MS = 10_000;
    public static final long EVENT_LOG_CAP = 250;
    // DEFAULT_START_DELAY_SECONDS removed — the frontend always sends startAt/endAt now

    public static final int CODE_LENGTH = 6;
    public static final int MAX_STUDENTS_DEFAULT = 100;
    public static final int MAX_STUDENTS_HARD_CAP = 10_000;
    public static final int MIN_DURATION_MIN = 5;            // NEW — minimum assessment duration
    public static final int DURATION_MIN_LIMIT = 720;
    public static final int EXTEND_MIN_LIMIT = 180;
    public static final long MAX_ANSWER_BYTES = 10_240;

    // Custom WS close codes
    public static final CloseStatus KICKED = new CloseStatus(4001, "KICKED");
    public static final CloseStatus TIME_OVER = new CloseStatus(4002, "TIME_OVER");
    public static final CloseStatus ALREADY_SUBMITTED = new CloseStatus(4003, "ALREADY_SUBMITTED");
    public static final CloseStatus UNAUTHORIZED = new CloseStatus(4403, "UNAUTHORIZED");
}
