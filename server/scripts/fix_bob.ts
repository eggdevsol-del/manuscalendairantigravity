import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users, appointments, conversations, messages } from '../../drizzle/schema';
import { eq, or } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/calendair');
  const db = drizzle(connection);
  
  try {
    const user = await db.select().from(users).where(eq(users.email, 'bob@gmail.com')).limit(1);
    
    if (user.length === 0) {
      console.log('User bob@gmail.com not found');
      return;
    }
    
    const bob = user[0];
    console.log('Found bob:', { id: bob.id, role: bob.role });
    
    // Clear appointments
    const deletedAppts = await db.delete(appointments).where(or(
      eq(appointments.clientId, bob.id),
      eq(appointments.artistId, bob.id)
    ));
    console.log('Deleted appointments:', deletedAppts[0].affectedRows);

    // Clear messages for any conversation bob is in
    const convos = await db.select().from(conversations).where(or(
      eq(conversations.clientId, bob.id),
      eq(conversations.artistId, bob.id)
    ));
    
    let deletedMsgsCount = 0;
    for (const conv of convos) {
      const deletedMsgs = await db.delete(messages).where(eq(messages.conversationId, conv.id));
      deletedMsgsCount += deletedMsgs[0].affectedRows;
    }
    console.log('Deleted messages:', deletedMsgsCount);

    // If the user role is admin or artist and it shouldn't be, we can log it here.
    if (bob.role === 'admin' || bob.role === 'artist') {
      console.log(`WARNING: Bob has role '${bob.role}'. This is why the 'X' button appeared!`);
      // Update role to client
      await db.update(users).set({ role: 'client' }).where(eq(users.id, bob.id));
      console.log('Updated Bob role back to client.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

run();
