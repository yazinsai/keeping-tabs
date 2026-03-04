import { NextRequest, NextResponse } from 'next/server';
import { validateAccessKey } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const valid = validateAccessKey(request);
  return NextResponse.json({ valid });
}
