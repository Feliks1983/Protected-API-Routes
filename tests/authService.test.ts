const request = require('supertest');
const app = require('../app');

describe('Authentication', () => {
  test('should register a new user', async () => {
    const response = await request(app).post('/api/register').send({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe('test@example.com');
  });

  test('should login with valid credentials', async () => {
    // First register a user...
    await request(app).post('/api/register').send(userData);

    const response = await request(app).post('/api/login').send({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
