import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/departments - List all departments
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        parentDepartment: {
          select: { id: true, name: true }
        },
        subDepartments: {
          select: { id: true, name: true },
          where: { isActive: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      departments,
      count: departments.length
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST /api/departments - Create a new department
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      description, 
      code, 
      budgetLimit, 
      currency = 'USD',
      managerId,
      parentDepartmentId 
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Department name is required' },
        { status: 400 }
      );
    }

    // Check if department with same name or code already exists
    const existingDepartment = await prisma.department.findFirst({
      where: {
        OR: [
          { name: name },
          ...(code ? [{ code: code }] : [])
        ]
      }
    });

    if (existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department with this name or code already exists' },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
        code,
        budgetLimit: budgetLimit ? parseFloat(budgetLimit) : null,
        currency,
        managerId,
        parentDepartmentId
      },
      include: {
        parentDepartment: {
          select: { id: true, name: true }
        },
        subDepartments: {
          select: { id: true, name: true },
          where: { isActive: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      department,
      message: 'Department created successfully'
    });
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create department' },
      { status: 500 }
    );
  }
} 