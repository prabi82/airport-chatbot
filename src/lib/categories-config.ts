export interface CategoryConfig {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    id: 'flights',
    name: 'Flights',
    description: 'Flight schedules, gates, delays, and airline information',
    icon: '✈️',
    isActive: true,
    order: 1
  },
  {
    id: 'transportation',
    name: 'Transportation',
    description: 'Parking, taxi services, public transport, and directions',
    icon: '🚗',
    isActive: true,
    order: 2
  },
  {
    id: 'parking',
    name: 'Parking',
    description: 'Parking areas, rates, availability, and payment options',
    icon: '🅿️',
    isActive: true,
    order: 3
  },
  {
    id: 'services',
    name: 'Services',
    description: 'Airport services, assistance, and customer support',
    icon: '🛎️',
    isActive: true,
    order: 4
  },
  {
    id: 'amenities',
    name: 'Amenities',
    description: 'Dining, shopping, lounges, and airport facilities',
    icon: '🏪',
    isActive: true,
    order: 5
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Security procedures, checkpoints, and safety information',
    icon: '🔒',
    isActive: true,
    order: 6
  },
  {
    id: 'general',
    name: 'General',
    description: 'General airport information and miscellaneous queries',
    icon: 'ℹ️',
    isActive: true,
    order: 7
  }
];

export function getCategoryConfig(id: string): CategoryConfig | undefined {
  return DEFAULT_CATEGORIES.find(cat => cat.id === id);
}

export function getAllActiveCategories(): CategoryConfig[] {
  return DEFAULT_CATEGORIES.filter(cat => cat.isActive).sort((a, b) => a.order - b.order);
}

export function getAllCategories(): CategoryConfig[] {
  return [...DEFAULT_CATEGORIES].sort((a, b) => a.order - b.order);
} 