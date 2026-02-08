# PATENT CLAIMS
## Intelligent Multi-Session Appointment Scheduling System

**Patent Application Document**  
**Date**: February 8, 2026  
**Inventor**: [Your Name]

---

## INDEPENDENT CLAIMS

### CLAIM 1 (Method - Broad)

A computer-implemented method for automatically scheduling multiple appointment sessions, the method comprising:

(a) receiving, by a computer system, scheduling parameters including:
    (i) a service duration value representing minutes required for each session,
    (ii) a sittings value representing a number of sessions to schedule,
    (iii) a frequency value selected from a group consisting of consecutive, weekly, biweekly, and monthly intervals,
    (iv) a start date value representing an earliest allowable scheduling date,
    (v) a timezone identifier conforming to IANA timezone database format,
    (vi) a work schedule data structure comprising a plurality of work day entries, each work day entry including a day identifier, an enabled status, a start time, and an end time, and
    (vii) an existing appointments data structure comprising a plurality of appointment intervals, each appointment interval including a start timestamp and an end timestamp;

(b) validating, by the computer system, feasibility of the scheduling parameters by:
    (i) parsing the work schedule data structure to extract enabled work days,
    (ii) calculating a maximum daily capacity value representing a longest continuous work period among the enabled work days,
    (iii) comparing the service duration value to the maximum daily capacity value, and
    (iv) generating an error condition if the service duration value exceeds the maximum daily capacity value;

(c) initializing, by the computer system, a search state comprising:
    (i) a busy slots array initialized with a copy of the existing appointments data structure,
    (ii) a suggested dates array initialized as empty,
    (iii) a search pointer value initialized to a maximum of the start date value and a current timestamp,
    (iv) aligning the search pointer value to a predetermined time granularity by calculating a remainder of minutes modulo the predetermined time granularity and adding a difference between the predetermined time granularity and the remainder to the minutes component;

(d) iteratively finding, by the computer system, available time slots by:
    (i) for each sitting from zero to sittings minus one:
        (A) invoking a slot finding algorithm with the search pointer value, the service duration value, the work schedule data structure, the busy slots array, and the timezone identifier as parameters,
        (B) receiving a slot result value from the slot finding algorithm, wherein the slot result value is either a valid timestamp or a null value,
        (C) if the slot result value is null, generating an error condition indicating no available slot found for the current sitting,
        (D) if the slot result value is a valid timestamp:
            (1) appending the slot result value to the suggested dates array,
            (2) creating a new appointment interval with a start timestamp equal to the slot result value and an end timestamp equal to the slot result value plus the service duration value converted to milliseconds,
            (3) appending the new appointment interval to the busy slots array to prevent self-overlap,
            (4) calculating a next search date value by advancing the slot result value according to the frequency value, wherein:
                (a) if frequency is consecutive, adding one day to the slot result value,
                (b) if frequency is weekly, adding seven days to the slot result value,
                (c) if frequency is biweekly, adding fourteen days to the slot result value,
                (d) if frequency is monthly, adding one month to the slot result value,
            (5) updating the search pointer value to the next search date value;

(e) returning, by the computer system, a scheduling result comprising:
    (i) the suggested dates array containing a number of timestamps equal to the sittings value, and
    (ii) a total cost value calculated as a product of a price value and the sittings value.

---

### CLAIM 2 (Method - Slot Finding Algorithm)

The method of claim 1, wherein the slot finding algorithm comprises:

(a) initializing a current pointer value to the search pointer value parameter;

(b) calculating an end search limit value as the current pointer value plus three hundred sixty-five days;

