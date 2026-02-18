/**
 * Unified Identity Model
 * ----------------------
 * Bridges the gap between Users and Leads.
 * Standardizes person-related data across the application.
 */

export interface Person {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    birthday?: string;
    avatar?: string;
}

export type IdentityType = 'user' | 'lead';

export interface Identity extends Person {
    id: string | number;
    type: IdentityType;
    name: string; // Aggregate name for UI convenience
    clerkId?: string; // Only relevant for type 'user'
    clerkEmail?: string; // Primary email from Clerk
}

/**
 * Normalizes a full name string into first and last names.
 */
export function normalizeName(fullName: string | null | undefined): { firstName: string, lastName: string } {
    if (!fullName) return { firstName: '', lastName: '' };

    const trimmed = fullName.trim();
    if (!trimmed) return { firstName: '', lastName: '' };

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    };
}

/**
 * Combines first and last name into a single full name.
 */
export function getFullName(person: Partial<Person>): string {
    const { firstName = '', lastName = '' } = person;
    return `${firstName} ${lastName}`.trim();
}

/**
 * Gets a displayable name for a person (FirstName L. or full name).
 */
export function getDisplayName(person: Partial<Person>): string {
    const { firstName = '', lastName = '' } = person;
    if (!firstName) return lastName || 'Anonymous';
    if (!lastName) return firstName;
    return `${firstName} ${lastName[0]}.`;
}
