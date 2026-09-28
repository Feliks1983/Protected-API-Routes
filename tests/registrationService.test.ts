describe('RegistrationService', () => {
  test('should register a new user successfully', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'Password123!',
      username: 'testuser',
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
    };

    const result = await registrationService.registerUser(userData);

    expect(result.success).toBe(true);
    expect(result.data.email).toBe('test@example.com');
    expect(result.data.isEmailVerified).toBe(false);
  });

  test('should reject duplicate email', async () => {
    // First registration
    await registrationService.registerUser(userData);

    // Duplicate registration
    const result = await registrationService.registerUser(userData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });
});
