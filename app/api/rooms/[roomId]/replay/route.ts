import { replay } from '@/lib/server/commands/rooms';
import { handle, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => replay(roomId, tokenFrom(req), new Date()));
}
