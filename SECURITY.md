# Security Policy  
**Appatize — Cultural Operations Platform (COP)**  
© Appatize Ltd. All rights reserved.

Appatize is committed to maintaining enterprise-grade security practices,
protecting proprietary intelligence, and ensuring the confidentiality of
customer, creator, and partner data.

This repository contains sensitive intellectual property, including the
Cultural Intelligence Engine (CIE), Model Shaping Environment (MSE), and
associated reasoning pipelines. Security practices outlined below apply to all
contributors, contractors, collaborators, and internal systems.

---

## 🔐 1. Supported Versions

Security updates and reviews apply to the **current active development branch**
(main/master).  
Deprecated or legacy branches are not maintained for security unless explicitly stated.

---

## 🛡️ 2. Reporting a Vulnerability

If you discover a potential vulnerability or security issue within this
repository, **please report it privately** via:

📧 **security@appatize.com**  
(placeholder until official domain email is activated)

### Do NOT:
- Open a public GitHub issue  
- Disclose details publicly  
- Share findings on social media or external channels  

### When reporting, include:
- Description of the vulnerability  
- Steps to reproduce (if known)  
- Potential impact  
- Suggested mitigation (optional)  

We will acknowledge submissions within **72 hours** and aim to provide a
resolution or roadmap within **7–14 days** depending on severity.

---

## 🔒 3. Disclosure Policy

Appatize follows a **private, coordinated disclosure process**.  
We work with researchers and collaborators to understand, verify, and
remediate vulnerabilities before any public discussion.

We reserve the right to:
- Delay disclosure if the fix requires architectural changes  
- Prioritise internal risk assessments  
- Decline disclosure if findings are non-security related  

---

## 🧱 4. Security Controls & Practices

### **Repository Security**
- `.gitignore` configured to prevent leaking secrets, keys, scratch files, and
  internal reasoning assets.
- `/IP` directory tracked and monitored for tampering.
- Experimental and research directories are Git-ignored by default.
- Contributors must not push environment variables, API keys, or credentials.

### **Credential Handling**
- No secrets are stored in source control.
- API keys must be injected via `.env.local` or secure vault mechanisms.
- All uploaded credentials must be rotated immediately if exposed.

### **Architecture Protection**
Internal intelligence logic (MSE, CIE, proprietary algorithms) is maintained
under `/internal` and treated as **trade-secret level confidential**.

Developers must:
- Avoid cloning these modules into public repos.
- Refrain from exposing internal logic in issues or documentation.
- Follow the Contributor IP Assignment rules (see `/IP` folder).

---

## 🔧 5. Dependencies & Supply Chain

Appatize uses:
- Next.js  
- Node.js  
- TypeScript  
- Vercel/Render deployments  
- Minimal external packages

### Our policies:
- Dependencies are updated regularly.
- Vulnerability audits (`npm audit`) run during key release cycles.
- Outdated or high-risk packages are replaced or removed.
- External libraries are never trusted for intelligence logic.

---

## ❌ 6. Prohibited Activities

Contributors and collaborators must NOT:
- Push secrets, credentials, or API keys.
- Expose `/internal` algorithms or reasoning pipelines externally.
- Attempt to reverse-engineer or extract proprietary logic.
- Use Appatize code for derivative or competing systems.
- Share private documentation, briefs, or architecture diagrams.

Violation may result in:
- Removal of access  
- Legal action  
- IP infringement claims  

---

## 🛠️ 7. Best Practices for Contributors

Before opening a pull request:
- Run local linting and security checks.
- Verify no secret files are staged:  
  ```bash
  git status
