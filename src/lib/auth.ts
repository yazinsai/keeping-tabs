import { NextRequest, NextResponse } from 'next/server';

export function validateAccessKey(request: NextRequest): boolean {
  const key = request.headers.get('x-access-key');
  const expected = process.env.ACCESS_KEY;
  if (!expected) return true; // No key configured = no protection
  return key === expected;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
