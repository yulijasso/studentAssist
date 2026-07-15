import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Clerk auth is handled client-side via useAuth() hooks in dashboard pages.
// Next.js 16 proxy replaces middleware — Clerk's clerkMiddleware() is not
// compatible with the proxy API yet, so dashboard route protection happens
// in the layout/page components themselves.
export default function proxy(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
