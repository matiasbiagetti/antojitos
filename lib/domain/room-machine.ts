import type { RoomPhase, RoundOutcome, RunoffOutcome } from './types';

export type RoomAction =
  | 'config'
  | 'start'
  | 'vote'
  | 'close_voting'
  | 'runoff_vote'
  | 'close_runoff'
  | 'finish_roulette'
  | 'replay';

const ALLOWED_PHASE: Record<RoomAction, RoomPhase> = {
  config: 'lobby',
  start: 'lobby',
  vote: 'voting',
  close_voting: 'voting',
  runoff_vote: 'runoff',
  close_runoff: 'runoff',
  finish_roulette: 'roulette',
  replay: 'result',
};

export const HOST_ONLY_ACTIONS: readonly RoomAction[] = ['config', 'start', 'replay'];

export function canTransition(phase: RoomPhase, action: RoomAction): boolean {
  return ALLOWED_PHASE[action] === phase;
}

export function phaseAfterRound(kind: RoundOutcome['kind']): RoomPhase {
  if (kind === 'runoff') return 'runoff';
  if (kind === 'roulette') return 'roulette';
  return 'result';
}

export function phaseAfterRunoff(kind: RunoffOutcome['kind']): RoomPhase {
  return kind === 'roulette' ? 'roulette' : 'result';
}
