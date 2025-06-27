import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get all categories from the categories table
    const categories = await prisma.category.findMany({
      orderBy: {
        order: 'asc'
      }
    });

    // Get knowledge base entry counts for each category
    const categoryStats = await prisma.knowledgeBase.groupBy({
      by: ['category'],
      _count: {
        category: true
      }
    });

    // Create a map for quick lookup of entry counts
    const entryCountMap = new Map();
    categoryStats.forEach(stat => {
      entryCountMap.set(stat.category.toLowerCase(), stat._count.category);
    });

    // Format the response with entry counts
    const formattedCategories = categories.map(category => ({
      id: category.categoryId,
      name: category.name,
      description: category.description,
      icon: category.icon,
      isActive: category.isActive,
      order: category.order,
      entryCount: entryCountMap.get(category.categoryId.toLowerCase()) || 0,
      createdAt: category.createdAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      categories: formattedCategories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, icon } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Create categoryId from name
    const categoryId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check if category already exists
    const existingCategory = await prisma.category.findUnique({
      where: {
        categoryId: categoryId
      }
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this ID already exists' },
        { status: 400 }
      );
    }

    // Get the highest order number and add 1
    const highestOrder = await prisma.category.findFirst({
      orderBy: {
        order: 'desc'
      },
      select: {
        order: true
      }
    });

    const newOrder = (highestOrder?.order || 0) + 1;

    // Create new category
    const newCategory = await prisma.category.create({
      data: {
        categoryId,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        order: newOrder,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Category created successfully',
      category: {
        id: newCategory.categoryId,
        name: newCategory.name,
        description: newCategory.description,
        icon: newCategory.icon,
        isActive: newCategory.isActive,
        order: newCategory.order,
        entryCount: 0,
        createdAt: newCategory.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, description, icon, isActive, order } = await request.json();

    if (!id || !name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category ID and name are required' },
        { status: 400 }
      );
    }

    // Find the category to update
    const existingCategory = await prisma.$queryRaw`
      SELECT * FROM categories WHERE "categoryId" = ${id}
    `;
    
    if (!existingCategory || (existingCategory as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const oldCategory = (existingCategory as any[])[0];
    
    // Update the category
    await prisma.$queryRaw`
      UPDATE categories 
      SET name = ${name.trim()}, 
          description = ${description?.trim() || null}, 
          icon = ${icon?.trim() || null},
          "isActive" = ${isActive !== undefined ? isActive : true},
          "order" = ${order !== undefined ? order : oldCategory.order},
          "updatedAt" = NOW()
      WHERE "categoryId" = ${id}
    `;
    
    // Update knowledge base entries if the category name changed
    if (oldCategory.name !== name.trim()) {
      await prisma.knowledgeBase.updateMany({
        where: { 
          category: {
            equals: oldCategory.name,
            mode: 'insensitive'
          }
        },
        data: { category: name.trim() }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Category updated successfully.`,
      category: {
        id: id,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        isActive: isActive !== undefined ? isActive : true,
        order: order !== undefined ? order : oldCategory.order,
        createdAt: oldCategory.createdAt
      }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    // Find the category to delete
    const existingCategory = await prisma.$queryRaw`
      SELECT * FROM categories WHERE "categoryId" = ${id}
    `;
    
    if (!existingCategory || (existingCategory as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }
    
    const category = (existingCategory as any[])[0];

    // Update all knowledge entries in this category to 'general'
    const updateResult = await prisma.knowledgeBase.updateMany({
      where: { 
        category: {
          equals: category.name,
          mode: 'insensitive'
        }
      },
      data: { category: 'general' }
    });

    // Delete the category (or mark as inactive)
    await prisma.$queryRaw`
      UPDATE categories 
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE "categoryId" = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: `Category deactivated successfully. ${updateResult.count} entries moved to "General".`
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
} 