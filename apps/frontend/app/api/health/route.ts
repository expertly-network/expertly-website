import { NextResponse } from 'next/server';

// Deploy healthcheck target, independent of other routes.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
