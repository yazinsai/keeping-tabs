import { NextRequest, NextResponse } from 'next/server';
import { getReport } from '@/lib/reports';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return NextResponse.json(report);
}
