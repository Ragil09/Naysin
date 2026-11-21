/** One-time non-destructive backfill for existing Naysin2 users. */
import { PrismaClient } from "@prisma/client";
import { usernameBase, usernameCandidate } from "../src/backend/users/username";

const prisma = new PrismaClient();

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  const [db] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (db?.name !== "naysin2" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Backfill ini hanya diizinkan untuk database lokal naysin2");
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, username: true } });
  let total = 0;
  for (const user of users) {
    if (user.username) continue;
    const preferred = user.email === "owner@nayskopi.demo" ? "owner" : user.email === "staff@nayskopi.demo" ? "staff" : null;
    const base = preferred || usernameBase(user.name);
    for (let n = 1; n <= 1000; n++) {
      const username = usernameCandidate(base, n);
      const occupied = await prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (occupied) continue;
      try {
        await prisma.user.update({ where: { id: user.id }, data: { username } });
        console.log(`${user.name}: ${username}`);
        total++;
        break;
      } catch (e) {
        // Retry on username collisions; let any other failure abort safely.
        if (e instanceof Error && "code" in e && e.code === "P2002") continue;
        throw e;
      }
    }
  }
  console.log(`Selesai: ${total} akun diperbarui; tidak ada akun atau stok yang dihapus.`);
}
main().catch(err => { console.error("Backfill gagal:", err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
