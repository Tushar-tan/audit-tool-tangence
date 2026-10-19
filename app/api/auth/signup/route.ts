import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signToken, COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please log in.' },
        { status: 409 }
      );
    }

    // Hash password & create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: (name && typeof name === 'string') ? name.trim() : null,
        passwordHash
      }
    });

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

    // Sign JWT token
    const jwt = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      sessionId: session.id
    });

    // Create response with 12-hour HttpOnly cookie
    const response = NextResponse.json(
      {
        success: true,
        message: 'Account successfully created! Redirecting to audit dashboard...',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 201 }
    );

    response.cookies.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS // 12 hours (43,200 seconds)
    });

    return response;
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
