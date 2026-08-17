-- Allow S+ above S on live placements, explanations, and review moves.
-- Existing S/A/B/C rows stay valid; blended_v1 rebuilds can write S+.
-- Postgres stores these CHECKs as `= ANY (ARRAY[...])`, so drop by name.

ALTER TABLE champion_tier_placements
  DROP CONSTRAINT IF EXISTS champion_tier_placements_letter_check;
ALTER TABLE champion_tier_placements
  DROP CONSTRAINT IF EXISTS champion_tier_placements_previous_letter_check;
ALTER TABLE tier_explanations
  DROP CONSTRAINT IF EXISTS tier_explanations_letter_check;
ALTER TABLE tier_adjustments
  DROP CONSTRAINT IF EXISTS tier_adjustments_letter_before_check;
ALTER TABLE tier_adjustments
  DROP CONSTRAINT IF EXISTS tier_adjustments_letter_after_check;

ALTER TABLE champion_tier_placements
  ADD CONSTRAINT champion_tier_placements_letter_check
  CHECK (letter IN ('S+', 'S', 'A', 'B', 'C'));

ALTER TABLE champion_tier_placements
  ADD CONSTRAINT champion_tier_placements_previous_letter_check
  CHECK (previous_letter IS NULL OR previous_letter IN ('S+', 'S', 'A', 'B', 'C'));

ALTER TABLE tier_explanations
  ADD CONSTRAINT tier_explanations_letter_check
  CHECK (letter IN ('S+', 'S', 'A', 'B', 'C'));

ALTER TABLE tier_adjustments
  ADD CONSTRAINT tier_adjustments_letter_before_check
  CHECK (letter_before IN ('S+', 'S', 'A', 'B', 'C'));

ALTER TABLE tier_adjustments
  ADD CONSTRAINT tier_adjustments_letter_after_check
  CHECK (letter_after IN ('S+', 'S', 'A', 'B', 'C'));

COMMENT ON TABLE champion_tier_placements IS
  'Deterministic S+/S/A/B/C bands per lane from the latest snapshot. Rebuilt after each stats sync.';