(c) while the current pointer value is less than the end search limit value:
    (i) extracting a day name value from the current pointer value using timezone-aware date formatting with the timezone identifier parameter,
    (ii) searching the work schedule data structure for a schedule entry matching the day name value using case-insensitive comparison,
    (iii) if a matching schedule entry exists and has an enabled status of true:
        (A) parsing a start time string from the schedule entry to extract start hour and start minute components,
        (B) parsing an end time string from the schedule entry to extract end hour and end minute components,
        (C) extracting current hour and current minute components from the current pointer value using timezone-aware time formatting with the timezone identifier parameter,
        (D) calculating a current total minutes value as current hour multiplied by sixty plus current minute,
        (E) calculating a start total minutes value as start hour multiplied by sixty plus start minute,
        (F) calculating an end total minutes value as end hour multiplied by sixty plus end minute,
        (G) if end total minutes is less than start total minutes, adding one thousand four hundred forty to end total minutes to handle overnight shifts,
        (H) if current total minutes is greater than or equal to start total minutes and current total minutes plus the service duration value parameter is less than or equal to end total minutes:
            (1) calculating a potential end value as current pointer value plus service duration value parameter converted to milliseconds,
            (2) checking for collision by iterating through the busy slots array parameter and testing if current pointer value is less than any appointment interval end timestamp and potential end value is greater than any appointment interval start timestamp,
            (3) if no collision is detected, returning the current pointer value as the slot result,
    (iv) incrementing the current pointer value by the predetermined time granularity;

(d) if the while loop completes without returning a slot result, returning null.

---

### CLAIM 3 (System - Broad)

A computer system for automatically scheduling multiple appointment sessions, the system comprising:

(a) a processor;

(b) a memory coupled to the processor;

(c) a persistent data store storing:
    (i) booking context records,
    (ii) work schedule configurations, and
    (iii) existing appointment records;

(d) program instructions stored in the memory that, when executed by the processor, cause the system to:
    (i) receive scheduling parameters including service duration, number of sittings, scheduling frequency, start date, timezone identifier, work schedule data structure, and existing appointments data structure,
    (ii) validate feasibility by parsing the work schedule, calculating maximum daily capacity, and comparing to service duration,
    (iii) initialize search state including a busy slots array copied from existing appointments and a search pointer aligned to predetermined time granularity,
    (iv) iteratively find available time slots by invoking a slot finding algorithm for each sitting, appending found slots to a suggested dates array, and adding each found slot to the busy slots array to prevent self-overlap,
    (v) calculate next search dates according to the scheduling frequency,
    (vi) return a scheduling result comprising the suggested dates array and a total cost value.

---

### CLAIM 4 (Non-Transitory Computer-Readable Medium)

A non-transitory computer-readable medium storing program instructions that, when executed by a processor, cause a computer system to perform a method for automatically scheduling multiple appointment sessions, the method comprising:

(a) receiving scheduling parameters including service duration, number of sittings, scheduling frequency, start date, timezone identifier, work schedule data structure, and existing appointments data structure;

(b) validating feasibility by calculating maximum daily capacity from the work schedule and comparing to service duration;

(c) initializing a busy slots array with existing appointments and aligning a search pointer to a predetermined time granularity;

(d) for each sitting:
    (i) finding an available time slot using timezone-aware day and time extraction,
    (ii) appending the found slot to a suggested dates array,
    (iii) adding the found slot to the busy slots array to prevent self-overlap,
    (iv) calculating a next search date according to the scheduling frequency;

(e) returning the suggested dates array and a total cost value.

---

## DEPENDENT CLAIMS

### CLAIM 5 (Dependent on Claim 1)

The method of claim 1, wherein the predetermined time granularity is thirty minutes.

---

### CLAIM 6 (Dependent on Claim 1)

The method of claim 1, wherein the timezone-aware date formatting uses the Intl.DateTimeFormat API with a weekday option set to 'long' and a timeZone option set to the timezone identifier.

---

### CLAIM 7 (Dependent on Claim 1)

The method of claim 1, wherein the collision detection uses a mathematical interval overlap formula: A_start < B_end AND A_end > B_start, where A represents the candidate slot and B represents an existing appointment.

---

### CLAIM 8 (Dependent on Claim 1)

The method of claim 1, wherein the busy slots array is updated in-memory without writing to a persistent data store during the iterative finding step.

---

### CLAIM 9 (Dependent on Claim 1)

The method of claim 1, wherein the work day entry start time and end time support both twelve-hour format with AM/PM indicators and twenty-four-hour format.

---

### CLAIM 10 (Dependent on Claim 2)

The method of claim 2, wherein the end search limit value of three hundred sixty-five days provides a bounded search window to guarantee algorithm termination.

---

### CLAIM 11 (Dependent on Claim 2)

The method of claim 2, wherein the slot finding algorithm returns immediately upon finding a first valid slot, implementing a greedy first-fit strategy.

---

### CLAIM 12 (Dependent on Claim 1)

