import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LeadStatus,
  LeadSource,
} from '@/lib/validations/lead'

// GET /api/leads/export - Descarga los leads como archivo Excel (.xlsx)
// Respeta los mismos filtros que GET /api/leads para que lo descargado
// coincida con lo que el usuario está viendo en pantalla.
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status') || ''

    const where: Prisma.ContactRequestWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (LEAD_STATUSES.includes(status as LeadStatus)) {
      where.status = status as LeadStatus
    }

    const leads = await prisma.contactRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Xenith CRM'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Leads', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    sheet.columns = [
      { header: 'Nombre', key: 'name', width: 28 },
      { header: 'Correo', key: 'email', width: 34 },
      { header: 'Teléfono', key: 'phone', width: 20 },
      { header: 'Empresa', key: 'company', width: 28 },
      { header: 'Notas', key: 'message', width: 60 },
      { header: 'Estado', key: 'status', width: 16 },
      { header: 'Origen', key: 'source', width: 12 },
      { header: 'Fecha de registro', key: 'createdAt', width: 20 },
    ]

    leads.forEach((lead) => {
      sheet.addRow({
        name: lead.name,
        // Prefijo apóstrofe evita que Excel convierta el teléfono en número
        // y se coma los ceros o el "+" del indicativo.
        phone: lead.phone ? `'${lead.phone}` : '',
        email: lead.email,
        company: lead.company ?? '',
        message: lead.message ?? '',
        status: LEAD_STATUS_LABELS[lead.status as LeadStatus] ?? lead.status,
        source: LEAD_SOURCE_LABELS[lead.source as LeadSource] ?? lead.source,
        createdAt: lead.createdAt,
      })
    })

    // Encabezado con estilo
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
    headerRow.height = 22

    sheet.getColumn('message').alignment = { wrapText: true, vertical: 'top' }
    sheet.getColumn('createdAt').numFmt = 'dd/mm/yyyy hh:mm'

    // Autofiltro sobre todas las columnas con datos
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `Leads-Xenith-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting leads:', error)
    return NextResponse.json(
      { error: 'Error al exportar los leads' },
      { status: 500 }
    )
  }
}
