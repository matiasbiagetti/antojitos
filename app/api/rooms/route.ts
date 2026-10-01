import { createRoom } from '@/lib/server/commands/rooms';
import { handle, readJson } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => createRoom(await readJson(req), new Date()));
}
