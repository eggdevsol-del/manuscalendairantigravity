export interface ExternalEvent {
    start: Date;
    end: Date;
    summary: string;
}

function parseIcsDate(d: string): Date {
    let clean = d.trim().replace("Z", "");
    
    // Strip parameters like TZID=...: or VALUE=DATE:
    if (clean.includes(":")) {
        clean = clean.split(":").pop() || clean;
    }

    if (clean.length === 8) {
        // All day event: YYYYMMDD
        return new Date(
            `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}T00:00:00.000Z`
        );
    }
    // Standard UTC: YYYYMMDDTHHMMSS
    const isoStr = clean.replace(
        /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
        "$1-$2-$3T$4:$5:$6.000Z"
    );
    return new Date(isoStr);
}

export async function parseExternalCalendar(url: string): Promise<ExternalEvent[]> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ICS file: ${response.statusText}`);
        }
        const text = await response.text();

        const events: ExternalEvent[] = [];
        const vevents = text.split("BEGIN:VEVENT");
        vevents.shift(); // Remove the master header strings before first VEVENT

        for (const block of vevents) {
            const endBlock = block.split("END:VEVENT")[0];

            const dtstartMatch = endBlock.match(/DTSTART(?:;[^:]*)?:(.*)\r?\n/);
            const dtendMatch = endBlock.match(/DTEND(?:;[^:]*)?:(.*)\r?\n/);
            const summaryMatch = endBlock.match(/SUMMARY(?:;[^:]*)?:(.*)\r?\n/);

            if (dtstartMatch) {
                try {
                    const start = parseIcsDate(dtstartMatch[1]);
                    const end = dtendMatch ? parseIcsDate(dtendMatch[1]) : start;

                    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                        throw new Error(`Invalid Date format parsed from ${dtstartMatch[1]}`);
                    }

                    events.push({
                        start,
                        end,
                        summary: summaryMatch ? summaryMatch[1].trim() : "Busy",
                    });
                } catch (e) {
                    console.warn("Skipping unparseable date format in calendar sync.", dtstartMatch[1]);
                }
            }
        }

        return events;
    } catch (error: any) {
        console.error("[iCal Parser] Error fetching or parsing calendar feed:", error);
        throw new Error(error.message || "Invalid or unreachable iCal URL.");
    }
}
