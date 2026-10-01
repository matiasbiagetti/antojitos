import { CATEGORY_IDS } from './categories';
import { pickOne, shuffle, type Rng } from './random';
import { VOTE_WEIGHTS, type CategoryId, type CategoryStat, type RoundOutcome, type Vote } from './types';

const MAX_FINALISTS = 3;

export function computeStats(votes: Vote[]): CategoryStat[] {
  const byId = new Map<CategoryId, CategoryStat>(
    CATEGORY_IDS.map((id) => [id, { categoryId: id, score: 0, superCount: 0 }]),
  );
  for (const vote of votes) {
    const stat = byId.get(vote.categoryId);
    if (!stat) continue;
    stat.score += VOTE_WEIGHTS[vote.value];
    if (vote.value === 'super') stat.superCount += 1;
  }
  const order = (id: CategoryId) => CATEGORY_IDS.indexOf(id);
  return [...byId.values()].sort(
    (a, b) => b.score - a.score || b.superCount - a.superCount || order(a.categoryId) - order(b.categoryId),
  );
}

/** Dentro del margen de empate: diferencia ≤ max(1, 20% del puntaje de la primera). Aritmética entera. */
export function isWithinMargin(topScore: number, score: number): boolean {
  const diff = topScore - score;
  return diff <= 1 || diff * 5 <= topScore;
}

/** Corte a 3 por puntaje; si el empate cae en el último lugar, sorteo. */
function pickFinalists(candidates: CategoryStat[], rng: Rng): CategoryId[] {
  if (candidates.length <= MAX_FINALISTS) return candidates.map((c) => c.categoryId);
  const cutoffScore = candidates[MAX_FINALISTS - 1].score;
  const sure = candidates.filter((c) => c.score > cutoffScore).map((c) => c.categoryId);
  const tied = candidates.filter((c) => c.score === cutoffScore).map((c) => c.categoryId);
  return [...sure, ...shuffle(tied, rng).slice(0, MAX_FINALISTS - sure.length)];
}

/** §6.3: el ballotage no aporta información si cada participante apoyó exactamente a una finalista. */
function runoffIsRedundant(finalists: CategoryId[], votes: Vote[], eligibleVoterIds: string[]): boolean {
  if (eligibleVoterIds.length === 0) return false;
  return eligibleVoterIds.every((participantId) => {
    const supported = finalists.filter((categoryId) =>
      votes.some(
        (v) => v.participantId === participantId && v.categoryId === categoryId && v.value !== 'no',
      ),
    );
    return supported.length === 1;
  });
}

export function scoreRound(input: {
  votes: Vote[];
  /** Participantes de la ronda + espectadores presentes al cierre. */
  eligibleRunoffVoterIds: string[];
  rng: Rng;
}): RoundOutcome {
  const stats = computeStats(input.votes);
  const topScore = stats[0].score;
  if (topScore === 0) return { kind: 'no_cravings', stats };

  const candidates = stats.filter((s) => s.score > 0 && isWithinMargin(topScore, s.score));
  if (candidates.length === 1) return { kind: 'winner', winner: candidates[0].categoryId, stats };

  const finalists = pickFinalists(candidates, input.rng);
  if (runoffIsRedundant(finalists, input.votes, input.eligibleRunoffVoterIds)) {
    return { kind: 'roulette', finalists, winner: pickOne(finalists, input.rng), stats };
  }
  return { kind: 'runoff', finalists, stats };
}
