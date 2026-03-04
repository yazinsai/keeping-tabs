import { NextRequest, NextResponse } from 'next/server';
import { listReports } from '@/lib/reports';
import { validateAccessKey, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!validateAccessKey(request)) return unauthorizedResponse();

  const reports = await listReports();
  return NextResponse.json(reports);
}
