import { RoomScreen } from '@/components/RoomScreen';

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomScreen roomId={roomId} />;
}
