/**
 * SSOT Card Template Registry
 * 
 * Defines all available card designs, colors, and gradients for
 * vouchers, discounts, and credits in the Promotions system.
 * 
 * @version 1.0.0
 */

// ==========================================
// COLOR PALETTE
// ==========================================

export interface ColorOption {
  id: string;
  name: string;
  value: string; // CSS color value
  textColor: 'white' | 'black'; // Contrast text color
}

export const SOLID_COLORS: ColorOption[] = [
  { id: 'midnight', name: 'Midnight', value: '#1a1a2e', textColor: 'white' },
  { id: 'ocean', name: 'Ocean', value: '#0f4c75', textColor: 'white' },
  { id: 'forest', name: 'Forest', value: '#1b4332', textColor: 'white' },
  { id: 'wine', name: 'Wine', value: '#722f37', textColor: 'white' },
  { id: 'charcoal', name: 'Charcoal', value: '#2d3436', textColor: 'white' },
  { id: 'gold', name: 'Gold', value: '#d4af37', textColor: 'black' },
  { id: 'rose', name: 'Rose', value: '#e8b4b8', textColor: 'black' },
  { id: 'cream', name: 'Cream', value: '#f5f5dc', textColor: 'black' },
  { id: 'lavender', name: 'Lavender', value: '#e6e6fa', textColor: 'black' },
  { id: 'mint', name: 'Mint', value: '#98fb98', textColor: 'black' },
  { id: 'custom', name: 'Custom', value: '#000000', textColor: 'white' }, // Placeholder - actual value set by user
];

// Custom color interface for user-defined colors
export interface CustomColorConfig {
  enabled: boolean;
  value: string;
  textColor: 'white' | 'black';
}

// Helper to determine if a color is light or dark for text contrast
export function getContrastTextColor(hexColor: string): 'white' | 'black' {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'black' : 'white';
}

// ==========================================
// GRADIENT PALETTE
// ==========================================

export interface GradientOption {
  id: string;
  name: string;
  from: string;
  to: string;
  direction: string; // CSS gradient direction
  textColor: 'white' | 'black';
}

export const GRADIENTS: GradientOption[] = [
  { id: 'sunset', name: 'Sunset', from: '#ff6b6b', to: '#feca57', direction: '135deg', textColor: 'white' },
  { id: 'ocean_deep', name: 'Ocean Deep', from: '#667eea', to: '#764ba2', direction: '135deg', textColor: 'white' },
  { id: 'emerald', name: 'Emerald', from: '#11998e', to: '#38ef7d', direction: '135deg', textColor: 'white' },
  { id: 'royal', name: 'Royal', from: '#141e30', to: '#243b55', direction: '135deg', textColor: 'white' },
  { id: 'rose_gold', name: 'Rose Gold', from: '#f093fb', to: '#f5576c', direction: '135deg', textColor: 'white' },
  { id: 'midnight_city', name: 'Midnight City', from: '#232526', to: '#414345', direction: '135deg', textColor: 'white' },
  { id: 'peach', name: 'Peach', from: '#ffecd2', to: '#fcb69f', direction: '135deg', textColor: 'black' },
  { id: 'cool_sky', name: 'Cool Sky', from: '#2980b9', to: '#6dd5fa', direction: '135deg', textColor: 'white' },
  { id: 'purple_haze', name: 'Purple Haze', from: '#7f00ff', to: '#e100ff', direction: '135deg', textColor: 'white' },
  { id: 'gold_shimmer', name: 'Gold Shimmer', from: '#f7971e', to: '#ffd200', direction: '135deg', textColor: 'black' },
];

// ==========================================
// CARD DESIGN TEMPLATES
// ==========================================

