/**
 * Tag Derivation Engine
 * 
 * Automatically generates tags from lead/funnel data.
 * Tags are DERIVED, not stored separately - they are computed from the lead's data.
 * 
 * This follows the SSOT principle: tags appear everywhere but are computed from
 * a single source (the lead record).
 */

interface LeadData {
  projectType?: string;
  projectDescription?: string;
  stylePreferences?: string[];
  placement?: string;
  estimatedSize?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetLabel?: string;
  preferredTimeframe?: string;
  preferredMonths?: string[];
  urgency?: 'flexible' | 'moderate' | 'urgent';
  createdAt?: Date | string;
}

interface DerivedTag {
  label: string;
  category: 'project' | 'style' | 'budget' | 'timeline' | 'priority' | 'size';
  color?: string;
}

/**
 * Derive tags from lead data
 * Returns an array of tag objects with labels and categories
 */
export function deriveTagsFromLead(data: LeadData): DerivedTag[] {
  const tags: DerivedTag[] = [];

  // Project type tag
  if (data.projectType) {
    const projectLabels: Record<string, string> = {
      'full-sleeve': 'Full Sleeve',
      'half-sleeve': 'Half Sleeve',
      'back-piece': 'Back Piece',
      'chest-piece': 'Chest Piece',
      'cover-up': 'Cover Up',
      'small-piece': 'Small Piece',
      'touch-up': 'Touch Up',
      'custom': 'Custom Project',
    };
    tags.push({
      label: projectLabels[data.projectType] || data.projectType,
      category: 'project',
    });
  }

  // Style tags
  if (data.stylePreferences && data.stylePreferences.length > 0) {
    const styleLabels: Record<string, string> = {
      'realism': 'Realism',
      'traditional': 'Traditional',
      'neo-traditional': 'Neo-Traditional',
      'japanese': 'Japanese',
      'blackwork': 'Blackwork',
      'dotwork': 'Dotwork',
      'watercolor': 'Watercolor',
      'geometric': 'Geometric',
      'minimalist': 'Minimalist',
      'other': 'Other Style',
    };
    
    // Only add first 2 styles as tags to avoid clutter
    data.stylePreferences.slice(0, 2).forEach(style => {
      tags.push({
        label: styleLabels[style] || style,
        category: 'style',
      });
    });
    
    // If more than 2 styles, add a "+N more" indicator
    if (data.stylePreferences.length > 2) {
      tags.push({
        label: `+${data.stylePreferences.length - 2} styles`,
        category: 'style',
      });
    }
  }

  // Size tag
  if (data.estimatedSize) {
    const sizeLabels: Record<string, string> = {
      'small': 'Small (2-4")',
      'medium': 'Medium (4-6")',
      'large': 'Large (6-10")',
      'extra-large': 'XL (10"+)',
    };
    tags.push({
      label: sizeLabels[data.estimatedSize] || data.estimatedSize,
      category: 'size',
    });
  }

  // Budget tag
  if (data.budgetLabel) {
    tags.push({
      label: `Est ${data.budgetLabel}`,
      category: 'budget',
    });
  } else if (data.budgetMin !== undefined || data.budgetMax !== undefined) {
    const min = data.budgetMin ? `$${(data.budgetMin / 100).toLocaleString()}` : '';
    const max = data.budgetMax ? `$${(data.budgetMax / 100).toLocaleString()}` : '+';
    tags.push({
      label: `Est ${min}-${max}`,
      category: 'budget',
    });
  }

  // Timeline tag
  if (data.preferredTimeframe) {
    const timeframeLabels: Record<string, string> = {
      'asap': 'ASAP',
      '1-3-months': '1-3 Months',
      '3-6-months': '3-6 Months',
      '6-12-months': '6-12 Months',
      'flexible': 'Flexible Timeline',
    };
    tags.push({
      label: timeframeLabels[data.preferredTimeframe] || data.preferredTimeframe,
      category: 'timeline',
    });
  }

  // Target year tag (if we can derive it)
  if (data.preferredMonths && data.preferredMonths.length > 0) {
    // Extract year from first preferred month (format: YYYY-MM)
    const firstMonth = data.preferredMonths[0];
    const year = firstMonth.split('-')[0];
    if (year) {
      tags.push({
        label: `${year} Target`,
        category: 'timeline',
      });
    }
  }

  // Priority tag based on urgency
  if (data.urgency) {
    const priorityLabels: Record<string, { label: string; color: string }> = {
      'urgent': { label: 'High Priority', color: 'red' },
      'moderate': { label: 'Medium Priority', color: 'orange' },
      'flexible': { label: 'Flexible', color: 'green' },
    };
    const priority = priorityLabels[data.urgency];
    if (priority) {
      tags.push({
        label: priority.label,
        category: 'priority',
        color: priority.color,
      });
    }
  }

  return tags;
}

