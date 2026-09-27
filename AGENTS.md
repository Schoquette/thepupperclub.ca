# Agent Instructions

- Occasionally check the `error_logs` table (Admin → Error Logs page, or `GET /api/admin/error-logs`) for new entries and fix the underlying causes. This is the only durable error record in production — GoDaddy shared hosting gives no server log access — so nothing else will surface these failures.
