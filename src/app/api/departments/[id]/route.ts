import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/departments/[id] - Get a specific department
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const department = await prisma.department.findUnique({
      where: { id },
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

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      department
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch department' },
      { status: 500 }
    );
  }
}

// PUT /api/departments/[id] - Update a department
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    const { 
      name, 
      description, 
      code, 
      isActive,
      budgetLimit, 
      currency,
      managerId,
      parentDepartmentId 
    } = body;

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id }
    });

    if (!existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name/code (excluding current department)
    if (name || code) {
      const duplicateDepartment = await prisma.department.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(name ? [{ name }] : []),
                ...(code ? [{ code }] : [])
              ]
            }
          ]
        }
      });

      if (duplicateDepartment) {
        return NextResponse.json(
          { success: false, error: 'Department with this name or code already exists' },
          { status: 409 }
        );
      }
    }

    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(code !== undefined && { code }),
        ...(isActive !== undefined && { isActive }),
        ...(budgetLimit !== undefined && { budgetLimit: budgetLimit ? parseFloat(budgetLimit) : null }),
        ...(currency !== undefined && { currency }),
        ...(managerId !== undefined && { managerId }),
        ...(parentDepartmentId !== undefined && { parentDepartmentId })
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
      department: updatedDepartment,
      message: 'Department updated successfully'
    });
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id] - Delete/deactivate a department
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id },
      include: {
        subDepartments: {
          where: { isActive: true }
        }
      }
    });

    if (!existingDepartment) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check if department has active sub-departments
    if (existingDepartment.subDepartments.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete department with active sub-departments' },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const deletedDepartment = await prisma.department.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      department: deletedDepartment,
      message: 'Department deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete department' },
      { status: 500 }
    );
  }
} 