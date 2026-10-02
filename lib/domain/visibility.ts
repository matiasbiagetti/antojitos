import { CATEGORY_IDS } from './categories';
import type { FullResult, IndividualVotes, PublicResult, VisibilityConfig } from './types';

function individualVotes(full: FullResult, nicknames: Record<string, string>): IndividualVotes[] {
  return Object.entries(nicknames)
    .map(([participantId, nickname]) => ({
      nickname,
      votes: full.votes
        .filter((v) => v.participantId === participantId)
        .map(({ categoryId, value }) => ({ categoryId, value })),
      runoffChoice: full.runoffVotes.find((v) => v.participantId === participantId)?.categoryId ?? null,
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'es'));
}

/** Único camino por el que un resultado puede llegar a un cliente. */
export function toPublicResult(
  full: FullResult,
  visibility: VisibilityConfig,
  nicknames: Record<string, string>,
): PublicResult {
  const out: PublicResult = { winner: full.winner };
  // Sin showSuperCounts el orden no puede depender de los súper: puntaje y, de ahí, orden del catálogo.
  const ordered = visibility.showSuperCounts
    ? full.stats
    : [...full.stats].sort(
        (a, b) => b.score - a.score || CATEGORY_IDS.indexOf(a.categoryId) - CATEGORY_IDS.indexOf(b.categoryId),
      );
  if (visibility.showRanking) out.ranking = ordered.map((s) => s.categoryId);
  if (visibility.showScores) out.scores = ordered.map(({ categoryId, score }) => ({ categoryId, score }));
  if (visibility.showSuperCounts) {
    out.superCounts = full.stats.map(({ categoryId, superCount }) => ({ categoryId, superCount }));
  }
  if (visibility.showTiebreakPath) {
    out.tiebreak = {
      path: full.path,
      finalists: [...full.finalists],
      runoffCounts: full.runoffCounts ? full.runoffCounts.map((c) => ({ ...c })) : null,
    };
  }
  if (visibility.showWhoVotedWhat) out.individualVotes = individualVotes(full, nicknames);
  return out;
}