/**
 * Convert derived tags to a simple string array for storage
 * This is what gets stored in the `derivedTags` JSON field
 */
export function deriveTagLabels(data: LeadData): string[] {
  return deriveTagsFromLead(data).map(tag => tag.label);
}

/**
 * Calculate priority score based on lead data
 * Higher score = higher priority
 * 
 * Scoring factors:
 * - Urgency: urgent=300, moderate=200, flexible=100
 * - Budget: higher budget = higher score (max +200)
 * - Timeframe: sooner = higher score (max +150)
 * - Completeness: more data = higher score (max +100)
 * - Recency: newer leads get slight boost (max +50)
 */
export function calculatePriorityScore(data: LeadData): number {
  let score = 0;

  // Urgency factor (0-300)
  const urgencyScores: Record<string, number> = {
    'urgent': 300,
    'moderate': 200,
    'flexible': 100,
  };
  score += urgencyScores[data.urgency || 'flexible'] || 100;

  // Budget factor (0-200)
  if (data.budgetMin !== undefined) {
    // Scale: $0-500 = 20, $500-1000 = 50, $1000-2500 = 80, $2500-5000 = 120, $5000-10000 = 160, $10000+ = 200
    if (data.budgetMin >= 10000) score += 200;
    else if (data.budgetMin >= 5000) score += 160;
    else if (data.budgetMin >= 2500) score += 120;
    else if (data.budgetMin >= 1000) score += 80;
    else if (data.budgetMin >= 500) score += 50;
    else score += 20;
  }

  // Timeframe factor (0-150)
  const timeframeScores: Record<string, number> = {
    'asap': 150,
    '1-3-months': 120,
    '3-6-months': 80,
    '6-12-months': 40,
    'flexible': 20,
  };
  score += timeframeScores[data.preferredTimeframe || 'flexible'] || 20;

  // Completeness factor (0-100)
  let completeness = 0;
  if (data.projectType) completeness += 15;
  if (data.projectDescription && data.projectDescription.length > 20) completeness += 20;
  if (data.stylePreferences && data.stylePreferences.length > 0) completeness += 15;
  if (data.placement) completeness += 15;
  if (data.estimatedSize) completeness += 10;
  if (data.budgetMin !== undefined) completeness += 15;
  if (data.preferredTimeframe) completeness += 10;
  score += Math.min(completeness, 100);

  // Recency factor (0-50)
  if (data.createdAt) {
    const created = new Date(data.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCreation < 1) score += 50;
    else if (hoursSinceCreation < 4) score += 40;
    else if (hoursSinceCreation < 24) score += 30;
    else if (hoursSinceCreation < 72) score += 20;
    else if (hoursSinceCreation < 168) score += 10;
    // Older than a week: no bonus
  }

  return score;
}

/**
 * Determine priority tier based on score
 */
export function getPriorityTier(score: number): 'tier1' | 'tier2' | 'tier3' | 'tier4' {
  if (score >= 600) return 'tier1'; // Critical - money on the table
  if (score >= 400) return 'tier2'; // High - pipeline protection
  if (score >= 200) return 'tier3'; // Medium - relationship maintenance
  return 'tier4'; // Low - operational
}

/**
 * Estimate lead value in cents based on budget range
 */
export function estimateLeadValue(data: LeadData): number {
  if (data.budgetMin !== undefined && data.budgetMax !== undefined) {
    // Use midpoint of range
    return Math.round((data.budgetMin + data.budgetMax) / 2);
  }
  if (data.budgetMin !== undefined) {
    // Only min specified (e.g., "$10,000+")
    return data.budgetMin * 1.5; // Assume 50% above minimum
  }
  if (data.budgetMax !== undefined) {
    // Only max specified
    return data.budgetMax * 0.75; // Assume 75% of max
  }
  
  // Default estimate based on project type
  const defaultEstimates: Record<string, number> = {
    'full-sleeve': 500000, // $5,000
    'half-sleeve': 250000, // $2,500
    'back-piece': 400000,  // $4,000
    'chest-piece': 300000, // $3,000
    'cover-up': 150000,    // $1,500
    'small-piece': 30000,  // $300
    'touch-up': 15000,     // $150
    'custom': 200000,      // $2,000
  };
  
  return defaultEstimates[data.projectType || 'custom'] || 200000;
}
