// tests/backend.spec.js
import { test, expect, request } from '@playwright/test';
import fetch from 'node-fetch';
import { initFirebase } from '../config/firebase';
import dotenv from 'dotenv';
dotenv.config();

const admin = initFirebase();
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyBZV0VeOYbabNbOdRwqMDzGlkvtMUPV-Bg';

// ------------------------
// Helper: Get a valid distributor token
// ------------------------
async function getDistributorToken(uid) {
  if (!admin) throw new Error('Firebase not initialized');

  // Step 1: Create Firebase custom token
  const customToken = await admin.auth().createCustomToken(uid);

  // Step 2: Exchange for ID token
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  const data = await res.json();
  if (!data.idToken) {
    throw new Error('Failed to get ID token: ' + JSON.stringify(data));
  }

  return data.idToken;
}

// ------------------------
// Tests
// ------------------------
test.describe('Node.js Backend API Tests', () => {
  let apiContext;
  let distributorToken;

  const DISTRIBUTOR_UID = 'wid62mtewybhvQzLO1Ch0XnUPNf2';
  const DISTRIBUTOR_EMAIL = 'marketing@alloymstech.com';

  test.beforeAll(async () => {
    apiContext = await request.newContext({
      baseURL: 'http://localhost:10000',
    });

    distributorToken = await getDistributorToken(DISTRIBUTOR_UID);
    console.log('✅ Distributor token obtained for tests');
  });

  // ------------------------
  // Test GET /customer
  // ------------------------
  test('GET /customer returns 200 and a list', async () => {
    const response = await apiContext.get('/customer'); // your endpoint
    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    console.log('Customers:', responseBody);
    expect(Array.isArray(responseBody.data)).toBeTruthy();
    expect(responseBody.count).toBe(responseBody.data.length);
  });

  // ------------------------
  // Test GET /me-distributor
  // ------------------------
  test('GET /me-distributor returns distributor info', async () => {
  const response = await apiContext.get('/me-distributor', {
    headers: { Authorization: `Bearer ${distributorToken}` },
  });

  const body = await response.json();
  console.log('Status:', response.status());
  console.log('Body:', body);

  expect(response.status()).toBe(200);
  expect(body.success).toBe(true);
  expect(body.data.ROLE).toBe('distributor');
  expect(body.data.CUSTOMER_NAME).toBe('ALLOY METAL SURFACE TECHNOLOGIES');
});

  // ------------------------
  // Debug login route
  // ------------------------
  test('Debug: login via custom token', async () => {
    const response = await apiContext.get('/me-distributor', {
      headers: {
        Authorization: `Bearer ${distributorToken}`,
      },
    });

    const body = await response.json();
    console.log('Login Debug Status:', response.status());
    console.log('Login Debug Body:', body);

    expect(response.status()).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.ROLE).toBe('distributor');
    expect(body.data.CUSTOMER_NAME).toBe('ALLOY METAL SURFACE TECHNOLOGIES');
  });
});
