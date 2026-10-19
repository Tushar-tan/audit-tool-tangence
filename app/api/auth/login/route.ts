import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signToken, COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Please enter both email and password.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Clean up expired sessions for this user
    try {
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
          expiresAt: { lt: new Date() }
        }
      });
    } catch {
      // Non-fatal
    }

    // Create 12-hour session
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt
      }
    });

    // Sign JWT token with 12h expiration
    const jwt = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      sessionId: session.id
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully! 12-hour audit session active.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

    // Set 12-hour HttpOnly session cookie
    response.cookies.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS // 12 hours (43,200 seconds)
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
