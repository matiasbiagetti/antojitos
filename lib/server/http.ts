import { AppError } from './errors';

export const TOKEN_HEADER = 'x-participant-token';

/** Ejecuta el comando y responde JSON con `serverTime` (lo usa el cliente para corregir su reloj). */
export async function handle(fn: () => Promise<object>): Promise<Response> {
  try {
    const data = await fn();
    return Response.json({ ...data, serverTime: Date.now() });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: { code: error.code, message: error.message }, serverTime: Date.now() },
        { status: error.status },
      );
    }
    console.error(error);
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Internal error' }, serverTime: Date.now() },
      { status: 500 },
    );
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function tokenFrom(req: Request): string | null {
  return req.headers.get(TOKEN_HEADER);
}
