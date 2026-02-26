import { drizzle } from "drizzle-orm/mysql2";
import * as db from "../server/db";

// Get artist ID from command line or use default
const artistId = process.argv[2] || "GezxEMqpBrSeJQxe7e6Ci9";

async function seedDemoData() {
  console.log("🌱 Seeding demo data for artist:", artistId);

  try {
    // Create test client
    const testClientId = "demo-client-" + Date.now();
    console.log("Creating test client:", testClientId);

    await db.upsertUser({
      id: testClientId,
      name: "Sarah Johnson",
      email: "sarah.demo@example.com",
      phone: "+1 (555) 234-5678",
      role: "client",
      loginMethod: "demo",
      bio: "Birthday: 1995-06-15",
    });

    // Create conversation
    console.log("Creating conversation...");
    const conversation = await db.createConversation({
      artistId: artistId,
      clientId: testClientId,
    });

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    console.log("Created conversation:", conversation.id);

    // Create messages
    console.log("Creating messages...");
    await db.createMessage({
      conversationId: conversation.id,
      senderId: testClientId,
      content:
        "Hi! I'd like to book an appointment for a custom tattoo design.",
    });

    await db.createMessage({
      conversationId: conversation.id,
      senderId: artistId,
      content:
        "Hello Sarah! I'd love to help with your custom design. What did you have in mind?",
    });

    await db.createMessage({
      conversationId: conversation.id,
      senderId: testClientId,
      content:
        "I'm thinking of a floral sleeve design with some geometric elements. Do you have any availability next week?",
    });

    await db.createMessage({
      conversationId: conversation.id,
      senderId: artistId,
      content:
        "That sounds beautiful! Let me check my calendar and get back to you with some available times.",
    });

    await db.createMessage({
      conversationId: conversation.id,
      senderId: testClientId,
      content: "Perfect, thank you! Looking forward to our appointment!",
    });

    // Create appointment
    console.log("Creating appointment...");
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(14, 0, 0, 0);
    const endTime = new Date(nextWeek);
    endTime.setHours(16, 0, 0, 0);

    await db.createAppointment({
      conversationId: conversation.id,
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
      status: "confirmed",
    });

    console.log("✅ Demo data seeded successfully!");
    console.log("📊 Created:");
    console.log("  - 1 test client (Sarah Johnson)");
    console.log("  - 1 conversation");
    console.log("  - 5 messages");
    console.log("  - 1 appointment (next week)");
    console.log("\n🎉 You can now test the app with real data!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    process.exit(1);
  }
}

seedDemoData();
