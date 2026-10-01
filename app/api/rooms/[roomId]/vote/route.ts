import { castVote } from '@/lib/server/commands/round';
import { handle, readJson, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => castVote(roomId, tokenFrom(req), await readJson(req), new Date()));
}
