import { NextRequest, NextResponse } from 'next/server';
import { getReport, deleteReport } from '@/lib/reports';
import { validateAccessKey, unauthorizedResponse } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAccessKey(request)) return unauthorizedResponse();

  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return NextResponse.json(report);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAccessKey(request)) return unauthorizedResponse();

  const { id } = await params;
  const deleted = await deleteReport(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
