-- Make late_days_paid nullable and default to NULL
ALTER TABLE payment_schedule ALTER COLUMN late_days_paid DROP DEFAULT;
ALTER TABLE payment_schedule ALTER COLUMN late_days_paid DROP NOT NULL;
ALTER TABLE payment_schedule ALTER COLUMN late_days_paid SET DEFAULT NULL;

-- Update legacy records (older than TODAY 2026-01-06) that have 0 to NULL
-- This distinguishes them from new records where 0 explicitly means "0 days paid"
-- We use a safe cutoff date to ensure recent tests (like Ruta Dos) are preserved as 0 (unpaid debt)
-- while older normal payments are marked as legacy (waived/settled).
UPDATE payment_schedule 
SET late_days_paid = NULL 
WHERE late_days_paid = 0 
  AND updated_at < '2026-01-06';