export type PromotionType = 'voucher' | 'discount' | 'credit';

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  forTypes: PromotionType[]; // Which promotion types can use this template
  layout: 'horizontal' | 'vertical';
  hasChip: boolean; // EFTPOS-style chip
  hasMagStripe: boolean;
  hasHologram: boolean;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  valuePosition: 'center' | 'bottom-left' | 'bottom-right';
  aspectRatio: string; // CSS aspect-ratio value
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional EFTPOS card style with chip',
    forTypes: ['voucher', 'discount', 'credit'],
    layout: 'horizontal',
    hasChip: true,
    hasMagStripe: false,
    hasHologram: false,
    logoPosition: 'top-right',
    valuePosition: 'bottom-left',
    aspectRatio: '1.586 / 1', // Standard credit card ratio
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Luxury card with hologram effect',
    forTypes: ['voucher', 'credit'],
    layout: 'horizontal',
    hasChip: true,
    hasMagStripe: true,
    hasHologram: true,
    logoPosition: 'top-left',
    valuePosition: 'bottom-right',
    aspectRatio: '1.586 / 1',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, modern design without chip',
    forTypes: ['voucher', 'discount', 'credit'],
    layout: 'horizontal',
    hasChip: false,
    hasMagStripe: false,
    hasHologram: false,
    logoPosition: 'center',
    valuePosition: 'bottom-right',
    aspectRatio: '1.586 / 1',
  },
];

// ==========================================
// DEFAULT CONFIGURATIONS BY TYPE
// ==========================================

export interface TypeDefaultConfig {
  type: PromotionType;
  defaultTemplate: string;
  defaultGradient: string;
  defaultColor: string;
  labelSingular: string;
  labelPlural: string;
  icon: string; // Lucide icon name
  valuePrefix: string;
  valueSuffix: string;
}

export const TYPE_DEFAULTS: TypeDefaultConfig[] = [
  {
    type: 'voucher',
    defaultTemplate: 'premium',
    defaultGradient: 'gold_shimmer',
    defaultColor: 'gold',
    labelSingular: 'Gift Voucher',
    labelPlural: 'Gift Vouchers',
    icon: 'Gift',
    valuePrefix: '$',
    valueSuffix: '',
  },
  {
    type: 'discount',
    defaultTemplate: 'minimal',
    defaultGradient: 'ocean_deep',
    defaultColor: 'ocean',
    labelSingular: 'Discount Card',
    labelPlural: 'Discount Cards',
    icon: 'Percent',
    valuePrefix: '',
    valueSuffix: '% OFF',
  },
  {
    type: 'credit',
    defaultTemplate: 'classic',
    defaultGradient: 'royal',
    defaultColor: 'midnight',
    labelSingular: 'Store Credit',
    labelPlural: 'Store Credits',
    icon: 'CreditCard',
    valuePrefix: '$',
    valueSuffix: '',
  },
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export function getColorById(id: string): ColorOption | undefined {
  return SOLID_COLORS.find(c => c.id === id);
}

export function getGradientById(id: string): GradientOption | undefined {
  return GRADIENTS.find(g => g.id === id);
}

export function getTemplateById(id: string): CardTemplate | undefined {
  return CARD_TEMPLATES.find(t => t.id === id);
}

export function getTypeDefaults(type: PromotionType): TypeDefaultConfig {
  return TYPE_DEFAULTS.find(t => t.type === type) || TYPE_DEFAULTS[0];
}

export function buildCardBackground(
  gradientId?: string | null,
  colorId?: string | null,
  backgroundImageUrl?: string | null
): string {
  // Priority: Background image > Gradient > Solid color
  if (backgroundImageUrl) {
    return `url(${backgroundImageUrl}) center/cover no-repeat`;
  }
  
  if (gradientId) {
    const gradient = getGradientById(gradientId);
    if (gradient) {
      return `linear-gradient(${gradient.direction}, ${gradient.from}, ${gradient.to})`;
    }
  }
  
  if (colorId) {
    const color = getColorById(colorId);
    if (color) {
      return color.value;
    }
  }
  
  // Fallback
  return GRADIENTS[0].from;
}

export function getTextColor(
  gradientId?: string | null,
  colorId?: string | null
): 'white' | 'black' {
  if (gradientId) {
    const gradient = getGradientById(gradientId);
    if (gradient) return gradient.textColor;
  }
  
  if (colorId) {
    const color = getColorById(colorId);
    if (color) return color.textColor;
  }
  
  return 'white';
}

export function formatPromotionValue(
  value: number,
  type: PromotionType,
  valueType: 'fixed' | 'percentage'
): string {
  const defaults = getTypeDefaults(type);
  
  if (valueType === 'percentage') {
    return `${value}% OFF`;
  }
  
  // Fixed value - convert cents to dollars
  const dollars = (value / 100).toFixed(value % 100 === 0 ? 0 : 2);
  return `${defaults.valuePrefix}${dollars}${defaults.valueSuffix}`;
}
