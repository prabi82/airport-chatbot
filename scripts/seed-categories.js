const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultCategories = [
  {
    categoryId: 'flights',
    name: 'Flights',
    description: 'Flight schedules, gates, delays, and airline information',
    icon: '✈️',
    isActive: true,
    order: 1
  },
  {
    categoryId: 'transportation',
    name: 'Transportation',
    description: 'Parking, taxi services, public transport, and directions',
    icon: '🚗',
    isActive: true,
    order: 2
  },
  {
    categoryId: 'parking',
    name: 'Parking',
    description: 'Parking areas, rates, availability, and payment options',
    icon: '🅿️',
    isActive: true,
    order: 3
  },
  {
    categoryId: 'services',
    name: 'Services',
    description: 'Airport services, assistance, and customer support',
    icon: '🛎️',
    isActive: true,
    order: 4
  },
  {
    categoryId: 'amenities',
    name: 'Amenities',
    description: 'Dining, shopping, lounges, and airport facilities',
    icon: '🏪',
    isActive: true,
    order: 5
  },
  {
    categoryId: 'security',
    name: 'Security',
    description: 'Security procedures, checkpoints, and safety information',
    icon: '🔒',
    isActive: true,
    order: 6
  },
  {
    categoryId: 'general',
    name: 'General',
    description: 'General airport information and miscellaneous queries',
    icon: 'ℹ️',
    isActive: true,
    order: 7
  }
];

async function seedCategories() {
  try {
    console.log('🌱 Seeding categories...');
    
    await prisma.$connect();
    console.log('✅ Connected to database');

    // Clear existing categories
    await prisma.category.deleteMany({});
    console.log('🧹 Cleared existing categories');

    // Add new categories
    for (const category of defaultCategories) {
      await prisma.category.create({
        data: category
      });
      console.log(`✅ Added: ${category.name} (${category.categoryId})`);
    }

    const count = await prisma.category.count();
    console.log(`📊 Total categories: ${count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected');
  }
}

seedCategories(); 