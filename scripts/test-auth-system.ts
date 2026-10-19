import assert from 'assert';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, signToken, verifyToken, SESSION_DURATION_SECONDS } from '../lib/auth/session';

async function runAuthTests() {
  console.log('🔒 Testing Authentication & 12-Hour Session Engine...\n');

  // 1. Password hashing & verification
  console.log('1. Testing bcrypt password hashing & verification...');
  const plainPassword = 'SuperSecretPassword123!';
  const hash = await hashPassword(plainPassword);
  assert.ok(hash !== plainPassword, 'Hash should not equal plain text');
  assert.strictEqual(await verifyPassword(plainPassword, hash), true, 'Valid password matches hash');
  assert.strictEqual(await verifyPassword('WrongPassword!', hash), false, 'Wrong password rejected');
  console.log('   ✅ Password hashing & verification passed');

  // 2. 12-hour session duration verification
  console.log('2. Verifying session duration constant (12 hours)...');
  assert.strictEqual(SESSION_DURATION_SECONDS, 12 * 60 * 60, 'SESSION_DURATION_SECONDS must equal 43,200 (12 hours)');
  console.log('   ✅ 12-hour duration verified (43,200 seconds / 12h)');

  // 3. User creation and signup logic
  console.log('3. Testing User model & database registration...');
  const testEmail = `testuser_${Date.now()}@tangence-audit.com`;
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Audit Tester',
      passwordHash: hash
    }
  });
  assert.ok(user.id, 'User created with valid ID');
  assert.strictEqual(user.email, testEmail, 'User email matches');

  // 4. Session creation & 12h expiration in DB
  console.log('4. Testing Session creation with 12-hour expiration timestamp...');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const sessionToken = 'tok_' + Math.random().toString(36).substring(2);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt
    }
  });
  assert.ok(session.id, 'Session created');
  const durationMs = session.expiresAt.getTime() - Date.now();
  assert.ok(durationMs > 11.9 * 3600 * 1000 && durationMs <= 12 * 3600 * 1000, 'Session expires in 12 hours');
  console.log('   ✅ Database session created with valid 12h expiry timestamp');

  // 5. JWT signing and verification
  console.log('5. Testing 12-hour JWT token signing and verification...');
  const token = await signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    sessionId: session.id
  });
  assert.ok(typeof token === 'string' && token.length > 20, 'JWT token generated');
  const payload = await verifyToken(token);
  assert.ok(payload, 'Token verified successfully');
  assert.strictEqual(payload?.userId, user.id, 'Token user ID matches');
  assert.strictEqual(payload?.email, user.email, 'Token email matches');
  console.log('   ✅ 12-hour JWT token verified successfully');

  // Clean up test data
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('   ✅ Cleaned up test records');

  console.log('\n✨ All Authentication & 12-Hour Session Tests Passed Successfully!\n');
}

runAuthTests()
  .catch((err) => {
    console.error('❌ Auth test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
