import { PrismaService } from '../../prisma/prisma.service';

export async function calculateUserDigPoints(
  prisma: PrismaService,
  userId: string,
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return 0;

  const responses = await prisma.digResponse.findMany({
    where: { user_id: userId },
    select: { dig_id: true, layer_id: true },
  });

  if (!responses.length) return 0;

  const layerIds = responses.map((r) => r.layer_id);

  const layers = await prisma.layers.findMany({
    where: { id: { in: layerIds } },
    select: { id: true, point: true },
  });

  const totalPoints = layers.reduce(
    (sum, layer) => sum + (layer.point || 0),
    0,
  );

  return totalPoints;
}
