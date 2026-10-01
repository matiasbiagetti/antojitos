import { recordOpened } from '@/lib/server/commands/rooms';
import { handle } from '@/lib/server/http';

export async function POST(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => recordOpened(roomId));
}
