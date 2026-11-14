import { and, eq, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../drizzle/schema";
import { userBlocks, userReports, users } from "../../drizzle/schema";

type Database = MySql2Database<typeof schema>;

/** True when either person has blocked the other. Deliberately does not say which. */
export async function messagingBlocked(
  database: Database,
  a: string,
  b: string
): Promise<boolean> {
  const rows = await database
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a))
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function hasBlocked(
  database: Database,
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  const rows = await database
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function addBlock(
  database: Database,
  blockerId: string,
  blockedId: string
) {
  // Blocking twice is not an error.
  await database
    .insert(userBlocks)
    .values({ blockerId, blockedId })
    .onDuplicateKeyUpdate({ set: { blockerId } });
}

export async function removeBlock(
  database: Database,
  blockerId: string,
  blockedId: string
) {
  await database
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      )
    );
}

export async function listBlocks(database: Database, blockerId: string) {
  return database
    .select({
      userId: userBlocks.blockedId,
      name: users.name,
      createdAt: userBlocks.createdAt,
    })
    .from(userBlocks)
    .leftJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, blockerId));
}

export async function userExists(database: Database, id: string) {
  const rows = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows.length > 0;
}

export async function reportsInLastDay(database: Database, reporterId: string) {
  const [row] = await database
    .select({ count: sql<number>`count(*)` })
    .from(userReports)
    .where(
      and(
        eq(userReports.reporterId, reporterId),
        sql`${userReports.createdAt} > (now() - interval 1 day)`
      )
    );
  return Number(row?.count || 0);
}

export async function createReport(
  database: Database,
  report: schema.InsertUserReport
): Promise<number> {
  const result = await database.insert(userReports).values(report);
  return Number(result[0].insertId);
}
