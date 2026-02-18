/**
 * Funnel Constants
 */

// Simple project types without emojis
export const PROJECT_TYPES = [
    { id: 'full-sleeve', label: 'Full Sleeve' },
    { id: 'half-sleeve', label: 'Half Sleeve' },
    { id: 'back-piece', label: 'Back Piece' },
    { id: 'chest-piece', label: 'Chest Piece' },
    { id: 'cover-up', label: 'Cover Up' },
    { id: 'small-piece', label: 'Small Piece' },
    { id: 'touch-up', label: 'Touch Up' },
    { id: 'custom', label: 'Custom Project' },
];

// Simple style options
export const STYLE_OPTIONS = [
    'Realism', 'Traditional', 'Neo-Traditional', 'Japanese',
    'Blackwork', 'Dotwork', 'Watercolor', 'Geometric',
    'Minimalist', 'Fine Line', 'Other'
];

// Budget ranges
export const BUDGET_RANGES = [
    { label: 'Under $500', min: 0, max: 500 },
    { label: '$500 - $1,000', min: 500, max: 1000 },
    { label: '$1,000 - $2,500', min: 1000, max: 2500 },
    { label: '$2,500 - $5,000', min: 2500, max: 5000 },
    { label: '$5,000 - $10,000', min: 5000, max: 10000 },
    { label: '$10,000+', min: 10000, max: null },
];

// Timeframe options
export const TIMEFRAME_OPTIONS = [
    { id: 'asap', label: 'As soon as possible' },
    { id: '1-3months', label: 'Within 1-3 months' },
    { id: '3-6months', label: 'Within 3-6 months' },
    { id: '6months+', label: '6+ months from now' },
    { id: 'flexible', label: 'Flexible / No rush' },
];

export const STEP_TITLES = [
    "What are you looking for?",
    "Your contact details",
    "Style preferences",
    "Show us the placement area",
    "Your budget",
    "When would you like to get tattooed?"
];
