export interface BankDetailLabels {
    countryCode: string;
    bankCodeLabel: string | null; // e.g., 'BSB', 'Routing Number', 'Sort Code'. Null if not required (e.g. NZ)
    accountLabel: string; // e.g., 'Account Number', 'IBAN'
}

export function getBankDetailLabels(countryCode: string = "AU"): BankDetailLabels {
    const code = countryCode.toUpperCase();

    switch (code) {
        case "AU":
            return {
                countryCode: "AU",
                bankCodeLabel: "BSB",
                accountLabel: "Account Number",
            };
        case "NZ":
            return {
                countryCode: "NZ",
                bankCodeLabel: null, // NZ does not use a separate routing code, it's a single 16-digit string
                accountLabel: "Bank Account Number",
            };
        case "US":
            return {
                countryCode: "US",
                bankCodeLabel: "Routing Number",
                accountLabel: "Account Number",
            };
        case "GB": // United Kingdom
        case "UK":
            return {
                countryCode: "GB",
                bankCodeLabel: "Sort Code",
                accountLabel: "Account Number",
            };
        case "CA": // Canada
            return {
                countryCode: "CA",
                bankCodeLabel: "Transit & Institution Number", // e.g. 12345-001
                accountLabel: "Account Number",
            };
        default:
            // Generic Fallback (usually IBAN formats covering Euro area)
            return {
                countryCode: code,
                bankCodeLabel: "SWIFT / BIC",
                accountLabel: "IBAN / Account Number",
            };
    }
}
