// End-to-end verification script for Feature 1: Centralized Permission Management
import app from '../app.js';
import { store } from '../store/index.js';

async function main() {
  const server = app.listen(4001);
  const baseUrl = 'http://localhost:4001';

  try {
    store.resetToSeed();
    console.log('=== 1. TEST GET /api/apps ===');
    let res = await fetch(`${baseUrl}/api/apps`);
    console.log('Status:', res.status);
    let data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2));

    console.log('\n=== 2. TEST GET /api/apps/app_01 ===');
    res = await fetch(`${baseUrl}/api/apps/app_01`);
    console.log('Status:', res.status);
    data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2));

    console.log('\n=== 3. TEST PATCH /api/apps/app_01/permissions (Grant contacts) ===');
    res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'contacts', enabled: true }),
    });
    console.log('Status:', res.status);
    data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2));

    console.log('\n=== 4. TEST PATCH /api/apps/app_01/permissions (Revoke location) ===');
    res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'location', enabled: false }),
    });
    console.log('Status:', res.status);
    data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2));

    console.log('\n=== 5. TEST INVALID REQUEST (Invalid resource) ===');
    res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'social_media', enabled: true }),
    });
    console.log('Status:', res.status);
    data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2));

    console.log('\n=== 6. TEST UNKNOWN APP ID ===');
    res = await fetch(`${baseUrl}/api/apps/app_999`);
    console.log('Status:', res.status);
    data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2));

    console.log('\n=== 7. VERIFY PERSISTENCE (GET /api/apps/app_01 after modifications) ===');
    res = await fetch(`${baseUrl}/api/apps/app_01`);
    console.log('Status:', res.status);
    data = await res.json();
    console.log('Location enabled:', data.data.permissions.location.enabled);
    console.log('Contacts enabled:', data.data.permissions.contacts.enabled);

    console.log('\n=== 8. SIMULATE ACCESS REQUEST FOR REVOKED PERMISSION ===');
    res = await fetch(`${baseUrl}/api/events/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 'app_01', resource: 'location', count: 1 }),
    });
    console.log('Status:', res.status);
    data = await res.json();
    console.log('Simulate Body:', JSON.stringify(data, null, 2));

    console.log('\n=== 9. SUSPEND APP AND VERIFY ACCESS DENIAL ===');
    res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    });
    console.log('Status:', res.status);
    data = await res.json();
    console.log('App Status:', data.data.status);

    res = await fetch(`${baseUrl}/api/events/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 'app_01', resource: 'contacts', count: 1 }),
    });
    data = await res.json();
    console.log('Suspended App Access Result:', JSON.stringify(data.data.events[0], null, 2));

    console.log('\n=== 10. REACTIVATE APP AND VERIFY REVOKED PERMISSION STILL DISABLED ===');
    res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    data = await res.json();
    console.log('Reactivated App Location:', data.data.permissions.location.enabled);
    console.log('Reactivated App Contacts:', data.data.permissions.contacts.enabled);

    console.log('\n=== 11. CHECK HISTORY ===');
    res = await fetch(`${baseUrl}/api/history?appId=app_01&limit=5`);
    data = await res.json();
    console.log('Recent History (5 entries):', JSON.stringify(data.data, null, 2));

  } finally {
    server.close();
  }
}

main().catch(console.error);
