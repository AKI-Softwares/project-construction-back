import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {

    const actions = ['post:create', 'post:update', 'post:read', 'post:delete'];

    await Promise.all(
        actions.map(action =>
            prisma.permission.upsert({
                where: { action },
                update: {},
                create: { action }
            })
        )
    );

    await prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: {
            name: 'ADMIN',
            permissions: { connect: [{ action: 'post:create' }, { action: 'post:update' }, { action: 'post:read' }, { action: 'post:delete' }] }
        }
    })

    await prisma.role.upsert({
        where: { name: 'DIRECTOR' },
        update: {},
        create: {
            name: 'DIRECTOR',
            permissions: { connect: [{ action: 'post:create' }, { action: 'post:update' }, { action: 'post:read' }, { action: 'post:delete' }] }
        }
    })

    await prisma.role.upsert({
        where: { name: 'MANAGER' },
        update: {},
        create: {
            name: 'MANAGER',
            permissions: { connect: [{ action: 'post:create' }, { action: 'post:update' }, { action: 'post:read' }] }
        }
    })

    await prisma.role.upsert({
        where: { name: 'USER' },
        update: {},
        create: {
            name: 'USER',
            permissions: { connect: [{ action: 'post:update' }, { action: 'post:read' }] }
        }
    })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })