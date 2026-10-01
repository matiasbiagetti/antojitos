import { joinRoom } from '@/lib/server/commands/rooms';
import { handle, readJson } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => joinRoom(roomId, await readJson(req), new Date()));
}
