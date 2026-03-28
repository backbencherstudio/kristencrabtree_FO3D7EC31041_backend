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

/** XP ranges: 0–80 → 1, 81–180 → 2, 181+ → 3 */
export function getLevelFromTotalXp(totalXp: number): number {
  if (totalXp <= 80) return 1;
  if (totalXp <= 180) return 2;
  return 2 + Math.ceil((totalXp - 180) / 100);
}

/** Returns min/max XP and total XP span for a level (for progress display). */
export function getLevelXpRange(level: number): {
  minXp: number;
  maxXp: number;
} {
  if (level <= 1) return { minXp: 0, maxXp: 80 };
  if (level === 2) return { minXp: 81, maxXp: 180};
  const minXp = 181 + (level - 3) * 100;
  const maxXp = minXp + 99;
  return { minXp, maxXp};
}