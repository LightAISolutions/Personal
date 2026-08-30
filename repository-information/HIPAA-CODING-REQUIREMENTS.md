# HIPAA Coding Requirements — Complete Regulatory Reference

> **Source of Truth** — This document contains every HIPAA requirement relevant to software development and coding for healthcare applications. It is derived from the unabridged regulatory text of **45 CFR Part 164** (the HIPAA Security Rule, Privacy Rule, and Breach Notification Rule) and supplemented by NIST implementation guidance and the 2025 Notice of Proposed Rulemaking (NPRM).
>
> **This document supersedes** `archive info/HIPAA-COMPLIANCE-REFERENCE.md` as the authoritative HIPAA reference for this project. The older document remains for historical context but should not be used for compliance decisions.

## Authoritative Sources

All requirements in this document are derived from the following official sources, listed in order of legal authority:

| Priority | Source | URL | Authority |
|----------|--------|-----|-----------|
| 1 | **45 CFR Part 164** (Code of Federal Regulations) | [ecfr.gov](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164) | The law itself — binding regulatory text |
| 2 | **HHS Summary of the HIPAA Security Rule** | [hhs.gov](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html) | Official interpretive guidance from the enforcing agency |
| 3 | **HHS Summary of the HIPAA Privacy Rule** | [hhs.gov](https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html) | Official interpretive guidance — Privacy Rule |
| 4 | **HHS Breach Notification Rule** | [hhs.gov](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html) | Official interpretive guidance — Breach Notification |
| 5 | **NIST SP 800-66 Rev. 2** (Feb 2024) | [csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/66/r2/final) | Implementation guidance — maps HIPAA to NIST controls |
| 6 | **NIST SP 800-53 Rev. 5** | [csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | Specific security control implementations |
| 7 | **2025 HIPAA Security Rule NPRM** | [federalregister.gov](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information) | Proposed rule — NOT yet law (see Section 10) |

### How to Read This Document

- **Required** = Must be implemented. No exceptions. No alternatives.
- **Addressable** = Must be implemented if reasonable and appropriate. If not implemented, the entity must: (1) document why it is not reasonable and appropriate, AND (2) implement an equivalent alternative measure if one exists. **Addressable does NOT mean optional.**
- **Standard (no specs)** = The standard itself is required; there are no separate implementation specifications — the standard must be met as a whole.
- **[NPRM]** = Proposed change from the 2025 NPRM. Not yet law. Included for forward planning.
- Regulatory text is quoted verbatim where possible. Bracketed annotations `[like this]` are editorial clarifications.

---

## Table of Contents

1. [Applicability & Definitions — §164.302, §164.304](#1-applicability--definitions--164302-164304)
2. [General Rules — §164.306](#2-general-rules--164306)
3. [Administrative Safeguards — §164.308](#3-administrative-safeguards--164308)
4. [Physical Safeguards — §164.310](#4-physical-safeguards--164310)
5. [Technical Safeguards — §164.312](#5-technical-safeguards--164312)
6. [Organizational Requirements — §164.314](#6-organizational-requirements--164314)
7. [Policies and Procedures / Documentation — §164.316](#7-policies-and-procedures--documentation--164316)
8. [Privacy Rule — Coding-Relevant Requirements](#8-privacy-rule--coding-relevant-requirements)
9. [Breach Notification Rule — §164.400-414](#9-breach-notification-rule--164400-414)
10. [2025 NPRM — Proposed Changes (NOT YET LAW)](#10-2025-nprm--proposed-changes-not-yet-law)
11. [De-Identification Standards — §164.514](#11-de-identification-standards--164514)
12. [Summary Counts](#12-summary-counts)
13. [Coding Implementation Checklist](#13-coding-implementation-checklist)

---

## 1. Applicability & Definitions — §164.302, §164.304

### §164.302 — Applicability

> "A covered entity or business associate must comply with the applicable standards, implementation specifications, and requirements of this subpart with respect to electronic protected health information of a covered entity."

**Who must comply:**
- **Covered Entities** — health plans, health care clearinghouses, and any health care provider who transmits health information in electronic form in connection with a transaction for which the Secretary of HHS has adopted standards under HIPAA
- **Business Associates** — any person or entity that performs functions or activities on behalf of, or provides services to, a covered entity that involve the use or disclosure of protected health information

### §164.304 — Definitions

The following terms are defined for the purposes of the Security Rule (Subpart C). These definitions are legally binding and must be used precisely when interpreting requirements.

| Term | Definition (verbatim from 45 CFR §164.304) |
|------|---------------------------------------------|
| **Access** | The ability or the means necessary to read, write, modify, or communicate data/information or otherwise use any system resource. |
| **Administrative safeguards** | Administrative actions, and policies and procedures, to manage the selection, development, implementation, and maintenance of security measures to protect electronic protected health information and to manage the conduct of the covered entity's or business associate's workforce in relation to the protection of that information. |
| **Authentication** | The corroboration that a person is the one claimed. |
| **Availability** | The property that data or information is accessible and useable upon demand by an authorized person. |
| **Confidentiality** | The property that data or information is not made available or disclosed to unauthorized persons or processes. |
| **Encryption** | The use of an algorithmic process to transform data into a form in which there is a low probability of assigning meaning without use of a confidential process or key. |
| **Facility** | The physical premises and the interior and exterior of a building(s). |
| **Information system** | An interconnected set of information resources under the same direct management control that shares common functionality. It normally includes hardware, software, information, data, applications, communications, and people. |
| **Integrity** | The property that data or information have not been altered or destroyed in an unauthorized manner. |
| **Malicious software** | Software, for example, a virus, designed to damage or disrupt a system. |
| **Password** | Confidential authentication information composed of a string of characters. |
| **Physical safeguards** | Physical measures, policies, and procedures to protect a covered entity's or business associate's electronic information systems and related buildings and equipment, from natural and environmental hazards, and unauthorized intrusion. |
| **Security or security measures** | All of the administrative, physical, and technical safeguards in an information system. |
| **Security incident** | The attempted or successful unauthorized access, use, disclosure, modification, or destruction of information or interference with system operations in an information system. |
| **Technical safeguards** | The technology and the policy and procedures for its use that protect electronic protected health information and control access to it. |
| **User** | A person or entity with authorized access. |
| **Workstation** | An electronic computing device, for example, a laptop or desktop computer, or any other device that performs similar functions, and electronic media stored in its immediate environment. |

> **Key term NOT defined here but critical:** "Electronic Protected Health Information" (ePHI) is defined in §160.103 as individually identifiable health information that is transmitted by or maintained in electronic media. This includes any information relating to past, present, or future physical or mental health condition, provision of health care, or payment for health care that identifies the individual (or can reasonably be used to identify the individual).

---

## 2. General Rules — §164.306

This section establishes the overarching framework for all Security Rule compliance. Every specific standard in §§164.308-316 must be read in light of these general rules.

### §164.306(a) — General Requirements

A covered entity or business associate must:

> (1) "Ensure the confidentiality, integrity, and availability of all electronic protected health information the covered entity or business associate creates, receives, maintains, or transmits."
>
> (2) "Protect against any reasonably anticipated threats or hazards to the security or integrity of such information."
>
> (3) "Protect against any reasonably anticipated uses or disclosures of such information that are not permitted or required under subpart E [the Privacy Rule] of this part."
>
> (4) "Ensure compliance with this subpart by its workforce."

### §164.306(b) — Flexibility of Approach

> (1) Covered entities and business associates "may use any security measures that allow the covered entity or business associate to reasonably and appropriately implement the standards and implementation specifications as specified in this subpart."

> (2) In deciding which security measures to use, a covered entity or business associate must take into account:
>
> - (i) The size, complexity, and capabilities of the covered entity or business associate
> - (ii) The covered entity's or business associate's technical infrastructure, hardware, and software security capabilities
> - (iii) The costs of security measures
> - (iv) The probability and criticality of potential risks to electronic protected health information

**Coding implication:** HIPAA is deliberately technology-neutral. It does not prescribe specific technologies, algorithms, or implementations. The choice of specific controls is left to the entity based on risk analysis. This means there is no single "correct" technical implementation — but whatever you choose must be justified by your risk analysis.

### §164.306(c) — Standards

> "A covered entity or business associate must comply with the applicable standards as provided in this section and in §§164.308, 164.310, 164.312, 164.314 and 164.316."

### §164.306(d) — Implementation Specifications

> (1) Implementation specifications are designated as either "required" or "addressable." The designation appears in parentheses after the title of each implementation specification.
>
> (2) When a standard includes required implementation specifications, "a covered entity or business associate must implement the implementation specifications."
>
> (3) When a standard includes addressable implementation specifications, a covered entity or business associate must:
>
> - (i) Assess whether each addressable implementation specification is a reasonable and appropriate safeguard in its environment, when analyzed with reference to the likely contribution to protecting ePHI; and
> - (ii) As applicable, either:
>   - (A) Implement the implementation specification if reasonable and appropriate; or
>   - (B) If implementing the implementation specification is not reasonable and appropriate:
>     - (1) Document why it would not be reasonable and appropriate to implement the implementation specification; and
>     - (2) Implement an equivalent alternative measure if reasonable and appropriate.

**Critical clarification:** "Addressable" has been widely misinterpreted as "optional." It is NOT optional. The entity must either implement it or document why not AND implement an alternative. The 2025 NPRM proposes eliminating this distinction entirely (see Section 10).

### §164.306(e) — Maintenance

> "A covered entity or business associate must review and modify the security measures implemented under this subpart as needed to continue provision of reasonable and appropriate protection of electronic protected health information, and update documentation of such security measures in accordance with §164.316(b)(2)(iii)."

**Coding implication:** Security measures are not "set and forget." Code that implements HIPAA controls must be periodically reviewed and updated in response to new threats, vulnerabilities, or changes in the operating environment.

---

## 3. Administrative Safeguards — §164.308

> "Administrative actions, and policies and procedures, to manage the selection, development, implementation, and maintenance of security measures to protect electronic protected health information and to manage the conduct of the covered entity's or business associate's workforce in relation to the protection of that information."

### §164.308(a)(1) — Security Management Process

**Standard:** *Implement policies and procedures to prevent, detect, contain, and correct security violations.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Risk Analysis** | **Required** | "Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of electronic protected health information held by the covered entity or business associate." |
| (ii) | **Risk Management** | **Required** | "Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level to comply with §164.306(a)." |
| (iii) | **Sanction Policy** | **Required** | "Apply appropriate sanctions against workforce members who fail to comply with the security policies and procedures of the covered entity or business associate." |
| (iv) | **Information System Activity Review** | **Required** | "Implement procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports." |

**Coding relevance:** Risk Analysis (i) directly informs which technical controls your code must implement. Information System Activity Review (iv) requires audit logging capabilities — your application must generate reviewable logs of system activity.

### §164.308(a)(2) — Assigned Security Responsibility

| | Standard (no separate specs) | **Required** |
|---|---|---|
| | "Identify the security official who is responsible for the development and implementation of the policies and procedures required by this subpart for the covered entity or business associate." |

### §164.308(a)(3) — Workforce Security

**Standard:** *Implement policies and procedures to ensure that all members of its workforce have appropriate access to electronic protected health information, as provided under [the Information Access Management standard], and to prevent those workforce members who do not have access under [that standard] from obtaining access to electronic protected health information.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Authorization and/or Supervision** | Addressable | "Implement procedures for the authorization and/or supervision of workforce members who work with electronic protected health information or in locations where it might be accessed." |
| (ii) | **Workforce Clearance Procedure** | Addressable | "Implement procedures to determine that the access of a workforce member to electronic protected health information is appropriate." |
| (iii) | **Termination Procedures** | Addressable | "Implement procedures for terminating access to electronic protected health information when the employment of, or other arrangement with, a workforce member ends or as required by determinations made as specified in [Workforce Clearance Procedure]." |

**Coding relevance:** Termination Procedures (iii) require that your system supports immediate access revocation — session invalidation, credential deactivation, etc. **[NPRM]** proposes access must end within 1 hour of termination.

### §164.308(a)(4) — Information Access Management

**Standard:** *Implement policies and procedures for authorizing access to electronic protected health information that are consistent with the applicable requirements of subpart E [Privacy Rule] of this part.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Isolating Healthcare Clearinghouse Functions** | **Required** | "If a health care clearinghouse is part of a larger organization, the clearinghouse must implement policies and procedures that protect the electronic protected health information of the clearinghouse from unauthorized access by the larger organization." |
| (ii) | **Access Authorization** | Addressable | "Implement policies and procedures for granting access to electronic protected health information, for example, through access to a workstation, transaction, program, process, or other mechanism." |
| (iii) | **Access Establishment and Modification** | Addressable | "Implement policies and procedures that, based upon the covered entity's or business associate's access authorization policies, establish, document, review, and modify a user's right of access to a workstation, transaction, program, or process." |

**Coding relevance:** Access Authorization (ii) and Access Establishment/Modification (iii) require role-based or attribute-based access control in your application. Your code must enforce access policies and support modification of user permissions.

### §164.308(a)(5) — Security Awareness and Training

**Standard:** *Implement a security awareness and training program for all members of its workforce (including management).*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Security Reminders** | Addressable | "Periodic security updates." |
| (ii) | **Protection from Malicious Software** | Addressable | "Procedures for guarding against, detecting, and reporting malicious software." |
| (iii) | **Log-in Monitoring** | Addressable | "Procedures for monitoring log-in attempts and reporting discrepancies." |
| (iv) | **Password Management** | Addressable | "Procedures for creating, changing, and safeguarding passwords." |

**Coding relevance:** Log-in Monitoring (iii) requires your application to track and report failed login attempts. Password Management (iv) affects password policy enforcement in your code (complexity, rotation, storage).

### §164.308(a)(6) — Security Incident Procedures

**Standard:** *Implement policies and procedures to address security incidents.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Response and Reporting** | **Required** | "Identify and respond to suspected or known security incidents; mitigate, to the extent practicable, harmful effects of security incidents that are known to the covered entity or business associate; and document security incidents and their outcomes." |

**Coding relevance:** Your application must support security incident detection and documentation. Audit logs must capture enough detail to identify, investigate, and document incidents.

### §164.308(a)(7) — Contingency Plan

**Standard:** *Establish (and implement as needed) policies and procedures for responding to an emergency or other occurrence (for example, fire, vandalism, system failure, and natural disaster) that damages systems that contain electronic protected health information.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Data Backup Plan** | **Required** | "Establish and implement procedures to create and maintain retrievable exact copies of electronic protected health information." |
| (ii) | **Disaster Recovery Plan** | **Required** | "Establish (and implement as needed) procedures to restore any loss of data." |
| (iii) | **Emergency Mode Operation Plan** | **Required** | "Establish (and implement as needed) procedures to enable continuation of critical business processes for protection of the security of electronic protected health information while operating in emergency mode." |
| (iv) | **Testing and Revision Procedures** | Addressable | "Implement procedures for periodic testing and revision of contingency plans." |
| (v) | **Applications and Data Criticality Analysis** | Addressable | "Assess the relative criticality of specific applications and data in support of other contingency plan components." |

**Coding relevance:** Data Backup Plan (i) requires your system to support data export and backup. Emergency Mode Operation Plan (iii) may require a degraded-mode feature in your application. **[NPRM]** proposes critical systems must be restorable within 72 hours.

### §164.308(a)(8) — Evaluation

| | Standard (no separate specs) | **Required** |
|---|---|---|
| | "Perform a periodic technical and nontechnical evaluation, based initially upon the standards implemented under this rule and, subsequently, in response to environmental or operational changes affecting the security of electronic protected health information, that establishes the extent to which a covered entity's or business associate's security policies and procedures meet the requirements of this subpart." |

**Coding relevance:** Your application's security controls must be periodically evaluated against the Security Rule requirements. **[NPRM]** proposes this become an annual compliance audit.

### §164.308(b) — Business Associate Contracts and Other Arrangements

**Standard:** *A covered entity must, in accordance with §164.306, obtain satisfactory assurances that its business associate will appropriately safeguard ePHI. A business associate must obtain the same from subcontractors.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Written Contract or Other Arrangement** | **Required** | "Document the satisfactory assurances required by [this section] through a written contract or other arrangement with the business associate that meets the applicable requirements of §164.314(a)." |

---

## 4. Physical Safeguards — §164.310

> "Physical measures, policies, and procedures to protect a covered entity's or business associate's electronic information systems and related buildings and equipment, from natural and environmental hazards, and unauthorized intrusion."

### §164.310(a)(1) — Facility Access Controls

**Standard:** *Implement policies and procedures to limit physical access to its electronic information systems and the facility or facilities in which they are housed, while ensuring that properly authorized access is allowed.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Contingency Operations** | Addressable | "Establish (and implement as needed) procedures that allow facility access in support of restoration of lost data under the disaster recovery plan and emergency mode operations plan in the event of an emergency." |
| (ii) | **Facility Security Plan** | Addressable | "Implement policies and procedures to safeguard the facility and the equipment therein from unauthorized physical access, tampering, and theft." |
| (iii) | **Access Control and Validation Procedures** | Addressable | "Implement procedures to control and validate a person's access to facilities based on their role or function, including visitor control, and control of access to software programs for testing and revision." |
| (iv) | **Maintenance Records** | Addressable | "Implement policies and procedures to document repairs and modifications to the physical components of a facility which are related to security (for example, hardware, walls, doors, and locks)." |

### §164.310(b) — Workstation Use

| | Standard (no separate specs) | **Required** |
|---|---|---|
| | "Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation or class of workstation that can access electronic protected health information." |

### §164.310(c) — Workstation Security

| | Standard (no separate specs) | **Required** |
|---|---|---|
| | "Implement physical safeguards for all workstations that access electronic protected health information, to restrict access to authorized users." |

### §164.310(d)(1) — Device and Media Controls

**Standard:** *Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain electronic protected health information into and out of a facility, and the movement of these items within the facility.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Disposal** | **Required** | "Implement policies and procedures to address the final disposition of electronic protected health information, and/or the hardware or electronic media on which it is stored." |
| (ii) | **Media Re-use** | **Required** | "Implement procedures for removal of electronic protected health information from electronic media before the media are made available for re-use." |
| (iii) | **Accountability** | Addressable | "Maintain a record of the movements of hardware and electronic media and any person responsible therefore." |
| (iv) | **Data Backup and Storage** | Addressable | "Create a retrievable, exact copy of electronic protected health information, when needed, before movement of equipment." |

**Coding relevance for Physical Safeguards:** While most physical safeguards are infrastructure/organizational concerns, they have coding implications:
- **Disposal (d)(1)(i):** Your application must support secure data deletion/wiping — not just file deletion but cryptographic erasure or overwriting
- **Media Re-use (d)(1)(ii):** Database sanitization procedures, cache clearing, session data purging
- **Workstation Security (c):** Screen lock enforcement, auto-logoff on idle (ties to Technical Safeguards §164.312(a)(2)(iii))

---

## 5. Technical Safeguards — §164.312

> "The technology and the policy and procedures for its use that protect electronic protected health information and control access to it."

**This is the most directly coding-relevant section of the entire HIPAA Security Rule.** Every standard and specification below has direct implications for application architecture, authentication, authorization, encryption, logging, and data integrity.

### §164.312(a)(1) — Access Control

**Standard:** *Implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to those persons or software programs that have been granted access rights as specified in §164.308(a)(4).*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Unique User Identification** | **Required** | "Assign a unique name and/or number for identifying and tracking user identity." |
| (ii) | **Emergency Access Procedure** | **Required** | "Establish (and implement as needed) procedures for obtaining necessary electronic protected health information during an emergency." |
| (iii) | **Automatic Logoff** | Addressable | "Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity." |
| (iv) | **Encryption and Decryption** | Addressable | "Implement a mechanism to encrypt and decrypt electronic protected health information." |

**Coding requirements in detail:**

**Unique User Identification (Required):**
- Every user must have a unique identifier — no shared accounts, no generic logins
- The system must track which user performed which action
- In our testauthgas1 environment: Google OAuth provides unique email identity per user
- Identifier must persist across sessions for audit trail continuity

**Emergency Access Procedure (Required):**
- The system must have a mechanism to grant access to ePHI during emergencies even if normal authentication is unavailable
- This is a "break glass" mechanism — must be logged, audited, and restricted
- In our testauthgas1 environment: `ENABLE_EMERGENCY_ACCESS: true` with designated emergency email addresses
- Must not compromise security — emergency access events must be heavily audited

**Automatic Logoff (Addressable):**
- Electronic sessions must terminate after a predetermined period of inactivity
- HIPAA does NOT specify a timeout value — the entity determines appropriate values through risk analysis
- Common industry conventions: 15 minutes (CMS internal policy), 20 minutes (NIST recommendation for moderate-sensitivity systems)
- **The commonly cited "15 minutes" is NOT a legal mandate** — it is an industry convention adopted by CMS internally
- In our testauthgas1 environment: Heartbeat-based inactivity detection with configurable timeout
- **[NPRM]** proposes making this Required (no longer Addressable)

**Encryption and Decryption (Addressable):**
- Must encrypt ePHI at rest unless documented risk analysis justifies an alternative
- In practice: AES-256 or equivalent for data at rest, TLS 1.2+ for data in transit
- "Encryption" as defined in §164.304: "The use of an algorithmic process to transform data into a form in which there is a low probability of assigning meaning without use of a confidential process or key"
- **[NPRM]** proposes making encryption Required for both at-rest and in-transit — no more "addressable" documentation loophole

### §164.312(b) — Audit Controls

| | Standard (no separate specs) | **Required** |
|---|---|---|
| | "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information." |

**Coding requirements in detail:**
- Your system MUST log: who accessed what, when, from where, and what they did
- Audit logs must be tamper-resistant — users should not be able to modify their own audit entries
- Logs must be retained (per §164.316(b)(2)(i)) for at least 6 years
- In our testauthgas1 environment: `ENABLE_AUDIT_LOG: true` writes login, logout, session events to spreadsheet
- Must cover: successful logins, failed login attempts, data access, data modifications, session creation/termination, emergency access events
- **[NPRM]** proposes this is already Required — no change, but emphasizes examination of logs must also occur

### §164.312(c)(1) — Integrity

**Standard:** *Implement policies and procedures to protect electronic protected health information from improper alteration or destruction.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Mechanism to Authenticate ePHI** | Addressable | "Implement electronic mechanisms to corroborate that electronic protected health information has not been altered or destroyed in an unauthorized manner." |

**Coding requirements in detail:**
- Data integrity verification — checksums, hash validation, HMAC signatures
- In our testauthgas1 environment: `ENABLE_HMAC_INTEGRITY: true` provides HMAC-based integrity verification on session data
- Must detect unauthorized modification — not just prevent it, but detect it after the fact
- Database integrity constraints, version control for ePHI records
- **[NPRM]** proposes making this Required

### §164.312(d) — Person or Entity Authentication

| | Standard (no separate specs) | **Required** |
|---|---|---|
| | "Implement procedures to verify that a person or entity seeking access to electronic protected health information is the one claimed." |

**Coding requirements in detail:**
- Authentication must positively verify identity — not just accept a credential, but confirm the credential belongs to the claimed identity
- Authentication methods may include: something you know (password), something you have (token/device), something you are (biometric)
- In our testauthgas1 environment: Google OAuth verifies identity; session tokens authenticate subsequent requests
- **[NPRM]** proposes mandatory multi-factor authentication (MFA) — at least 2 of 3 factor categories

### §164.312(e)(1) — Transmission Security

**Standard:** *Implement technical security measures to guard against unauthorized access to electronic protected health information that is being transmitted over an electronic communications network.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Integrity Controls** | Addressable | "Implement security measures to ensure that electronically transmitted electronic protected health information is not improperly modified without detection until disposed of." |
| (ii) | **Encryption** | Addressable | "Implement a mechanism to encrypt electronic protected health information whenever deemed appropriate." |

**Coding requirements in detail:**
- ALL ePHI transmitted over networks must be protected from interception
- TLS 1.2 or higher for all HTTP communications — no exceptions for internal networks
- In our testauthgas1 environment: HTTPS enforced by both GitHub Pages and Google Apps Script
- Integrity controls: TLS provides integrity checking; HMAC verifies session data wasn't tampered with in transit
- Do NOT transmit ePHI via unencrypted email, FTP, HTTP, or other unprotected channels
- **[NPRM]** proposes making both specifications Required — encryption in transit will be mandatory with no alternative

---

## 6. Organizational Requirements — §164.314

### §164.314(a)(1) — Business Associate Contracts or Other Arrangements

**Standard:** *A covered entity is not in compliance with the standards in §164.502(e) and [the Business Associate standard] if the covered entity knew of a pattern of activity or practice of the business associate that constituted a material breach or violation of the business associate's obligation under the contract or other arrangement, unless the covered entity took reasonable steps to cure the breach or end the violation, and if such steps were unsuccessful, terminated the contract or arrangement.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Business Associate Contracts** | **Required** | The contract must require the business associate to: (A) comply with the applicable requirements of this subpart; (B) in accordance with §164.308(b)(2), ensure that any subcontractors that create, receive, maintain, or transmit ePHI on behalf of the business associate agree to comply with the applicable requirements; (C) report to the covered entity any security incident of which it becomes aware, including breaches of unsecured PHI as required by §164.410. |
| (ii) | **Other Arrangements** | **Required** | When a covered entity and its business associate are both governmental entities, the covered entity is in compliance if it enters into a memorandum of understanding with the business associate that contains terms accomplishing the objectives of (i), or other law contains requirements applicable to the business associate that accomplish the objectives of (i). |
| (iii) | **Business Associate Subcontractor Contracts** | **Required** | The requirements of (i) and (ii) apply to the contract or other arrangement between a business associate and a subcontractor in the same manner as they apply between a covered entity and a business associate. |

**Coding relevance:** If your application integrates with third-party services that handle ePHI (APIs, cloud services, analytics), a BAA must be in place. Your code's architecture decisions (which services touch ePHI) directly determine which BAAs are needed.

### §164.314(b)(1) — Requirements for Group Health Plans

**Standard:** *Except when the only electronic protected health information disclosed to a plan sponsor is disclosed pursuant to §164.504(f)(1)(ii) or (iii), or as authorized under §164.508, a group health plan must ensure that its plan documents provide that the plan sponsor will reasonably and appropriately safeguard electronic protected health information created, received, maintained, or transmitted to or by the plan sponsor on behalf of the group health plan.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Plan Document Requirements** | **Required** | The plan documents of the group health plan must be amended to incorporate provisions to require the plan sponsor to: (A) implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of the ePHI; (B) ensure that the adequate separation required by §164.504(f)(2)(iii) is supported by reasonable and appropriate security measures; (C) ensure that any agent to whom it provides ePHI agrees to implement reasonable and appropriate security measures; (D) report to the group health plan any security incident of which it becomes aware. |

---

## 7. Policies and Procedures / Documentation — §164.316

### §164.316(a) — Policies and Procedures

| | Standard (no separate specs) | **Required** |
|---|---|---|
| | "Implement reasonable and appropriate policies and procedures to comply with the standards, implementation specifications, or other requirements of this subpart, taking into account those factors specified in §164.306(b)(2)(i), (ii), (iii), and (iv). This standard is not to be construed to permit or excuse an action that violates any other standard, implementation specification, or other requirements of this subpart. A covered entity or business associate may change its policies and procedures at any time, provided that the changes are documented and are implemented in accordance with this subpart." |

### §164.316(b)(1) — Documentation

**Standard:** *Maintain the policies and procedures implemented to comply with this subpart in written (which may be electronic) form; and if an action, activity, or assessment is required by this subpart to be documented, maintain a written (which may be electronic) record of the action, activity, or assessment.*

| # | Implementation Specification | Status | Regulatory Text |
|---|---|---|---|
| (i) | **Time Limit** | **Required** | "Retain the documentation required by paragraph (b)(1) of this section for 6 years from the date of its creation or the date when it last was in effect, whichever is later." |
| (ii) | **Availability** | **Required** | "Make documentation available to those persons responsible for implementing the procedures to which the documentation pertains." |
| (iii) | **Updates** | **Required** | "Review documentation periodically, and update as needed, in response to environmental or operational changes affecting the security of the electronic protected health information." |

**Coding relevance:**
- **6-year retention (i):** Audit logs, access records, security incident documentation, and configuration records must be retained for at least 6 years. Your system's data retention and archival capabilities must support this
- **Availability (ii):** Security documentation must be accessible to those who need it — this document itself is an example of compliance with this requirement
- **Updates (iii):** This document and all security policies must be reviewed and updated when the operating environment changes (new threats, new technologies, regulatory changes)

---

## 8. Privacy Rule — Coding-Relevant Requirements

The Privacy Rule (45 CFR Part 164, Subpart E) primarily governs policies and procedures for uses and disclosures of PHI. While it is largely organizational/administrative, several provisions have direct coding implications.

### §164.502(b) — Minimum Necessary Standard

> When using, disclosing, or requesting protected health information, a covered entity or business associate must make reasonable efforts to limit protected health information to the minimum necessary to accomplish the intended purpose of the use, disclosure, or request.

**Coding requirements:**
- API endpoints that return PHI must support field-level filtering — do not return entire patient records when only a subset is needed
- Database queries should select only the columns/fields needed for the specific operation
- Role-based views: different roles should see different subsets of data based on their function
- Log entries should contain the minimum PHI necessary for their purpose (e.g., log the event type and user, but not the full medical record content)

**Exceptions** (minimum necessary does NOT apply to):
- Disclosures to or requests by a health care provider for treatment
- Uses or disclosures made to the individual (or their personal representative)
- Uses or disclosures made pursuant to an individual's authorization
- Disclosures to HHS for compliance investigation or enforcement
- Uses or disclosures required by law
- Uses or disclosures required for HIPAA Administrative Simplification compliance

### §164.524 — Right of Access

> Individuals have the right to inspect and obtain a copy of their protected health information in a designated record set maintained by or for a covered entity.

**Coding requirements:**
- Your application must support data export — the individual has the right to obtain a copy of their ePHI
- Must provide the information in the form and format requested by the individual, if readily producible (e.g., electronic format if maintained electronically)
- Must respond within 30 days of the request (one 30-day extension permitted with written explanation)
- A reasonable, cost-based fee may be charged for copies
- The system must support designating a record set and identifying which records belong to which individual

**Permitted denials (no review required):**
- Psychotherapy notes
- Information compiled in reasonable anticipation of litigation
- Information subject to the Clinical Laboratory Improvements Amendments (CLIA)
- Inmates of correctional institutions (under certain circumstances)
- Research participants who agreed to temporary denial during the study

### §164.526 — Right to Amendment

> Individuals have the right to request amendment of their protected health information in a designated record set.

**Coding requirements:**
- Your application must support amendment requests — the ability to flag, annotate, or correct records
- If accepted: make the amendment, inform the individual, and make reasonable efforts to notify others who received the original information
- If denied: the original record must be preserved (not deleted), and the denial and the individual's statement of disagreement must be appended to the record
- Amendments must not delete original information — they must be additive (append corrections, not overwrite history)

**Permitted denials:**
- The entity did not create the information (unless the originator is unavailable)
- The information is not part of the designated record set
- The information would not be available for access under §164.524
- The information is already accurate and complete

### §164.528 — Accounting of Disclosures

> Individuals have the right to receive an accounting of disclosures of their protected health information made by a covered entity in the six years prior to the date of the request.

**Coding requirements:**
- Your application must maintain a log of all disclosures of PHI — who received the information, when, what was disclosed, and the purpose
- The log must cover the 6 years prior to the request
- Must be able to generate this report on demand for any individual

**Exemptions from accounting:**
- Disclosures for treatment, payment, and health care operations (§164.506)
- Disclosures to the individual about their own PHI
- Incidental disclosures (§164.502(a)(1)(iii))
- Disclosures pursuant to an authorization (§164.508)
- Disclosures for facility directory or to persons involved in care (§164.510)
- Disclosures for national security or intelligence purposes (§164.512(k)(2))
- Disclosures to correctional institutions or law enforcement (§164.512(k)(5))
- Disclosures that occurred prior to the compliance date

### §164.530 — Administrative Requirements (Privacy)

**Coding-relevant provisions:**
- **§164.530(c) — Safeguards:** A covered entity must have in place appropriate administrative, technical, and physical safeguards to protect the privacy of protected health information. This is the Privacy Rule's analog to the Security Rule — it requires privacy protections for ALL PHI (not just electronic)
- **§164.530(j) — Documentation:** Policies, procedures, and communications must be retained for 6 years from the date of creation or the date when last in effect

---

## 9. Breach Notification Rule — §164.400-414

The Breach Notification Rule (45 CFR Part 164, Subpart D) requires notification following a breach of unsecured protected health information. While primarily an organizational/legal obligation, it has significant coding implications for breach detection, logging, and notification infrastructure.

### Key Definitions

**Breach** (§164.402): "The acquisition, access, use, or disclosure of protected health information in a manner not permitted under [the Privacy Rule] which compromises the security or privacy of the protected health information."

**Unsecured PHI** (§164.402): "Protected health information that is not rendered unusable, unreadable, or indecipherable to unauthorized persons through the use of a technology or methodology specified by the Secretary in the guidance issued under section 13402(h)(2) of Public Law 111-5."

> **Key implication:** If your ePHI is properly encrypted (using NIST-approved algorithms), it is considered "secured" and a breach of that data does NOT trigger notification requirements. This is one of the strongest arguments for encryption — it converts a breach notification event into a non-event.

### Presumption of Breach

Unless the covered entity or business associate demonstrates that there is a low probability that the PHI has been compromised based on a risk assessment of at least the following factors:
1. The nature and extent of the PHI involved, including the types of identifiers and the likelihood of re-identification
2. The unauthorized person who used the PHI or to whom the disclosure was made
3. Whether the PHI was actually acquired or viewed
4. The extent to which the risk to the PHI has been mitigated

### §164.404 — Notification to Individuals

> A covered entity shall, following the discovery of a breach of unsecured protected health information, notify each individual whose unsecured protected health information has been, or is reasonably believed by the covered entity to have been, accessed, acquired, used, or disclosed as a result of such breach.

**Timeline:** Without unreasonable delay, and in no case later than **60 calendar days** after discovery of the breach.

**Discovery:** A breach is treated as "discovered" on the first day it is known to any person (other than the person committing the breach) who is a workforce member or agent of the entity.

**Content of notification (§164.404(c)):** Must include:
1. A brief description of what happened, including the date of the breach and the date of discovery
2. A description of the types of unsecured PHI involved (e.g., name, SSN, date of birth, diagnosis, etc.)
3. Any steps individuals should take to protect themselves from potential harm
4. A brief description of what the entity is doing to investigate, mitigate losses, and prevent future breaches
5. Contact procedures for individuals to ask questions (toll-free telephone number, email address, postal address, or website)

**Method of notification:** Written notification by first-class mail, or by email if the individual has agreed to electronic notice.

**Substitute notice:** If contact information is insufficient or out-of-date for 10 or more individuals, the entity must post a conspicuous notice on its website home page for at least 90 days or provide notice in major print or broadcast media.

### §164.406 — Notification to the Media

> For a breach affecting more than **500 residents of a State or jurisdiction**, the covered entity must provide notice to prominent media outlets serving that State or jurisdiction.

**Timeline:** Without unreasonable delay, and in no case later than 60 calendar days after discovery.

**Threshold:** The 500-resident threshold is per-State/jurisdiction, not total. A breach affecting 600 individuals split across 3 states (200 each) does NOT trigger media notification.

### §164.408 — Notification to the Secretary of HHS

**Breaches involving 500 or more individuals:**
> Must be reported to the Secretary contemporaneously with individual notification (within 60 days) via the HHS web portal.

**Breaches involving fewer than 500 individuals:**
> The entity must maintain a log of such breaches and report them to the Secretary within 60 days after the end of the calendar year in which they were discovered.

**Documentation retention:** Breach logs must be maintained for 6 years.

### §164.410 — Notification by Business Associates

> A business associate shall, following the discovery of a breach of unsecured PHI, notify the covered entity of such breach without unreasonable delay and in no case later than **60 calendar days** after discovery.

The notification must include: identification of each individual whose unsecured PHI has been or is reasonably believed to have been breached, and any other information the covered entity needs to fulfill its notification obligations.

### §164.412 — Law Enforcement Delay

> If a law enforcement official determines that notification would impede a criminal investigation or cause damage to national security, the covered entity shall delay notification for the time period specified by the official.

### §164.414 — Administrative Requirements and Burden of Proof

> The covered entity or business associate bears the burden of demonstrating that all notifications were made as required, or that a use or disclosure did not constitute a breach.

**Documentation requirement:** The entity must maintain documentation demonstrating compliance with breach notification requirements for 6 years.

### Coding Requirements Summary for Breach Notification

| Requirement | Coding Implication |
|---|---|
| **Breach detection** | Implement intrusion detection, anomalous access pattern detection, unauthorized access alerts |
| **Breach logging** | Maintain detailed logs of all access to PHI with enough detail to determine what was accessed, by whom, and when |
| **Breach scope assessment** | Ability to determine which individuals' PHI was affected — requires audit trail linking data access to specific records |
| **Encryption as safe harbor** | Encrypting ePHI with NIST-approved algorithms exempts the data from breach notification requirements |
| **Notification infrastructure** | Systems to generate and track breach notifications to individuals, media, and HHS |
| **60-day timeline** | Automated alerting so the 60-day clock doesn't expire unnoticed |
| **6-year retention** | Breach documentation and logs must be retained for 6 years |

---

## 10. 2025 NPRM — Proposed Changes (NOT YET LAW)

> **WARNING:** This section describes PROPOSED changes from the [January 2025 Notice of Proposed Rulemaking](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information). These are NOT yet law. The final rule may differ substantially. The NPRM is included here for forward planning — implementing these requirements now positions us for compliance if/when they become mandatory.
>
> **Status as of March 2026:** OCR lists finalization on its regulatory agenda for May 2026. However, a January 31, 2025 executive order placed a regulatory freeze on new rules pending review. A coalition of 57 hospitals has petitioned HHS to withdraw the NPRM. The final rule may be published in slimmed-down form, delayed, or shelved entirely. If published, a 180-day compliance period applies (full compliance ~December 2026 or early 2027).

### Structural Change: Elimination of "Addressable" vs. "Required"

The NPRM proposes removing the "addressable" designation entirely. All implementation specifications would become **Required**, with specific limited exceptions. This eliminates the (frequently misinterpreted) option to document an alternative instead of implementing the specification.

**Impact:** All 22 currently "Addressable" specifications would become "Required," including:
- Automatic logoff (currently addressable under §164.312(a)(2)(iii))
- Encryption and decryption (currently addressable under §164.312(a)(2)(iv))
- Transmission encryption (currently addressable under §164.312(e)(2)(ii))
- All workforce security specifications (§164.308(a)(3))
- All physical access specifications (§164.310(a)(2))
- All security awareness training specifications (§164.308(a)(5))

### Proposed New Requirements

#### 10.1 — Mandatory Multi-Factor Authentication (MFA)

> Regulated entities would be required to apply the proposed rule's specific requirements for authenticating users' identities through verification of at least two of three categories of factors.

**The three factor categories:**
1. Something you **know** (password, PIN, security question)
2. Something you **have** (hardware token, mobile device, smart card)
3. Something you **are** (fingerprint, facial recognition, voice print)

**Scope:** MFA must be implemented for ALL access to systems containing ePHI — cloud services, on-premise systems, third-party applications, remote access, administrative access. Limited exceptions may exist for certain specialized medical devices.

**Coding implication:** Authentication systems must support at least 2 factor categories. Single-factor authentication (password only) would not be compliant.

#### 10.2 — Mandatory Encryption (At Rest and In Transit)

> Encryption of ePHI would be explicitly required for all systems involving ePHI — if a device or database holds ePHI, it must be encrypted.

**At rest:** All storage containing ePHI — databases, file systems, backups, caches, session stores.
**In transit:** All network transmission of ePHI — TLS 1.2+ minimum, no exceptions for internal networks.

**Coding implication:** No "risk analysis justification" alternative. Encryption is mandatory. Period.

#### 10.3 — Technology Asset Inventory & Network Map

> Development and revision of a technology asset inventory and a network map that illustrates the movement of ePHI throughout the regulated entity's electronic information systems, on an ongoing basis, but at least once every 12 months.

**Required inventory fields:** Identification, version, person accountable, and location of each technology asset.

**Coding implication:** Applications must be able to document their data flows — where ePHI enters, where it's stored, where it moves, and where it exits.

#### 10.4 — Enhanced Risk Analysis Requirements

Risk analyses must include:
- Review of the technology asset inventory and network map
- Identification of all reasonably anticipated threats to confidentiality, integrity, and availability of ePHI
- Identification of potential vulnerabilities and predisposing conditions
- Assessment of the risk level for each identified threat and vulnerability combination
- Must be reviewed and updated at least annually

#### 10.5 — Patch Management Timelines

| Severity | Deadline |
|----------|----------|
| **Critical** vulnerabilities | **15 calendar days** |
| **High-risk** vulnerabilities | **30 calendar days** |

**Coding implication:** Your deployment pipeline must support rapid patching. Dependencies with known critical vulnerabilities must be updated within 15 days.

#### 10.6 — Vulnerability Scanning & Penetration Testing

| Activity | Frequency |
|----------|-----------|
| **Vulnerability scanning** | At least every **6 months** |
| **Penetration testing** | At least every **12 months** |

#### 10.7 — Network Segmentation

> Network segmentation is required to separate systems that contain ePHI from those that do not.

**Coding implication:** Application architecture must support network isolation — ePHI-handling components should be separable from non-ePHI components.

#### 10.8 — 72-Hour System Recovery

> Regulated entities must establish written procedures to restore the loss of certain relevant electronic information systems and data within 72 hours.

**Coding implication:** Backup and recovery procedures must be tested and documented. Critical systems must be restorable within 72 hours of an incident.

#### 10.9 — Access Termination Within 1 Hour

> A former employee's access to ePHI must end no later than one hour after the end of employment.

**Coding implication:** Your system must support immediate credential revocation and session invalidation — not just disabling the account at the next sync cycle, but within 60 minutes.

#### 10.10 — Business Associate Annual Verification

> Business associates must verify to covered entities at least once every 12 months through a written analysis and written certification that they have deployed the required technical safeguards.

> Business associates must report to covered entities within 24 hours of activating contingency plans.

#### 10.11 — Annual Compliance Audit

> Regulated entities must conduct a compliance audit at least once every 12 months to ensure compliance with the Security Rule requirements.

#### 10.12 — Security Incident Response Plans

> Regulated entities must establish written security incident response plans and procedures, and implement written procedures for testing and revising those plans.

#### 10.13 — Anti-Malware & System Configuration Controls

> Regulated entities must establish and deploy technical controls for configuring relevant electronic information systems in a consistent manner, including deploying anti-malware protection, removing extraneous software, and disabling network ports.

### NPRM Timelines Summary

| Requirement | Timeline |
|---|---|
| Patch critical vulnerabilities | 15 days |
| Patch high-risk vulnerabilities | 30 days |
| Terminate former employee access | 1 hour |
| BA contingency plan notification to CE | 24 hours |
| Restore critical systems after incident | 72 hours |
| Vulnerability scans | Every 6 months |
| Penetration tests | Every 12 months |
| Risk analysis review | Every 12 months |
| Compliance audit | Every 12 months |
| Asset inventory/network map update | Every 12 months |
| BA security verification to CE | Every 12 months |
| Compliance deadline (after final rule) | 180 days |

---

## 11. De-Identification Standards — §164.514

De-identified health information is NOT considered PHI and is therefore NOT subject to HIPAA requirements. This section defines the two legally accepted methods for de-identification.

### §164.514(a) — Standard

> "Health information that does not identify an individual and with respect to which there is no reasonable basis to believe that the information can be used to identify an individual is not individually identifiable health information."

De-identified data created following either method below is no longer protected by the Privacy Rule — it falls outside the definition of PHI entirely.

### Method 1: Expert Determination — §164.514(b)(1)

> "A person with appropriate knowledge of and experience with generally accepted statistical and scientific principles and methods for rendering information not individually identifiable:
>
> (i) Applying such principles and methods, determines that the risk is very small that the information could be used, alone or in combination with other reasonably available information, by an anticipated recipient to identify an individual who is a subject of the information; and
>
> (ii) Documents the methods and results of the analysis that justify such determination."

**Coding implication:** If using this method, the de-identification process must be designed in consultation with a qualified statistical expert, and the methodology must be documented and retained.

### Method 2: Safe Harbor — §164.514(b)(2)

The following 18 categories of identifiers must be removed from the data. Additionally, the covered entity must not have actual knowledge that the remaining information could be used to identify an individual.

**The 18 HIPAA Identifiers (must be removed or generalized):**

| # | Identifier Category | §164.514(b)(2)(i) | Coding Action |
|---|---|---|---|
| A | **Names** | All names | Strip completely |
| B | **Geographic subdivisions** smaller than a state | Street address, city, county, precinct, ZIP code (see exception below), equivalent geocodes | Strip or generalize to state level |
| C | **Dates** (except year) directly related to an individual | Birth date, admission date, discharge date, death date; all ages over 89 and all elements of dates indicative of such age | Strip day/month, keep year only; aggregate ages >89 into "90 or older" |
| D | **Telephone numbers** | All phone numbers | Strip completely |
| E | **Fax numbers** | All fax numbers | Strip completely |
| F | **Email addresses** | All email addresses | Strip completely |
| G | **Social Security numbers** | All SSNs | Strip completely |
| H | **Medical record numbers** | All MRNs | Strip completely |
| I | **Health plan beneficiary numbers** | All beneficiary IDs | Strip completely |
| J | **Account numbers** | All account numbers | Strip completely |
| K | **Certificate/license numbers** | All certificate or license numbers | Strip completely |
| L | **Vehicle identifiers** and serial numbers, including license plate numbers | All vehicle IDs | Strip completely |
| M | **Device identifiers** and serial numbers | All device IDs | Strip completely |
| N | **Web Universal Resource Locators (URLs)** | All URLs | Strip completely |
| O | **Internet Protocol (IP) address numbers** | All IP addresses | Strip completely |
| P | **Biometric identifiers** | Fingerprints, voiceprints, retinal scans, etc. | Strip completely |
| Q | **Full face photographic images** and any comparable images | All facial photos | Strip completely |
| R | **Any other unique identifying number, characteristic, or code** | Catch-all for any other unique identifier | Strip or replace with random, non-derivable code |

**ZIP Code Exception:** The first 3 digits of a ZIP code may be retained if the geographic unit formed by combining all ZIP codes with the same 3-digit prefix contains more than 20,000 persons (per the most recent census). Otherwise, the 3-digit prefix must be changed to "000."

### §164.514(c) — Re-Identification

> A covered entity may assign a code or other means of record identification to allow information de-identified under this section to be re-identified by the covered entity, provided that:
>
> (1) The code or other means of record identification is not derived from or related to information about the individual and is not otherwise capable of being translated so as to identify the individual; and
>
> (2) The covered entity does not use or disclose the code or other means of record identification for any other purpose, and does not disclose the mechanism for re-identification.

**Coding implication:** If you need to link de-identified records back to individuals (e.g., for longitudinal research), the mapping table must use randomly generated codes (not derived from PHI), must be stored separately from the de-identified data, and must never be disclosed.

---

## 12. Summary Counts

### Current Law — Security Rule Implementation Specifications

| Category | Section | Standards | Required Specs | Addressable Specs | Total Specs |
|----------|---------|-----------|---------------|-------------------|-------------|
| Administrative Safeguards | §164.308 | 9 | 10 | 11 | 21 |
| Physical Safeguards | §164.310 | 4 | 2 | 6 | 8 |
| Technical Safeguards | §164.312 | 5 | 2 | 5 | 7 |
| Organizational Requirements | §164.314 | 2 | 3 | 0 | 3 |
| Policies/Documentation | §164.316 | 2 | 3 | 0 | 3 |
| **TOTAL** | | **22** | **20** | **22** | **42** |

### If 2025 NPRM Is Finalized

| Category | Standards | Required Specs | Addressable Specs | Total Specs |
|----------|-----------|---------------|-------------------|-------------|
| **ALL** | 22 | **42** | **0** | **42** |

All 22 Addressable specifications become Required. Plus ~13 new requirements (MFA, mandatory encryption, asset inventory, network maps, patch timelines, vulnerability scanning, penetration testing, network segmentation, 72-hour recovery, 1-hour access termination, BA verification, annual audits, incident response plans).

### Cross-Rule Requirements Affecting Code

| Rule | Sections | Coding-Relevant Requirements |
|------|----------|------------------------------|
| **Security Rule** | §164.308-316 | Authentication, access control, encryption, audit logging, session management, integrity verification |
| **Privacy Rule** | §164.502, 514, 524, 526, 528 | Minimum necessary data access, data export (right of access), amendment support, disclosure accounting, de-identification |
| **Breach Notification Rule** | §164.400-414 | Breach detection, access logging, encryption (safe harbor), notification infrastructure, 6-year log retention |

---

## 13. Coding Implementation Checklist

This checklist maps every HIPAA requirement to a concrete coding action. Use this as a compliance verification tool when building or auditing healthcare applications.

### Authentication & Access Control

| # | HIPAA Requirement | CFR Reference | Coding Action | Status |
|---|---|---|---|---|
| 1 | Unique User Identification | §164.312(a)(2)(i) — **Required** | Assign unique IDs to every user; no shared accounts | |
| 2 | Person/Entity Authentication | §164.312(d) — **Required** | Verify user identity before granting access (OAuth, SAML, credentials) | |
| 3 | Emergency Access Procedure | §164.312(a)(2)(ii) — **Required** | Implement break-glass mechanism with heavy audit logging | |
| 4 | Automatic Logoff | §164.312(a)(2)(iii) — Addressable | Terminate sessions after configurable inactivity period | |
| 5 | Access Authorization | §164.308(a)(4)(ii) — Addressable | Implement role-based or attribute-based access control | |
| 6 | Access Establishment/Modification | §164.308(a)(4)(iii) — Addressable | Support granting, modifying, and revoking user permissions | |
| 7 | Termination Procedures | §164.308(a)(3)(ii)(C) — Addressable | Immediate session invalidation and credential deactivation on termination | |
| 8 | [NPRM] Multi-Factor Authentication | Proposed — **Required** | Support at least 2 of 3 factor categories for all ePHI access | |
| 9 | [NPRM] 1-Hour Access Termination | Proposed — **Required** | Revoke all access within 60 minutes of employment end | |

### Encryption & Transmission Security

| # | HIPAA Requirement | CFR Reference | Coding Action | Status |
|---|---|---|---|---|
| 10 | Encryption at Rest | §164.312(a)(2)(iv) — Addressable | Encrypt all stored ePHI (AES-256 or equivalent) | |
| 11 | Encryption in Transit | §164.312(e)(2)(ii) — Addressable | TLS 1.2+ for all network communications; no plaintext transmission of ePHI | |
| 12 | Transmission Integrity | §164.312(e)(2)(i) — Addressable | Integrity verification on transmitted data (TLS, HMAC, checksums) | |
| 13 | [NPRM] Mandatory Encryption | Proposed — **Required** | Encryption at rest AND in transit — no alternative documentation accepted | |

### Audit & Logging

| # | HIPAA Requirement | CFR Reference | Coding Action | Status |
|---|---|---|---|---|
| 14 | Audit Controls | §164.312(b) — **Required** | Log all access to ePHI: who, what, when, where, action taken | |
| 15 | Information System Activity Review | §164.308(a)(1)(ii)(D) — **Required** | Provide reviewable audit logs and access reports | |
| 16 | Log-in Monitoring | §164.308(a)(5)(ii)(C) — Addressable | Track and alert on failed login attempts and discrepancies | |
| 17 | Security Incident Response | §164.308(a)(6)(ii) — **Required** | Detect, document, and alert on security incidents | |
| 18 | 6-Year Retention | §164.316(b)(2)(i) — **Required** | Retain all audit logs and documentation for at least 6 years | |
| 19 | Disclosure Accounting | §164.528 — **Required** (Privacy) | Log all disclosures of PHI with recipient, date, content, and purpose | |

### Data Integrity

| # | HIPAA Requirement | CFR Reference | Coding Action | Status |
|---|---|---|---|---|
| 20 | ePHI Integrity | §164.312(c)(1) — Addressable | Implement integrity verification (HMAC, checksums, hash validation) | |
| 21 | Mechanism to Authenticate ePHI | §164.312(c)(2) — Addressable | Detect unauthorized alteration or destruction of ePHI | |

### Privacy Rule — Data Handling

| # | HIPAA Requirement | CFR Reference | Coding Action | Status |
|---|---|---|---|---|
| 22 | Minimum Necessary | §164.502(b) — **Required** | API endpoints return only the minimum PHI needed; field-level filtering | |
| 23 | Right of Access | §164.524 — **Required** | Support data export in requested format within 30 days | |
| 24 | Right to Amendment | §164.526 — **Required** | Support amendment requests; preserve originals; append corrections | |
| 25 | De-Identification (Safe Harbor) | §164.514(b)(2) — Standard | Strip all 18 identifier categories from de-identified datasets | |
| 26 | De-Identification (Expert) | §164.514(b)(1) — Standard | Statistical de-identification with documented methodology | |
| 27 | Re-Identification Codes | §164.514(c) — Standard | Random codes only; separate storage; never disclose mechanism | |

### Breach Preparedness

| # | HIPAA Requirement | CFR Reference | Coding Action | Status |
|---|---|---|---|---|
| 28 | Breach Detection | §164.404 | Implement anomalous access detection and unauthorized access alerts | |
| 29 | Breach Scope Assessment | §164.404(c) | Audit trail must link data access to specific individual records | |
| 30 | Encryption Safe Harbor | §164.402 | Properly encrypted ePHI is exempt from breach notification | |
| 31 | Breach Logging | §164.408(c) | Maintain breach log with 6-year retention | |

### Infrastructure & Operations

| # | HIPAA Requirement | CFR Reference | Coding Action | Status |
|---|---|---|---|---|
| 32 | Data Backup | §164.308(a)(7)(ii)(A) — **Required** | Automated backup procedures for all ePHI | |
| 33 | Disaster Recovery | §164.308(a)(7)(ii)(B) — **Required** | Documented and tested recovery procedures | |
| 34 | Emergency Mode Operations | §164.308(a)(7)(ii)(C) — **Required** | Degraded-mode feature for critical operations during emergencies | |
| 35 | [NPRM] 72-Hour Recovery | Proposed — **Required** | Critical systems restorable within 72 hours | |
| 36 | [NPRM] Patch Management | Proposed — **Required** | Critical patches: 15 days; High-risk: 30 days | |
| 37 | [NPRM] Vulnerability Scanning | Proposed — **Required** | Automated vulnerability scanning every 6 months | |
| 38 | [NPRM] Penetration Testing | Proposed — **Required** | Professional penetration test every 12 months | |
| 39 | [NPRM] Network Segmentation | Proposed — **Required** | Isolate ePHI-handling systems from non-ePHI systems | |
| 40 | [NPRM] Asset Inventory | Proposed — **Required** | Document all technology assets touching ePHI; update annually | |

---

## Regulatory Citation Index

Quick-reference mapping of CFR section numbers to this document's sections:

| CFR Section | Topic | Document Section |
|---|---|---|
| §164.302 | Applicability | 1 |
| §164.304 | Definitions | 1 |
| §164.306 | General Rules | 2 |
| §164.308 | Administrative Safeguards | 3 |
| §164.310 | Physical Safeguards | 4 |
| §164.312 | Technical Safeguards | 5 |
| §164.314 | Organizational Requirements | 6 |
| §164.316 | Policies/Documentation | 7 |
| §164.400-414 | Breach Notification Rule | 9 |
| §164.502 | Minimum Necessary (Privacy) | 8 |
| §164.514 | De-Identification Standards | 11 |
| §164.524 | Right of Access (Privacy) | 8 |
| §164.526 | Right to Amendment (Privacy) | 8 |
| §164.528 | Accounting of Disclosures (Privacy) | 8 |
| §164.530 | Administrative Requirements (Privacy) | 8 |

---

## Document History

| Date | Version | Change |
|------|---------|--------|
| 2026-03-19 | 1.0 | Initial creation — complete regulatory reference derived from 45 CFR Part 164, HHS guidance, NIST SP 800-66r2, and 2025 NPRM |

---

> **Disclaimer:** This document is a reference compilation of HIPAA requirements for software development purposes. It is not legal advice. For definitive compliance guidance, consult the [official CFR text](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164), [HHS guidance](https://www.hhs.gov/hipaa/for-professionals/security/index.html), and qualified legal counsel. HIPAA requirements are interpreted in the context of each entity's specific risk analysis — this document provides the regulatory baseline, not entity-specific compliance determinations.

Developed by: LightAISolutions
