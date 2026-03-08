import { parseExternalCalendar } from './icalParser';

async function verifyGoogleFeedInjection() {
    console.log("-----------------------------------------");
    console.log("Mock Test: External Calendar Sync parsing");
    console.log("-----------------------------------------");
    
    // An active sample public google calendar containing US holidays.
    const mockURL = "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics";
    
    try {
        console.log("Fetching and parsing URL...");
        const events = await parseExternalCalendar(mockURL);
        
        console.log(`Success: Found ${events.length} events.`);
        if (events.length > 0) {
            console.log("Sample Data Output:");
            console.log(JSON.stringify(events[0], null, 2));
            
            // Replicate the mapping logic from appointmentService.ts
            // to ensure it accurately builds an appointment object.
            
            const startDate = new Date(); // Test bounding box
            const endDate = new Date(new Date().getTime() + (365 * 24 * 60 * 60 * 1000));
            
            const externalAppts = events.filter(e => {
                if (startDate && e.end < startDate) return false;
                if (endDate && e.start > endDate) return false;
                return true;
            }).map(e => ({
                id: -Math.floor(Math.random() * 1000000), 
                conversationId: 0,
                artistId: "user_2tm14L2C0j1bAR7wO2wN2Hk9JgN",
                clientId: "external-sync",
                title: e.summary || "Busy",
                description: "External Calendar Block",
                startTime: e.start.toISOString().slice(0, 19).replace("T", " "), 
                endTime: e.end.toISOString().slice(0, 19).replace("T", " "),
                status: "confirmed",
                serviceName: "External Sync",
            }));
            
            console.log("\nSimulated externalAppts array mapped to internal Appointments table format. Length: ", externalAppts.length);
            if (externalAppts.length > 0) {
               console.log("Sample internal mapping:");
               console.log(JSON.stringify(externalAppts[0], null, 2));
            }
        }
    } catch (err) {
        console.error("Test failed. Caught error:", err);
    }
}

verifyGoogleFeedInjection();
