import { explainTierPlacements } from './explain-tiers';
import { reviewTierPlacements } from './review-tiers';
import { recomputeTierPlacements } from './sync-stats';

/** Sol review → apply ±1 moves → refresh hover explanations. */
export async function updateTiersWithSol(): Promise<void> {
  const review = await reviewTierPlacements();
  console.log(
    `Review ${review.status}: ${review.moves} moves from ${review.candidates} candidates (${review.cycleKey}).`,
  );
  await recomputeTierPlacements();
  const explained = await explainTierPlacements();
  console.log(
    `Explain ${explained.status}: wrote ${explained.written} of ${explained.considered} for ${explained.snapshotDate}.`,
  );
}
