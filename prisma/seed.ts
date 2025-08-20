import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Create a super admin user
    const hashedPassword = await bcrypt.hash('SuperAdmin123!', 12);

    const superAdmin = await prisma.user.upsert({
        where: { email: 'admin@sectorstaff.com' },
        update: {},
        create: {
            email: 'admin@sectorstaff.com',
            passwordHash: hashedPassword,
            fullName: 'Super Administrator',
            isActive: true,
        },
    });

    console.log('✅ Created super admin user:', superAdmin.email);

    // Create a sample organization
    const organization = await prisma.organization.upsert({
        where: { name: 'Demo Organization' },
        update: {},
        create: {
            name: 'Demo Organization',
            description: 'A demo organization for testing purposes',
        },
    });

    console.log('✅ Created demo organization:', organization.name);

    // Link super admin to organization
    await prisma.organizationUser.upsert({
        where: {
            userId_organizationId: {
                userId: superAdmin.id,
                organizationId: organization.id,
            },
        },
        update: {},
        create: {
            userId: superAdmin.id,
            organizationId: organization.id,
            role: Role.SUPER_ADMIN,
        },
    });

    console.log('✅ Linked super admin to organization');

    // Create organization admin
    const orgAdminPassword = await bcrypt.hash('OrgAdmin123!', 12);
    const orgAdmin = await prisma.user.upsert({
        where: { email: 'orgadmin@demo.com' },
        update: {},
        create: {
            email: 'orgadmin@demo.com',
            passwordHash: orgAdminPassword,
            fullName: 'Organization Administrator',
            isActive: true,
        },
    });

    // Link org admin to organization
    await prisma.organizationUser.upsert({
        where: {
            userId_organizationId: {
                userId: orgAdmin.id,
                organizationId: organization.id,
            },
        },
        update: {},
        create: {
            userId: orgAdmin.id,
            organizationId: organization.id,
            role: Role.ORG_ADMIN,
        },
    });

    console.log('✅ Created organization admin user:', orgAdmin.email);

    // Create a sample branch
    const branch = await prisma.branch.upsert({
        where: {
            organizationId_name: {
                organizationId: organization.id,
                name: 'Main Branch',
            },
        },
        update: {},
        create: {
            organizationId: organization.id,
            name: 'Main Branch',
            address: '123 Main Street, City, Country',
        },
    });

    console.log('✅ Created main branch:', branch.name);

        // Create a branch admin user
    const branchAdminPassword = await bcrypt.hash('BranchAdmin123!', 12);
    const branchAdmin = await prisma.user.upsert({
        where: { email: 'branchadmin@demo.com' },
        update: {},
        create: {
            email: 'branchadmin@demo.com',
            passwordHash: branchAdminPassword,
            fullName: 'Branch Administrator',
            isActive: true,
            organizationLinks: {
                create: {
                    organizationId: organization.id,
                    role: Role.BRANCH_MANAGER,
                    managedBranches: {
                        create: {
                            branchId: branch.id,
                            assignedAt: new Date(),
                        },
                    },
                },
            },
        },
    });

    console.log('✅ Created branch admin user:', branchAdmin.email);

    // Create a sample department
    const department = await prisma.department.upsert({
        where: {
            branchId_name: {
                branchId: branch.id,
                name: 'IT Department',
            },
        },
        update: {},
        create: {
            branchId: branch.id,
            name: 'IT Department',
        },
    });

    console.log('✅ Created IT department:', department.name);

    // Create a test device
    const testDevice = await prisma.device.upsert({
        where: {
            id: 'test-device-001',
        },
        update: {},
        create: {
            id: 'test-device-001',
            organizationId: organization.id,
            branchId: branch.id,
            name: 'Test Camera 001',
            type: 'CAMERA',
            status: 'ONLINE',
            macAddress: '00:11:22:33:44:55',
            host: '192.168.1.100',
            model: 'DS-2CD2143G0-I',
            description: 'Hikvision test camera for event processing',
        },
    });

    console.log('✅ Created test device:', testDevice.name);

    console.log('🎉 Database seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Error during database seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });