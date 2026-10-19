import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken, COOKIE_NAME } from '@/lib/auth/session';

export async function POST() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.sessionId) {
        await prisma.session.delete({
          where: { id: payload.sessionId }
        }).catch(() => {});
      }
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // Expire immediately
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Logout failed' }, { status: 500 });
  }
}
