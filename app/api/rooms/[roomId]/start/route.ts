import { startRound } from '@/lib/server/commands/round';
import { handle, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => startRound(roomId, tokenFrom(req), new Date()));
}
