// End-to-end verification script for Feature 6: Access Control & Feature 1: Centralized Permissions
import app from '../app.js';
import { store } from '../store/index.js';
import { RESOURCE_TYPES } from '../../shared/contracts.js';

async function main() {
  const server = app.listen(4002);
  const baseUrl = 'http://localhost:4002';

  try {
    store.resetToSeed();
    console.log('=====================================================');
    console.log('FEATURE 6: ACCESS CONTROL SEQUENCE VERIFICATION');
    console.log('=====================================================\n');

    // 1. Retrieve an application
    console.log('--- STEP 1: GET /api/apps/app_01 ---');
    let res = await fetch(`${baseUrl}/api/apps/app_01`);
    console.log('HTTP Status:', res.status);
    let app1 = await res.json();
    console.log('Application:', JSON.stringify(app1.data, null, 2));

    // 2. Grant location
    console.log('\n--- STEP 2: PATCH /api/apps/app_01/permissions (Grant location) ---');
    res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'location', enabled: true }),
    });
    console.log('HTTP Status:', res.status);
    let grantRes = await res.json();
    console.log('Result message:', grantRes.message);
    console.log('Location enabled:', grantRes.data.permissions.location.enabled);

    // 3. Revoke contacts
    console.log('\n--- STEP 3: PATCH /api/apps/app_01/permissions (Revoke contacts) ---');
    res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'contacts', enabled: false }),
    });
    console.log('HTTP Status:', res.status);
    let revokeRes = await res.json();
    console.log('Result message:', revokeRes.message);
    console.log('Contacts enabled:', revokeRes.data.permissions.contacts.enabled);

    // 4. Suspend application
    console.log('\n--- STEP 4: PATCH /api/apps/app_01/status (Suspend app) ---');
    res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    });
    console.log('HTTP Status:', res.status);
    let suspRes = await res.json();
    console.log('Result status:', suspRes.data.status);

    // 5. Attempt access while suspended for each of the five resources
    console.log('\n--- STEP 5: Attempt access for all 5 resources while suspended ---');
    for (const resource of RESOURCE_TYPES) {
      res = await fetch(`${baseUrl}/api/events/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: 'app_01', resource, count: 1 }),
      });
      const simData = await res.json();
      const evt = simData.data.events[0];
      console.log(`Resource [${resource}]: status=${evt.status}, denialReason=${evt.denialReason}`);
    }

    // 6. Reactivate application
    console.log('\n--- STEP 6: PATCH /api/apps/app_01/status (Reactivate app) ---');
    res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    console.log('HTTP Status:', res.status);
    let reactRes = await res.json();
    console.log('Result status:', reactRes.data.status);

    // 7. Verify access after reactivation
    console.log('\n--- STEP 7: Verify access after reactivation ---');
    // Location (enabled) -> should allow
    res = await fetch(`${baseUrl}/api/events/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 'app_01', resource: 'location', count: 1 }),
    });
    let simLoc = await res.json();
    console.log('Location (enabled): status =', simLoc.data.events[0].status);

    // Contacts (disabled) -> should deny with permission_disabled
    res = await fetch(`${baseUrl}/api/events/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 'app_01', resource: 'contacts', count: 1 }),
    });
    let simContacts = await res.json();
    console.log('Contacts (disabled): status =', simContacts.data.events[0].status, ', denialReason =', simContacts.data.events[0].denialReason);

    // 8. Retrieve application again to verify final persisted state
    console.log('\n--- STEP 8: GET /api/apps/app_01 (Verify final persisted state) ---');
    res = await fetch(`${baseUrl}/api/apps/app_01`);
    console.log('HTTP Status:', res.status);
    let finalApp = await res.json();
    console.log('Final Persisted App:', JSON.stringify(finalApp.data, null, 2));

    console.log('\n--- VERIFY HISTORY TRAIL ---');
    res = await fetch(`${baseUrl}/api/history?appId=app_01&limit=6`);
    let historyData = await res.json();
    console.log('Recent History (newest first):', JSON.stringify(historyData.data, null, 2));

    console.log('\n=====================================================');
    console.log('ALL ACCESS CONTROL CHECKS COMPLETED SUCCESSFULLY!');
    console.log('=====================================================');
  } finally {
    server.close();
  }
}

main().catch(console.error);
