
// Verification script for Priority Logic Curve
// Run with: npx tsx server/scripts/verify_priority_logic_standalone.ts

function calculateFollowUpScore(days: number): number {
    if (days < 1) return 0; // Too soon

    // Logic from generateFollowUpTasks
    const daysOverdue = Math.max(0, days - 2);
    let baseScore = 400 + (daysOverdue * 50);
    baseScore = Math.min(950, baseScore);
    return baseScore;
}

function calculateStaleChatScore(days: number): number {
    if (days < 2) return 0; // Too soon

    // Logic from generateStaleConversationTasks
    const daysOverdue = Math.max(0, days - 2);
    let baseScore = 300 + (daysOverdue * 40);
    // Archiving boost
    if (days > 7) {
        baseScore = Math.max(100, baseScore);
    }
    baseScore = Math.min(900, baseScore);
    return baseScore;
}

console.log("=== PRIORITY LOGIC VERIFICATION ===");
console.log("Expected Behavior: Older tasks should have HIGHER scores.\n");

console.log("--- Consultation Follow-Up (Responded but no reply) ---");
console.log("Day | Score | Priority Level");
console.log("----|-------|---------------");
[1, 2, 3, 5, 7, 10, 14, 21].forEach(d => {
    const s = calculateFollowUpScore(d);
    const level = s >= 800 ? 'CRITICAL' : s >= 500 ? 'HIGH' : s >= 300 ? 'MEDIUM' : 'LOW';
    console.log(`${d.toString().padEnd(3)} | ${s.toString().padEnd(5)} | ${level}`);
});

console.log("\n--- Stale Conversation (Artist sent last message) ---");
console.log("Day | Score | Priority Level");
console.log("----|-------|---------------");
[1, 2, 3, 5, 7, 10, 14, 21].forEach(d => {
    const s = calculateStaleChatScore(d);
    const level = s >= 800 ? 'CRITICAL' : s >= 500 ? 'HIGH' : s >= 300 ? 'MEDIUM' : 'LOW';
    console.log(`${d.toString().padEnd(3)} | ${s.toString().padEnd(5)} | ${level}`);
});
