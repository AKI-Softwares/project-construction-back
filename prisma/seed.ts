import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {

    const pCreate = await prisma.permission.upset({
        where: { id: 1 }, update: {},
        create: { action: 'post:create' },
    })

    
    const pUpdate = await prisma.permission.upset({
        where: { id: 3 }, update: {},
        create: { action: 'post:update' },
    })
    
    const pRead = await prisma.permission.upset({
        where: { id: 4 }, update: {},
        create: { action: 'post:read' },
    })

    const pDelete = await prisma.permission.upset({
        where: { id: 2 }, update: {},
        create: { action: 'post:delete' },
    })

    
}