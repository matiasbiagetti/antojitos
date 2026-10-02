import type { Db } from './db';
import {
  getRoom,
  getRound,
  listParticipants,
  listRunoffVotes,
  listVotes,
  nextPublicVersion,
  upsertPublicSnapshot,
} from './room-repository';
import { buildPublicSnapshot } from './snapshot-builder';

export { buildPublicSnapshot, isSpectator } from './snapshot-builder';

export async function writePublicSnapshot(db: Db, roomId: string): Promise<void> {
  const room = await getRoom(db, roomId);
  if (!room) return;
  const participants = await listParticipants(db, roomId);
  const round = room.currentRound > 0 ? await getRound(db, roomId, room.currentRound) : null;
  const votes = round ? await listVotes(db, roomId, round.number) : [];
  const runoffVoteCount = round ? (await listRunoffVotes(db, roomId, round.number)).length : 0;
  const version = await nextPublicVersion(db, roomId);
  await upsertPublicSnapshot(db, roomId, version, buildPublicSnapshot({ room, participants, round, votes, runoffVoteCount, version }));
}
