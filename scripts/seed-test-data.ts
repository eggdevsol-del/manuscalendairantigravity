import { drizzle } from "drizzle-orm/mysql2";
import {
  users,
  conversations,
  messages,
  appointments,
} from "../drizzle/schema";

const db = drizzle(process.env.DATABASE_URL!);

async function seedTestData() {
  console.log("Seeding test data...");

  try {
    const artistId = process.env.OWNER_OPEN_ID || "test-artist-id";
    const testClientId = "test-client-" + Date.now();

    await db.insert(users).values({
      id: testClientId,
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      phone: "+1 (555) 234-5678",
      role: "client",
      loginMethod: "email",
      bio: "Birthday: 1995-06-15",
    });

    console.log("✓ Created test client");

    const [conversation] = await db.insert(conversations).values({
      artistId: artistId,
      clientId: testClientId,
      lastMessage: "Looking forward to our appointment!",
      lastMessageAt: new Date(),
    });

    const conversationId = conversation.insertId;
    console.log("✓ Created conversation");

    await db.insert(messages).values([
      {
        conversationId: conversationId,
        senderId: testClientId,
        content:
          "Hi! I'd like to book an appointment for a custom tattoo design.",
        createdAt: new Date(Date.now() - 3600000 * 24),
      },
      {
        conversationId: conversationId,
        senderId: artistId,
        content:
          "Hello Sarah! I'd love to help with your custom design. What did you have in mind?",
        createdAt: new Date(Date.now() - 3600000 * 23),
      },
      {
        conversationId: conversationId,
        senderId: testClientId,
        content:
          "I'm thinking of a floral sleeve design with some geometric elements. Do you have any availability next week?",
        createdAt: new Date(Date.now() - 3600000 * 22),
      },
      {
        conversationId: conversationId,
        senderId: artistId,
        content:
          "That sounds beautiful! Let me check my calendar and get back to you with some available times.",
        createdAt: new Date(Date.now() - 3600000 * 21),
      },
      {
        conversationId: conversationId,
        senderId: testClientId,
        content: "Perfect, thank you! Looking forward to our appointment!",
        createdAt: new Date(Date.now() - 3600000 * 20),
      },
    ]);

    console.log("✓ Created messages");

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(14, 0, 0, 0);
    const endTime = new Date(nextWeek);
    endTime.setHours(16, 0, 0, 0);

    await db.insert(appointments).values({
      conversationId: conversationId,
      artistId: artistId,
      clientId: testClientId,
      title: "Custom Floral Sleeve Tattoo - Consultation",
      description:
        "Initial consultation and design discussion for custom floral sleeve with geometric elements",
      startTime: nextWeek,
      endTime: endTime,
      serviceName: "Custom Tattoo Design",
      price: 150,
      depositAmount: 50,
      depositPaid: true,
    });

    console.log("✓ Created appointment");
    console.log("\n✅ Test data seeded successfully!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
  process.exit(0);
}

seedTestData();