The method of claim 1, wherein the frequency value further includes a custom frequency option comprising a custom interval value representing a number of days between sessions.

---

### CLAIM 13 (Dependent on Claim 1)

The method of claim 1, further comprising:
(a) after returning the scheduling result, creating appointment records in a persistent data store for each timestamp in the suggested dates array;
(b) associating each appointment record with a booking context identifier, a provider identifier, and a client identifier.

---

### CLAIM 14 (Dependent on Claim 3)

The system of claim 3, wherein the program instructions further cause the system to:
(a) handle daylight saving time transitions by using timezone-aware date and time calculations for all temporal operations;
(b) correctly determine day of week and time of day in the provider's local timezone regardless of the system's local timezone.

---

### CLAIM 15 (Dependent on Claim 3)

The system of claim 3, wherein the busy slots array implements self-overlap prevention by maintaining a unified list of both existing appointments retrieved from the persistent data store and newly scheduled sessions from the current scheduling operation.

---

### CLAIM 16 (Dependent on Claim 1)

The method of claim 1, wherein the validating step further comprises:
(a) retrieving a booking context record from a persistent data store using a conversation identifier;
(b) verifying the booking context record exists;
(c) retrieving a provider settings record associated with the booking context;
(d) extracting the work schedule data structure from the provider settings record;
(e) verifying the work schedule data structure contains at least one enabled work day entry.

---

### CLAIM 17 (Dependent on Claim 2)

The method of claim 2, wherein the time parsing step comprises:
(a) normalizing the time string to uppercase;
(b) detecting presence of "AM" or "PM" indicators;
(c) removing "AM" or "PM" indicators from the time string;
(d) splitting the time string on a colon character to extract hour and minute components;
(e) converting hour component to twenty-four-hour format by:
    (i) adding twelve to hour if "PM" indicator is present and hour is less than twelve,
    (ii) setting hour to zero if "AM" indicator is present and hour equals twelve.

---

### CLAIM 18 (Dependent on Claim 1)

The method of claim 1, wherein the method has a time complexity of O(S × D × T × A), where:
- S represents the number of sittings,
- D represents the number of days searched,
- T represents the number of time slots per day,
- A represents the number of existing appointments.

---

### CLAIM 19 (Dependent on Claim 1)

The method of claim 1, wherein the method has a space complexity of O(S + A), where:
- S represents the number of sittings,
- A represents the number of existing appointments.

---

### CLAIM 20 (Dependent on Claim 1)

The method of claim 1, further comprising:
(a) calculating performance metrics including:
    (i) total execution time,
    (ii) number of iterations performed,
    (iii) number of collision checks performed;
(b) logging the performance metrics to a monitoring system.

---

## CLAIM STRATEGY NOTES

### Claim Coverage

**Independent Claims** (1-4):
- **Claim 1**: Broadest method claim covering the entire algorithm
- **Claim 2**: Method claim focused on slot finding subprocess
- **Claim 3**: System claim covering hardware/software implementation
- **Claim 4**: Computer-readable medium claim for software distribution

**Dependent Claims** (5-20):
- **Claims 5-7**: Technical implementation details (granularity, timezone API, collision formula)
- **Claims 8-9**: Novel features (in-memory updates, time format flexibility)
- **Claims 10-11**: Algorithm characteristics (bounded search, greedy strategy)
- **Claims 12-13**: Extensions and integrations (custom frequency, database persistence)
- **Claims 14-15**: System-specific features (DST handling, self-overlap prevention)
- **Claims 16-17**: Detailed subprocess steps (validation, time parsing)
- **Claims 18-20**: Performance characteristics and monitoring

### Protection Strategy

1. **Broad Protection**: Claims 1, 3, 4 provide wide coverage of the invention
2. **Narrow Protection**: Claims 2, 5-20 protect specific implementations
3. **Fallback Positions**: If broad claims are rejected, narrow claims provide alternative protection
4. **Multiple Claim Types**: Method, system, and medium claims cover different aspects of commercialization

### Prosecution Strategy

1. **Start with Claim 1**: Broadest independent claim
2. **Fall back to Claim 2**: If Claim 1 is rejected for being too broad
3. **Combine dependent claims**: Create new independent claims by combining features
4. **Emphasize novel features**: Self-overlap prevention, timezone-awareness, bounded search

---

**End of Patent Claims**
