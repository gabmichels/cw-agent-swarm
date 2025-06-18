import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { Department } from '../../../types/organization';

const prisma = new PrismaClient();

/**
 * GET /api/departments
 * Fetch all departments from the database
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Fetching departments from database...');
    
    // Fetch departments from Prisma
    const prismaDeparts = await prisma.department.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`Found ${prismaDeparts.length} departments in database`);
    
    // Transform Prisma departments to our Department interface
    const departments: Department[] = prismaDeparts.map(dept => ({
      id: dept.id,
      name: dept.name,
      description: dept.description || undefined,
      code: dept.code || dept.name.substring(0, 3).toUpperCase(),
      isActive: dept.isActive,
      budgetLimit: dept.budgetLimit || 0,
      currentSpent: dept.currentSpent || 0,
      currency: dept.currency || 'USD',
      managerId: dept.managerId || undefined,
      parentDepartmentId: dept.parentDepartmentId,
      agents: [], // Will be populated by agents with department references
      subDepartments: [], // Will be populated by child departments
      teams: [], // Will be populated by teams
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt
    }));
    
    return NextResponse.json({
      success: true,
      departments,
      count: departments.length
    });
    
  } catch (error) {
    console.error('Error fetching departments:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch departments',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/departments
 * Create a new department
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, code, budgetLimit, currency, managerId, parentDepartmentId } = body;
    
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Department name is required'
      }, { status: 400 });
    }
    
    console.log('Creating new department:', { name, code });
    
    // Create department in Prisma
    const newDepartment = await prisma.department.create({
      data: {
        name,
        description,
        code: code || name.substring(0, 3).toUpperCase(),
        budgetLimit: budgetLimit || 0,
        currency: currency || 'USD',
        managerId,
        parentDepartmentId,
        isActive: true
      }
    });
    
    // Transform to our Department interface
    const department: Department = {
      id: newDepartment.id,
      name: newDepartment.name,
      description: newDepartment.description || undefined,
      code: newDepartment.code || newDepartment.name.substring(0, 3).toUpperCase(),
      isActive: newDepartment.isActive,
      budgetLimit: newDepartment.budgetLimit || 0,
      currentSpent: newDepartment.currentSpent || 0,
      currency: newDepartment.currency || 'USD',
      managerId: newDepartment.managerId || undefined,
      parentDepartmentId: newDepartment.parentDepartmentId,
      agents: [],
      subDepartments: [],
      teams: [],
      createdAt: newDepartment.createdAt,
      updatedAt: newDepartment.updatedAt
    };
    
    console.log('Created department:', department.id);
    
    return NextResponse.json({
      success: true,
      department
    });
    
  } catch (error) {
    console.error('Error creating department:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create department',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 