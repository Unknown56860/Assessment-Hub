package org.assessment_hub.spring_backend.admin.dtos;

import java.util.List;

public record AdminDashboardDto(
        String db_status,
        String storage_status,
        long total_users,
        long total_messages,
        List<TrendPoint> assessment_trend
) {
    public record TrendPoint(String date, long assessments) {}

    /** Placeholder until real metrics (assessment trend, health checks) are wired up. */
    public static AdminDashboardDto mock() {
        return new AdminDashboardDto(
                "UP", "UP", 42, 137,
                List.of(new TrendPoint("2026-10-27", 12),
                        new TrendPoint("2026-10-28", 18),
                        new TrendPoint("2026-10-29", 7),
                        new TrendPoint("2026-10-30", 25),
                        new TrendPoint("2026-10-31", 14),
                        new TrendPoint("2026-11-01", 22),
                        new TrendPoint("2026-11-02", 9)));
    }
}
