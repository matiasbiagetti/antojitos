import { getMe } from '@/lib/server/commands/rooms';
import { handle, tokenFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => getMe(roomId, tokenFrom(req), new Date()));
}
