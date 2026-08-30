# HIPAA Security Rule — Compliance Reference

A complete breakdown of the HIPAA Security Rule (45 CFR Part 164, Subpart C) for reference when building HIPAA-compliant features. This document covers every standard and implementation specification across all five sections of the Security Rule.

**Important distinctions:**
- **Required** = Must be implemented. No exceptions.
- **Addressable** = Must be implemented OR you must document why it's not reasonable/appropriate in your environment AND implement an equivalent alternative. **Addressable does NOT mean optional.**
- **Standard (no specs)** = The standard itself is required; there are no separate implementation specifications — the standard must be met as a whole.

**Regulatory sources:**
- [45 CFR § 164.308 — Administrative Safeguards](https://www.law.cornell.edu/cfr/text/45/164.308)
- [45 CFR § 164.310 — Physical Safeguards](https://www.law.cornell.edu/cfr/text/45/164.310)
- [45 CFR § 164.312 — Technical Safeguards](https://www.law.cornell.edu/cfr/text/45/164.312)
- [45 CFR § 164.314 — Organizational Requirements](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C)
- [45 CFR § 164.316 — Policies and Procedures / Documentation](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C)
- [HHS Summary of the HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule](https://csrc.nist.gov/pubs/sp/800/66/r2/final)

---

## 1. Administrative Safeguards — § 164.308

Administrative actions, policies, and procedures to manage the selection, development, implementation, and maintenance of security measures to protect ePHI and to manage the conduct of the covered entity's workforce.

### § 164.308(a)(1) — Security Management Process

*Implement policies and procedures to prevent, detect, contain, and correct security violations.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Risk Analysis** | **Required** | Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI held by the entity |
| B | **Risk Management** | **Required** | Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level |
| C | **Sanction Policy** | **Required** | Apply appropriate sanctions against workforce members who fail to comply with the entity's security policies and procedures |
| D | **Information System Activity Review** | **Required** | Implement procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports |

### § 164.308(a)(2) — Assigned Security Responsibility

| | Standard (no separate specs) | **Required** | Identify the security official who is responsible for the development and implementation of security policies and procedures |

### § 164.308(a)(3) — Workforce Security

*Implement policies and procedures to ensure that all members of the workforce have appropriate access to ePHI and to prevent those who do not have access from obtaining access.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Authorization and/or Supervision** | Addressable | Implement procedures for the authorization and/or supervision of workforce members who work with ePHI |
| B | **Workforce Clearance Procedure** | Addressable | Implement procedures to determine that a workforce member's access to ePHI is appropriate |
| C | **Termination Procedures** | Addressable | Implement procedures for terminating access to ePHI when employment or arrangement ends |

### § 164.308(a)(4) — Information Access Management

*Implement policies and procedures for authorizing access to ePHI consistent with the Privacy Rule.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Isolating Healthcare Clearinghouse Functions** | **Required** | If a healthcare clearinghouse is part of a larger organization, the clearinghouse must implement policies and procedures that protect ePHI from unauthorized access by the larger organization |
| B | **Access Authorization** | Addressable | Implement policies and procedures for granting access to ePHI (e.g., through a workstation, transaction, program, or process) |
| C | **Access Establishment and Modification** | Addressable | Implement policies and procedures that establish, document, review, and modify a user's right of access to a workstation, transaction, program, or process based on the entity's access authorization policies |

### § 164.308(a)(5) — Security Awareness and Training

*Implement a security awareness and training program for all members of the workforce (including management).*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Security Reminders** | Addressable | Periodic security updates (e.g., emails, bulletins, meetings) |
| B | **Protection from Malicious Software** | Addressable | Procedures for guarding against, detecting, and reporting malicious software |
| C | **Log-in Monitoring** | Addressable | Procedures for monitoring log-in attempts and reporting discrepancies |
| D | **Password Management** | Addressable | Procedures for creating, changing, and safeguarding passwords |

### § 164.308(a)(6) — Security Incident Procedures

*Implement policies and procedures to address security incidents.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Response and Reporting** | **Required** | Identify and respond to suspected or known security incidents; mitigate harmful effects to the extent practicable; document security incidents and their outcomes |

### § 164.308(a)(7) — Contingency Plan

*Establish (and implement as needed) policies and procedures for responding to an emergency or other occurrence that damages systems containing ePHI.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Data Backup Plan** | **Required** | Establish and implement procedures to create and maintain retrievable exact copies of ePHI |
| B | **Disaster Recovery Plan** | **Required** | Establish (and implement as needed) procedures to restore any loss of data |
| C | **Emergency Mode Operation Plan** | **Required** | Establish (and implement as needed) procedures to enable continuation of critical business processes for protection of ePHI while operating in emergency mode |
| D | **Testing and Revision Procedures** | Addressable | Implement procedures for periodic testing and revision of contingency plans |
| E | **Applications and Data Criticality Analysis** | Addressable | Assess the relative criticality of specific applications and data in support of other contingency plan components |

### § 164.308(a)(8) — Evaluation

| | Standard (no separate specs) | **Required** | Perform periodic technical and nontechnical evaluation in response to environmental or operational changes affecting the security of ePHI, to establish the extent to which the entity's security policies and procedures meet the Security Rule requirements |

### § 164.308(b) — Business Associate Contracts and Other Arrangements

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Written Contract or Other Arrangement** | **Required** | Document satisfactory assurances through a written contract or other arrangement with the business associate that meets the requirements of § 164.314(a) |

---

## 2. Physical Safeguards — § 164.310

Physical measures, policies, and procedures to protect electronic information systems and related buildings and equipment from natural and environmental hazards and unauthorized intrusion.

### § 164.310(a)(1) — Facility Access Controls

*Implement policies and procedures to limit physical access to electronic information systems and the facilities in which they are housed, while ensuring that properly authorized access is allowed.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Contingency Operations** | Addressable | Establish procedures that allow facility access in support of restoration of lost data under the disaster recovery and emergency mode operations plans |
| B | **Facility Security Plan** | Addressable | Implement policies and procedures to safeguard the facility and equipment from unauthorized physical access, tampering, and theft |
| C | **Access Control and Validation Procedures** | Addressable | Implement procedures to control and validate a person's access to facilities based on their role or function, including visitor control |
| D | **Maintenance Records** | Addressable | Implement policies and procedures to document repairs and modifications to the physical components of a facility related to security |

### § 164.310(b) — Workstation Use

| | Standard (no separate specs) | **Required** | Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation or class of workstation that can access ePHI |

### § 164.310(c) — Workstation Security

| | Standard (no separate specs) | **Required** | Implement physical safeguards for all workstations that access ePHI, to restrict access to authorized users |

### § 164.310(d)(1) — Device and Media Controls

*Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain ePHI into and out of a facility, and the movement of these items within the facility.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Disposal** | **Required** | Implement policies and procedures to address the final disposition of ePHI, and/or the hardware or electronic media on which it is stored |
| B | **Media Re-use** | **Required** | Implement procedures for removal of ePHI from electronic media before the media are made available for re-use |
| C | **Accountability** | Addressable | Maintain a record of the movements of hardware and electronic media and any person responsible |
| D | **Data Backup and Storage** | Addressable | Create a retrievable, exact copy of ePHI, when needed, before movement of equipment |

---

## 3. Technical Safeguards — § 164.312

The technology and the policy and procedures for its use that protect ePHI and control access to it.

### § 164.312(a)(1) — Access Control

*Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights as specified in § 164.308(a)(4).*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Unique User Identification** | **Required** | Assign a unique name and/or number for identifying and tracking user identity |
| B | **Emergency Access Procedure** | **Required** | Establish (and implement as needed) procedures for obtaining necessary ePHI during an emergency |
| C | **Automatic Logoff** | Addressable | Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity |
| D | **Encryption and Decryption** | Addressable | Implement a mechanism to encrypt and decrypt ePHI |

### § 164.312(b) — Audit Controls

| | Standard (no separate specs) | **Required** | Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI |

### § 164.312(c)(1) — Integrity

*Implement policies and procedures to protect ePHI from improper alteration or destruction.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Mechanism to Authenticate ePHI** | Addressable | Implement electronic mechanisms to corroborate that ePHI has not been altered or destroyed in an unauthorized manner |

### § 164.312(d) — Person or Entity Authentication

| | Standard (no separate specs) | **Required** | Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed |

### § 164.312(e)(1) — Transmission Security

*Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Integrity Controls** | Addressable | Implement security measures to ensure that electronically transmitted ePHI is not improperly modified without detection until disposed of |
| B | **Encryption** | Addressable | Implement a mechanism to encrypt ePHI whenever deemed appropriate |

---

## 4. Organizational Requirements — § 164.314

### § 164.314(a)(1) — Business Associate Contracts or Other Arrangements

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Business Associate Contracts** | **Required** | The contract must provide that the business associate will use appropriate safeguards and report security incidents |
| B | **Other Arrangements** | **Required** | If other laws prevent a written contract, document the entity's reasonable efforts to obtain assurances and good faith attempt to comply |

### § 164.314(b)(1) — Requirements for Group Health Plans

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Plan Documents** | **Required** | Group health plan sponsors must amend plan documents to incorporate provisions requiring implementation of administrative, physical, and technical safeguards |

---

## 5. Policies and Procedures / Documentation — § 164.316

### § 164.316(a) — Policies and Procedures

| | Standard (no separate specs) | **Required** | Implement reasonable and appropriate policies and procedures to comply with the standards, implementation specifications, and other requirements of the Security Rule |

### § 164.316(b)(1) — Documentation

*Maintain the policies and procedures in written form and maintain records of required actions, activities, or assessments.*

| # | Implementation Specification | Status | Description |
|---|---|---|---|
| A | **Time Limit** | **Required** | Retain documentation for 6 years from the date of its creation or the date when it last was in effect, whichever is later |
| B | **Availability** | **Required** | Make documentation available to those persons responsible for implementing the procedures to which the documentation pertains |
| C | **Updates** | **Required** | Review documentation periodically, and update as needed, in response to environmental or operational changes affecting the security of ePHI |

---

## Summary Counts

### By Safeguard Category

| Category | Standards | Required Specs | Addressable Specs | Total Specs |
|---|---|---|---|---|
| Administrative (§164.308) | 9 | 10 | 11 | 21 |
| Physical (§164.310) | 4 | 2 | 6 | 8 |
| Technical (§164.312) | 5 | 2 | 5 | 7 |
| Organizational (§164.314) | 2 | 3 | 0 | 3 |
| Documentation (§164.316) | 2 | 3 | 0 | 3 |
| **TOTAL** | **22** | **20** | **22** | **42** |

### Overall

- **20 Required** implementation specifications — must be implemented, no exceptions
- **22 Addressable** implementation specifications — must be implemented OR documented alternative + justification
- **42 Total** implementation specifications across all five sections

---

## Our Project's Implementation Status

This section maps the HIPAA Security Rule requirements to what our project's HIPAA preset (`testauthgas1.gs` and `testauthgas1.html`) currently implements. Only the Technical Safeguards (§164.312) are within scope of our code — Administrative, Physical, Organizational, and Documentation safeguards are organizational responsibilities that cannot be enforced through application code.

### Technical Safeguards (§164.312) — What Our Code Controls

| Requirement | Status | Our Implementation | Preset Setting |
|---|---|---|---|
| **Unique User Identification** (Required) | **Implemented** | Google OAuth provides unique email identity per user | Google OAuth + session token |
| **Emergency Access Procedure** (Required) | **Implemented** | Emergency access bypass for designated email addresses | `ENABLE_EMERGENCY_ACCESS: true` |
| **Automatic Logoff — Inactivity** (Addressable) | **Implemented** | Heartbeat-based: session expires on server when user stops interacting (heartbeat stops extending). Auto sign-out on expiry | `ENABLE_HEARTBEAT` + auto sign-out on timer expiry |
| **Automatic Logoff — Absolute** | **Implemented** | Hard 16-hour session ceiling that cannot be extended by heartbeats. Auto sign-out on expiry | `ABSOLUTE_SESSION_TIMEOUT: 57600` |
| **Encryption at Rest** (Addressable) | **Partial** | GAS CacheService is server-side on Google infrastructure; we don't control the encryption layer directly | Google-managed |
| **Encryption in Transit** (Addressable) | **Implemented** | HTTPS enforced by both GitHub Pages and Google Apps Script | Platform-enforced |
| **Audit Controls** (Required) | **Implemented** | Audit log writes login, logout, session events to spreadsheet | `ENABLE_AUDIT_LOG: true` |
| **ePHI Integrity** (Addressable) | **Implemented** | HMAC integrity verification on session data | `ENABLE_HMAC_INTEGRITY: true` |
| **Person/Entity Authentication** (Required) | **Implemented** | Google OAuth verifies identity; session token authenticates subsequent requests | OAuth + session management |
| **Transmission Integrity** (Addressable) | **Implemented** | HTTPS provides integrity checking; HMAC verifies session data wasn't tampered with | Platform + HMAC |
| **Transmission Encryption** (Addressable) | **Implemented** | All communication over HTTPS (TLS) | Platform-enforced |

### Administrative / Physical / Organizational — Outside Our Code's Scope

These requirements must be handled by the organization deploying the application:

| Category | Key Requirements | Our Project's Role |
|---|---|---|
| **Risk Analysis & Management** | Conduct risk assessment, implement risk mitigation | Not applicable — organizational policy |
| **Assigned Security Officer** | Designate a person responsible for security | Not applicable — organizational role |
| **Workforce Security** | Access authorization, clearance, termination procedures | Not applicable — HR/organizational process |
| **Security Training** | Train all workforce members on security policies | Not applicable — training program |
| **Incident Response** | Policies for detecting and responding to security incidents | Partially supported — audit log provides incident data |
| **Contingency Planning** | Data backup, disaster recovery, emergency mode | Not applicable — infrastructure/ops |
| **Business Associate Contracts** | Written agreements with any entity handling ePHI | Not applicable — legal/contract |
| **Facility & Workstation Security** | Physical access controls, workstation policies | Not applicable — physical environment |
| **Device & Media Controls** | Disposal, re-use, accountability of hardware/media | Not applicable — physical asset management |
| **Documentation** | Maintain policies for 6 years, keep them available and updated | Not applicable — document management |

---

## 2025 Proposed Rule Change

In January 2025, HHS published a [Notice of Proposed Rulemaking](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information) that would:

1. **Eliminate the "Addressable" vs. "Required" distinction** — making ALL implementation specifications mandatory
2. **Require encryption** of ePHI at rest and in transit (currently addressable)
3. **Require multi-factor authentication** in certain contexts
4. **Require annual compliance audits** instead of periodic evaluations

**Status:** Proposed, not finalized. Comments were due March 7, 2025. If adopted, all 22 currently "Addressable" specifications would become "Required", significantly increasing the compliance baseline.

---

## Key Takeaways

1. **HIPAA specifies no timeout values** — "automatic logoff after a predetermined time of inactivity" is the only guidance. No minutes, no hours. Organizations determine appropriate values through risk analysis
2. **Automatic logoff is Addressable, not Required** — you must implement it or document a justified alternative
3. **Absolute session timeout is not a HIPAA requirement** — it's an OWASP/security best practice. We include it as defense-in-depth
4. **The commonly cited "15 minutes"** is an industry convention (adopted by CMS internally), not a legal mandate
5. **Most of HIPAA is organizational, not technical** — only 7 of the 42 implementation specifications are things our code can directly enforce. The other 35 are policies, procedures, training, physical security, and contracts

Developed by: LightAISolutions
