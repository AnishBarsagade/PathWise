const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const dbService = require('../src/services/dbService');
const config = require('../src/config/env');

describe('Task 1 — Admin & Rider Authentication System', () => {
  const adminCredentials = {
    email: 'admin@pathwise.com',
    password: 'PathWise@123',
  };

  const riderCredentials = {
    email: 'rider@test.com',
    password: 'test123',
  };

  beforeAll(async () => {
    // Ensure rider test account exists for tests
    const existingRider = dbService.findUserByEmail(riderCredentials.email);
    if (!existingRider) {
      const hash = await bcrypt.hash(riderCredentials.password, 10);
      dbService.createUser({
        name: 'Test Rider',
        email: riderCredentials.email,
        passwordHash: hash,
        role: 'rider',
      });
    }
  });

  // 1. Valid Admin login succeeds and returns the correct role.
  it('1. Valid Admin login succeeds and returns Admin role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(adminCredentials);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.email).toBe('admin@pathwise.com');
  });

  // 2. Valid Rider login succeeds and returns the correct role.
  it('2. Valid Rider login succeeds and returns Rider role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(riderCredentials);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.role).toBe('rider');
    expect(res.body.user.email).toBe('rider@test.com');
  });

  // 3. Wrong password is rejected.
  it('3. Wrong password is rejected with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@pathwise.com',
        password: 'WrongPassword!999',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication Failed');
    expect(res.body.message).toContain('Invalid email or password');
  });

  // 4. Unknown email is rejected.
  it('4. Unknown email is rejected with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent_user@pathwise.com',
        password: 'SomePassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication Failed');
    expect(res.body.message).toContain('Invalid email or password');
  });

  // 5. Duplicate email signup is rejected.
  it('5. Duplicate email signup is rejected with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Duplicate User',
        email: 'admin@pathwise.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Registration Failed');
    expect(res.body.message).toContain('already exists');
  });

  // 6. Invalid email is rejected.
  it('6. Invalid email format is rejected with 400 Validation Error', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Invalid Email',
        email: 'invalid-email-format',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.message).toContain('Invalid email format');
  });

  // 7. Missing required signup fields are rejected.
  it('7. Missing required signup fields are rejected with 400 Validation Error', async () => {
    const res1 = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com' });
    expect(res1.status).toBe(400);
    expect(res1.body.error).toBe('Validation Error');

    const res2 = await request(app)
      .post('/api/auth/signup')
      .send({ password: 'Password123!' });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toBe('Validation Error');
  });

  // 8. Password and confirmation mismatch is rejected.
  it('8. Password and confirmation mismatch is rejected with 400 Validation Error', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Mismatch User',
        email: 'mismatch@test.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword456!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.message).toContain('Passwords do not match');
  });

  // 9. Public signup cannot create an Admin account by injecting "role": "admin".
  it('9. Public signup forces Rider role even if "role": "admin" is injected', async () => {
    const uniqueEmail = `inject_${Date.now()}@test.com`;
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Attacker Attempting Admin',
        email: uniqueEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'admin',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('rider');

    // Confirm in database directly
    const stored = dbService.findUserByEmail(uniqueEmail);
    expect(stored.role).toBe('rider');
  });

  // 10. Protected endpoint rejects a missing or invalid JWT.
  it('10. Protected endpoint rejects a missing or invalid JWT with 401 Unauthorized', async () => {
    // Missing token
    const resNoAuth = await request(app).get('/api/auth/me');
    expect(resNoAuth.status).toBe(401);
    expect(resNoAuth.body.error).toBe('Unauthorized');

    // Invalid/garbage token
    const resBadAuth = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.value');
    expect(resBadAuth.status).toBe(401);
    expect(resBadAuth.body.error).toBe('Unauthorized');
  });

  // 11. Rider cannot access Admin-only endpoints.
  it('11. Rider cannot access Admin-only endpoints (returns 403 Forbidden)', async () => {
    const riderToken = jwt.sign(
      { id: 999, email: 'rider@test.com', role: 'rider' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Fleet-wide optimization endpoint
    const resOptimize = await request(app)
      .post('/api/optimize')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({});
    expect(resOptimize.status).toBe(403);
    expect(resOptimize.body.error).toBe('Forbidden');

    // Demo data seed endpoint
    const resSeed = await request(app)
      .post('/api/demo/seed')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({});
    expect(resSeed.status).toBe(403);
    expect(resSeed.body.error).toBe('Forbidden');
  });

  // 12. Rider cannot access another Rider's assignments by manipulating an ID.
  it('12. Rider cannot access another Rider assignments by manipulating an ID in request', async () => {
    const riderToken = jwt.sign(
      { id: 10, email: 'rider10@test.com', role: 'rider' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Rider 10 attempts to view Rider 20's private assignments
    const res = await request(app)
      .get('/api/rider/assignments/20')
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain("Cannot view another rider's assignments");
  });

  // 13. Admin can access authorized administrative endpoints.
  it('13. Admin can access authorized administrative endpoints', async () => {
    const adminToken = jwt.sign(
      { id: 1, email: 'admin@pathwise.com', role: 'admin' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Admin can access rider assignments for any user
    const resAssignments = await request(app)
      .get('/api/rider/assignments/999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAssignments.status).toBe(200);
    expect(resAssignments.body).toHaveProperty('deliveries');

    // Admin can access /api/auth/me
    const resMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resMe.status).toBe(200);
    expect(resMe.body.role).toBe('admin');
  });

  // 14. Password hashes are stored instead of plaintext and are never returned to clients.
  it('14. Password hashes are stored securely with bcrypt and never returned to clients', async () => {
    const testEmail = `hashcheck_${Date.now()}@test.com`;
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Hash Check User',
        email: testEmail,
        password: 'SecretPassword@123',
        confirmPassword: 'SecretPassword@123',
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user).not.toHaveProperty('password');
    expect(signupRes.body.user).not.toHaveProperty('password_hash');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'SecretPassword@123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).not.toHaveProperty('password');
    expect(loginRes.body.user).not.toHaveProperty('password_hash');

    // Verify stored record in SQLite has bcrypt hash, not plaintext
    const dbRecord = dbService.findUserByEmail(testEmail);
    expect(dbRecord.password_hash).not.toBe('SecretPassword@123');
    expect(dbRecord.password_hash.startsWith('$2b$')).toBe(true);
    expect(await bcrypt.compare('SecretPassword@123', dbRecord.password_hash)).toBe(true);
  });

  // 15. Logout and refresh behavior work with the current authentication design.
  it('15. Logout and refresh behavior validate token expiry and identity verification', async () => {
    // A valid token returns identity via GET /api/auth/me (refresh flow)
    const validToken = jwt.sign(
      { id: 1, email: 'admin@pathwise.com', role: 'admin' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.email).toBe('admin@pathwise.com');

    // Simulated expired token
    const expiredToken = jwt.sign(
      { id: 1, email: 'admin@pathwise.com', role: 'admin' },
      config.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const expiredRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error).toBe('Unauthorized');
  });

  // Rider workflow smoke test: newrider signup + login + empty assignments state
  it('Rider workflow: newrider signup, login, and assignment empty state', async () => {
    const newRiderEmail = `newrider_${Date.now()}@test.com`;
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'New Rider',
        email: newRiderEmail,
        password: 'RiderTest@123',
        confirmPassword: 'RiderTest@123',
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user.role).toBe('rider');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: newRiderEmail,
        password: 'RiderTest@123',
      });

    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    // Fetch assignment for rider with no assignments -> clear empty state
    const assignmentsRes = await request(app)
      .get('/api/rider/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(assignmentsRes.status).toBe(200);
    expect(assignmentsRes.body.vehicle).toBeNull();
    expect(assignmentsRes.body.deliveries).toEqual([]);
    expect(assignmentsRes.body.message).toContain('No vehicle or deliveries currently assigned');
  });
});

