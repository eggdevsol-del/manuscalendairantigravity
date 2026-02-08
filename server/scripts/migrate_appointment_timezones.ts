import { db } from '../db';
import { appointments } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { fromZonedTime } from 'date-fns-tz';

/**
 * Migration Script: Convert Appointment Timezones to UTC
 * 
 * This script converts existing appointment times from Australia/Brisbane
 * timezone to UTC ISO format and adds the timezone field.
 * 
 * IMPORTANT: Run this AFTER adding the timeZone column to the database
 */

const BUSINESS_TIMEZONE = 'Australia/Brisbane';

async function migrateAppointmentTimezones() {
    console.log('🕐 Starting appointment timezone migration...');
    console.log(`📍 Business timezone: ${BUSINESS_TIMEZONE}`);
    console.log('');

    try {
        // Fetch all appointments
        const allAppointments = await db.select().from(appointments);

        console.log(`📊 Found ${allAppointments.length} appointments to migrate`);
        console.log('');

        if (allAppointments.length === 0) {
            console.log('✅ No appointments to migrate');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: Array<{ id: number; error: string }> = [];

        for (const apt of allAppointments) {
            try {
                // Parse existing DATETIME as if it's in business timezone
                // MySQL DATETIME format: "YYYY-MM-DD HH:mm:ss" or ISO string
                const startLocal = new Date(apt.startTime);
                const endLocal = new Date(apt.endTime);

                // Validate dates
                if (isNaN(startLocal.getTime()) || isNaN(endLocal.getTime())) {
                    throw new Error(`Invalid date format: start=${apt.startTime}, end=${apt.endTime}`);
                }

                // Convert to UTC assuming they are in business timezone
                const startUTC = fromZonedTime(startLocal, BUSINESS_TIMEZONE);
                const endUTC = fromZonedTime(endLocal, BUSINESS_TIMEZONE);

                // Log the conversion for verification
                console.log(`📝 Appointment ${apt.id}:`);
                console.log(`   Local: ${apt.startTime} → ${apt.endTime}`);
                console.log(`   UTC:   ${startUTC.toISOString()} → ${endUTC.toISOString()}`);

                // Update appointment with UTC times and timezone
                await db.update(appointments)
                    .set({
                        startTime: startUTC.toISOString(),
                        endTime: endUTC.toISOString(),
                        timeZone: BUSINESS_TIMEZONE,
                    })
                    .where(eq(appointments.id, apt.id));

                successCount++;

                if (successCount % 10 === 0) {
                    console.log(`✅ Progress: ${successCount}/${allAppointments.length} appointments migrated`);
                }
            } catch (error) {
                console.error(`❌ Error migrating appointment ${apt.id}:`, error);
                errorCount++;
                errors.push({
                    id: apt.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        console.log('');
        console.log('═'.repeat(60));
        console.log('📊 Migration Summary');
        console.log('═'.repeat(60));
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📈 Total: ${allAppointments.length}`);

        if (errors.length > 0) {
            console.log('');
            console.log('❌ Failed Appointments:');
            errors.forEach(({ id, error }) => {
                console.log(`   - ID ${id}: ${error}`);
            });
        }

        console.log('');
        if (errorCount === 0) {
            console.log('🎉 Migration completed successfully!');
        } else {
            console.log('⚠️  Migration completed with errors. Please review failed appointments.');
        }

    } catch (error) {
        console.error('💥 Migration failed catastrophically:', error);
        throw error;
    }
}

// Run migration
console.log('');
console.log('═'.repeat(60));
console.log('🚀 Appointment Timezone Migration');
console.log('═'.repeat(60));
console.log('');

migrateAppointmentTimezones()
    .then(() => {
        console.log('');
        console.log('✅ Migration script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('');
        console.error('💥 Migration script failed:', error);
        process.exit(1);
    });
