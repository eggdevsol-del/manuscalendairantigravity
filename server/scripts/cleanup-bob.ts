/**
 * One-off script: Delete all appointments and session_plan messages for bob@gmail.com.
 * Preserves conversations and regular text messages.
 *
 * Usage: npx tsx server/scripts/cleanup-bob.ts
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
  });

  // 1. Find bob's user ID
  const [users] = await pool.query(
    `SELECT id, name, email FROM users WHERE email = ?`,
    ["bob@gmail.com"]
  ) as any;

  if (users.length === 0) {
    console.log("❌ No user found with email bob@gmail.com");
    await pool.end();
    return;
  }

  const bobId = users[0].id;
  console.log(`✅ Found bob: id=${bobId}, name=${users[0].name}`);

  // 2. Count and delete appointments where bob is the client
  const [appts] = await pool.query(
    `SELECT id, title, projectName, status, startTime FROM appointments WHERE clientId = ?`,
    [bobId]
  ) as any;
  console.log(`\n📋 Found ${appts.length} appointments for bob:`);
  for (const a of appts) {
    console.log(`   - #${a.id}: "${a.projectName || a.title}" (${a.status}) @ ${a.startTime}`);
  }

  if (appts.length > 0) {
    // Delete related records first (appointment_logs, payment_requests, etc.)
    const apptIds = appts.map((a: any) => a.id);
    const placeholders = apptIds.map(() => "?").join(",");

    // Delete appointment logs
    const [logResult] = await pool.query(
      `DELETE FROM appointment_logs WHERE appointmentId IN (${placeholders})`,
      apptIds
    ) as any;
    console.log(`   🗑️  Deleted ${logResult.affectedRows} appointment logs`);

    // Delete payment requests
    const [prResult] = await pool.query(
      `DELETE FROM payment_requests WHERE appointmentId IN (${placeholders})`,
      apptIds
    ) as any;
    console.log(`   🗑️  Deleted ${prResult.affectedRows} payment requests`);

    // Delete payment ledger entries
    const [plResult] = await pool.query(
      `DELETE FROM payment_ledger WHERE bookingId IN (${placeholders})`,
      apptIds
    ) as any;
    console.log(`   🗑️  Deleted ${plResult.affectedRows} payment ledger entries`);

    // Delete appointments
    const [apptResult] = await pool.query(
      `DELETE FROM appointments WHERE clientId = ?`,
      [bobId]
    ) as any;
    console.log(`   🗑️  Deleted ${apptResult.affectedRows} appointments`);
  }

  // 3. Find bob's conversations and delete session_plan messages
  const [convos] = await pool.query(
    `SELECT id FROM conversations WHERE clientId = ?`,
    [bobId]
  ) as any;
  const convoIds = convos.map((c: any) => c.id);
  console.log(`\n💬 Found ${convoIds.length} conversations for bob`);

  if (convoIds.length > 0) {
    const cPlaceholders = convoIds.map(() => "?").join(",");

    // Count proposal/session_plan messages
    const [planMsgs] = await pool.query(
      `SELECT id, messageType, content, conversationId FROM messages 
       WHERE conversationId IN (${cPlaceholders}) 
       AND messageType IN ('session_plan', 'session_plan_accepted', 'appointment_request', 'appointment_confirmed')`,
      convoIds
    ) as any;
    console.log(`📝 Found ${planMsgs.length} proposal/plan card messages:`);
    for (const m of planMsgs) {
      console.log(`   - msg #${m.id}: type=${m.messageType}, conv=${m.conversationId}`);
    }

    if (planMsgs.length > 0) {
      const msgIds = planMsgs.map((m: any) => m.id);
      const mPlaceholders = msgIds.map(() => "?").join(",");
      const [msgResult] = await pool.query(
        `DELETE FROM messages WHERE id IN (${mPlaceholders})`,
        msgIds
      ) as any;
      console.log(`   🗑️  Deleted ${msgResult.affectedRows} proposal/plan card messages`);
    }
  }

  console.log("\n✅ Done! Conversations and regular messages preserved.");
  await pool.end();
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
