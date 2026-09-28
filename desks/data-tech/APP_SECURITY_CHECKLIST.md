# AI Application Security Checklist

A comprehensive security framework for AI application development, incorporating your requirements, OWASP Top 10, and industry best practices.

---

## Table of Contents

1. [Authentication & Access Control](#authentication--access-control)
2. [Data Protection & Encryption](#data-protection--encryption)
3. [Database Security & Injection Prevention](#database-security--injection-prevention)
4. [HTTP Headers & CSRF Protection](#http-headers--csrf-protection)
5. [Dependency & Code Security](#dependency--code-security)
6. [AI-Specific & Advanced Threats](#ai-specific--advanced-threats)
7. [Logging, Monitoring & Incident Response](#logging-monitoring--incident-response)
8. [API Security & Rate Limiting](#api-security--rate-limiting)
9. [OWASP Top 10 Coverage](#owasp-top-10-coverage)

---

## Authentication & Access Control

### [ ] Hide API Keys and Secrets
- **Description**: Store all API keys, credentials, and secrets in environment variables or secure vaults, never in source code.
- **Severity**: CRITICAL
- **OWASP**: 02 - Cryptographic Failures
- **Implementation**:
  - Use `.env` files (gitignored) for local development
  - Use secret management systems (AWS Secrets Manager, HashiCorp Vault, Anthropic Console secrets)
  - Implement key rotation policies
  - Never commit secrets to version control
  - Use different keys for different environments (dev, staging, prod)

### [ ] Use Public Database Keys (Read-Only Where Possible)
- **Description**: Implement role-based access with minimal required permissions. Use read-only keys for public data operations.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Create separate database roles for different operations
  - Grant only SELECT permission for read-only operations
  - Use separate credentials for admin operations
  - Implement principle of least privilege across all services
  - Rotate credentials regularly

### [ ] Restrict Database Permissions
- **Description**: Implement least-privilege database access with granular role-based permissions.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Create separate roles: read-only, read-write, admin
  - Grant SELECT only for read-only role
  - Grant INSERT/UPDATE/DELETE only where necessary
  - Revoke ALTER and DROP permissions from application role
  - Use database users (not superuser) for applications
  - Disable root/admin access from application servers
  - Implement row-level security (RLS) per tenant
  - Audit database permission assignments
  - Test privilege escalation attempts
  - Log all privilege changes
  - Monitor failed access attempts
  - Use separate credentials for different services

### [ ] Enable Row-Level Security (RLS) / Row Security Policies
- **Description**: Enforce database-level access control so users can only see their own data even if they bypass application logic.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Enable RLS at the database level (PostgreSQL, Firebase, etc.)
  - Define policies based on user ID, organization ID, or custom attributes
  - Test that RLS blocks unauthorized access even with direct SQL queries
  - Document all RLS policies
  - Audit RLS permissions during security reviews

### [ ] Enforce Server-Side Authentication
- **Description**: Verify user identity on every API request. Never rely on client-side validation alone.
- **Severity**: CRITICAL
- **OWASP**: 07 - Identification and Authentication Failures
- **Implementation**:
  - Implement token validation on every protected endpoint
  - Use JWT, OAuth2, or session-based authentication
  - Validate token expiration and signature
  - Implement refresh token rotation
  - Never trust Authorization headers alone; validate against database

### [ ] Block Unauthorized Record Access
- **Description**: Validate that users have permission to access requested data. Implement proper authorization checks.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Add ownership checks before returning data (e.g., `user_id` matches request)
  - Implement resource-level authorization
  - Check permissions before delete/update operations
  - Log unauthorized access attempts
  - Use middleware to enforce authorization consistently

### [ ] Secure Session Cookies
- **Description**: Set HttpOnly, Secure, and SameSite attributes on session cookies to prevent theft and CSRF attacks.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  ```
  Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
  ```
  - HttpOnly: Prevents JavaScript access, mitigates XSS
  - Secure: Only sent over HTTPS
  - SameSite=Strict: Prevents CSRF attacks
  - Max-Age: Set appropriate session duration
  - Path=/: Limit to root path

### [ ] Reset Sessions on Password Change
- **Description**: Invalidate all active sessions when a user changes their password. Force re-authentication.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Clear all active tokens/sessions for the user
  - Revoke refresh tokens
  - Force logout from all devices
  - Send notification of logout to user
  - Log the password change event
  - Send confirmation email of security event
  - Prevent account access until user re-authenticates

### [ ] Lock Accounts After Failed Logins
- **Description**: Temporarily lock account after repeated failed login attempts to prevent brute force attacks.
- **Severity**: CRITICAL
- **OWASP**: 07 - Identification and Authentication Failures
- **Implementation**:
  - Lock after 5 failed attempts within 15 minutes
  - Lock duration: 30 minutes (increases exponentially)
  - Send email notification of lockout
  - Allow unlock via email link or password reset
  - Track lockout in logs
  - Monitor for patterns of account lockouts
  - Implement CAPTCHA before unlock attempts
  - Alert user of suspicious activity

### [ ] Hash Passwords with Strong Algorithms
- **Description**: Use bcrypt, Argon2, or scrypt. Never store plaintext passwords or use weak algorithms like MD5/SHA1.
- **Severity**: CRITICAL
- **OWASP**: 02 - Cryptographic Failures
- **Implementation**:
  - Use bcrypt with cost factor ≥12
  - Use Argon2id for highest security
  - Never use MD5, SHA1, or SHA256 for passwords
  - Always salt passwords
  - Verify password strength before hashing
  - Implement password history to prevent reuse

### [ ] Rate Limit Login Attempts
- **Description**: Prevent brute force attacks by limiting login attempts per IP/user.
- **Severity**: HIGH
- **OWASP**: 07 - Identification and Authentication Failures
- **Implementation**:
  - Limit to 5 attempts per 15 minutes per IP
  - Limit to 10 attempts per hour per username
  - Implement exponential backoff after failed attempts
  - Log all login attempts
  - Lock account temporarily after repeated failures
  - Send alert notifications for suspicious activity

### [ ] Rate Limit Password Reset Requests
- **Description**: Prevent abuse of password reset functionality to enumerate accounts or cause DoS.
- **Severity**: HIGH
- **OWASP**: 07 - Identification and Authentication Failures
- **Implementation**:
  - Limit password reset requests: 3 per hour per email
  - Limit password reset requests: 10 per IP per hour
  - Implement cooldown period between reset requests
  - Log all password reset requests
  - Send notification email of reset request
  - Alert on suspicious reset patterns
  - Implement CAPTCHA after multiple reset attempts
  - Monitor for bulk password reset attacks

### [ ] Add Bot Protection / CAPTCHA
- **Description**: Implement CAPTCHA or similar challenges on login and sensitive endpoints to prevent automated attacks.
- **Severity**: HIGH
- **OWASP**: 07 - Identification and Authentication Failures
- **Implementation**:
  - Use reCAPTCHA v3 or similar service
  - Implement CAPTCHA on login endpoints
  - Implement CAPTCHA on password reset
  - Implement CAPTCHA on API registration endpoints
  - Monitor CAPTCHA failure rates for patterns

### [ ] Expire Password Reset Links
- **Description**: Set short expiration times on password reset tokens and enforce one-time use.
- **Severity**: CRITICAL
- **OWASP**: 07 - Identification and Authentication Failures
- **Implementation**:
  - Expire reset link after 15-30 minutes
  - Make reset links one-time use only
  - Invalidate all other reset tokens when new one is requested
  - Store reset tokens hashed in database
  - Include user ID and expiration in token validation
  - Send reset link via email with clear expiration notice
  - Log all reset link generation and usage
  - Require confirmation when resetting to new password

### [ ] Prevent User Enumeration
- **Description**: Don't reveal whether username/email exists during login or password reset.
- **Severity**: HIGH
- **OWASP**: 07 - Identification and Authentication Failures
- **Implementation**:
  - Return same message for "user not found" and "invalid password"
  - Use timing-safe comparisons to prevent timing attacks
  - Return same HTTP status code (400 or 401) for all authentication failures
  - Don't reveal account existence in password reset
  - Generic message: "If an account exists, you will receive an email"
  - Log enumeration attempts for security monitoring
  - Implement rate limiting on enumeration attempts
  - Monitor for bulk account enumeration attacks

---

## Data Protection & Encryption

### [ ] Encrypt Sensitive Data at Rest
- **Description**: Use AES-256 encryption for sensitive fields in databases (PII, payment data, health info).
- **Severity**: CRITICAL
- **OWASP**: 02 - Cryptographic Failures
- **Implementation**:
  - Identify sensitive fields: SSN, credit cards, health data, emails, phone numbers
  - Use AES-256-GCM encryption
  - Store encryption keys separately from data (use key management service)
  - Encrypt before storing in database
  - Decrypt only when needed
  - Use database encryption (at-rest) in addition to field-level encryption

### [ ] Force HTTPS / TLS Encryption in Transit
- **Description**: Use TLS 1.2+ for all data transmission. Disable HTTP and redirect to HTTPS with HSTS headers.
- **Severity**: CRITICAL
- **OWASP**: 02 - Cryptographic Failures
- **Implementation**:
  - Obtain SSL/TLS certificate from trusted CA
  - Use TLS 1.2 or higher
  - Disable SSLv3, TLS 1.0, TLS 1.1
  - Set HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - Redirect all HTTP to HTTPS
  - Use strong cipher suites (no export ciphers)
  - Test with SSL Labs for A+ rating

### [ ] Trim API Responses to Necessary Data Only
- **Description**: Only return fields the client needs. Never expose internal IDs, password hashes, or system metadata in responses.
- **Severity**: HIGH
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Use field selection/projection in queries
  - Never include password hashes in API responses
  - Never include raw encryption keys
  - Never include sensitive metadata (timestamps, internal IDs if not needed)
  - Use serialization filters (e.g., Django serializers, GraphQL field selection)
  - Return only required fields in list endpoints

### [ ] Block Unauthorized Field Access/Modification
- **Description**: Prevent users from modifying fields they shouldn't (e.g., 'is_admin', 'payment_status'). Validate all inputs server-side.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Whitelist fields that users can modify
  - Reject requests that attempt to modify protected fields
  - Validate field names against schema
  - Log attempts to modify unauthorized fields
  - Use read-only field annotations in code
  - Separate request DTOs from database models

---

## Database Security & Injection Prevention

### [ ] Parameterize All Database Queries
- **Description**: Use prepared statements and parameterized queries. Never concatenate user input into SQL strings.
- **Severity**: CRITICAL
- **OWASP**: 03 - Injection
- **Implementation**:
  - Use parameterized queries: `SELECT * FROM users WHERE id = ?`
  - Use prepared statements in all languages
  - Use ORMs (Django ORM, SQLAlchemy, Sequelize)
  - Never use string concatenation for SQL: `"SELECT * FROM users WHERE id = " + userId` ❌
  - Escape identifiers separately if needed
  - Test queries with malicious input

### [ ] Validate All User Input on Server-Side
- **Description**: Type check, length check, whitelist allowed values, and reject unexpected input. Never trust client validation.
- **Severity**: CRITICAL
- **OWASP**: 03 - Injection
- **Implementation**:
  - Type validation: Ensure integers are integers, emails are emails
  - Length validation: Enforce min/max string lengths
  - Pattern validation: Use regex for format validation
  - Whitelist validation: Only allow known-good values
  - Range validation: Ensure numbers are within acceptable ranges
  - Use validation libraries (joi, yup, pydantic)
  - Validate on server regardless of client-side validation
  - Return specific error messages for debugging (in development only)

### [ ] Escape User-Generated Content
- **Description**: HTML-escape, URL-encode, or JSON-encode output to prevent XSS attacks based on context.
- **Severity**: CRITICAL
- **OWASP**: 03 - Injection
- **Implementation**:
  - HTML context: `<div>{{ userInput | escape }}</div>` (escapes <, >, &, ", ')
  - URL context: `<a href="{{ url | urlencode }}">` 
  - JavaScript context: `<script>var data = {{ userInput | jsonencode }}</script>`
  - Use templating engine auto-escaping (Jinja2, EJS, Handlebars)
  - Use context-aware escaping libraries
  - Never use `innerHTML` with user data (use `textContent` instead)

### [ ] Sanitize Input Before Storing
- **Description**: Remove dangerous characters and scripts from user input before storing in database.
- **Severity**: CRITICAL
- **OWASP**: 03 - Injection
- **Implementation**:
  - Use input sanitization libraries (bleach, DOMPurify, sanitize-html)
  - Strip HTML tags from text inputs
  - Remove dangerous attributes (onclick, onerror, script)
  - Whitelist allowed HTML tags if HTML is needed
  - Sanitize markdown before rendering
  - Remove null bytes and control characters
  - Limit input length at database level
  - Validate after sanitization
  - Log attempts to inject malicious input
  - Test with XSS payloads before storing

### [ ] Restrict File Uploads by Type and Size
- **Description**: Whitelist allowed file extensions, check MIME types, limit file size, scan for malware, and store outside web root.
- **Severity**: CRITICAL
- **OWASP**: 04 - Insecure Design
- **Implementation**:
  - Whitelist file types: `.pdf`, `.jpg`, `.png` (not `.exe`, `.sh`)
  - Check MIME type on server (not just extension)
  - Verify MIME type using magic bytes, not just extension
  - Limit file size: e.g., 10MB for images
  - Generate random filenames to prevent path traversal
  - Store files outside webroot (e.g., `/uploads/` not `/public/`)
  - Scan uploaded files with antivirus (VirusTotal API, ClamAV)
  - Implement virus scanning before making files available
  - Set Content-Disposition: attachment for file downloads
  - Implement Content-Security-Policy: default-src 'self' for uploaded content

### [ ] Verify Payment Webhooks
- **Description**: Validate webhook authenticity, verify signatures, and prevent replay attacks on payment events.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Verify webhook signature using shared secret (HMAC-SHA256)
  - Check webhook timestamp to prevent replay attacks
  - Store processed webhook IDs to prevent duplicate processing
  - Validate webhook source IP against payment provider's IP whitelist
  - Verify webhook contains expected fields before processing
  - Log all webhook events with source and validation status
  - Implement idempotency for webhook processing
  - Test webhooks with provider's test mode
  - Alert on invalid/unverified webhook attempts
  - Don't rely on webhook for critical operations; verify with API

### [ ] Set Prices Server-Side
- **Description**: Never trust client-side price information. Always validate and fetch current prices from server/database.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Always fetch prices from server database or payment provider
  - Never accept prices from client-side requests
  - Validate prices before processing payment
  - Use payment provider's price validation APIs
  - Log all price changes with timestamp and who made the change
  - Implement version control for pricing
  - Never pass prices in hidden form fields
  - Include product ID and current price in payment request
  - Verify price matches before charging customer

---

## HTTP Headers & CSRF Protection

### [ ] Add Security Headers
- **Description**: Set Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, X-XSS-Protection.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' cdn.example.com
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  ```
  - CSP prevents XSS by restricting script sources
  - X-Frame-Options prevents clickjacking
  - X-Content-Type-Options prevents MIME sniffing
  - HSTS enforces HTTPS with preload
  - Test headers with security scanners

### [ ] Add HSTS (HTTP Strict-Transport-Security)
- **Description**: Force HTTPS by telling browsers to always use secure connections to your domain.
- **Severity**: CRITICAL
- **OWASP**: 02 - Cryptographic Failures
- **Implementation**:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  ```
  - max-age=31536000: 1 year in seconds
  - includeSubDomains: Apply to all subdomains
  - preload: Include in HSTS preload list (optional)
  - Start with shorter max-age (300 seconds) and increase
  - Test with SSL Labs HSTS preload list
  - Submit to HSTS preload list for added security
  - Document HSTS policy in security headers documentation
  - Monitor for HSTS policy violations

### [ ] Implement CSRF Tokens
- **Description**: Generate unique tokens per session/request for state-changing operations (POST, PUT, DELETE).
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Generate unique token per session or per form
  - Include token in hidden form field or custom header
  - Validate token on server before processing request
  - Use strong CSRF libraries (django.middleware.csrf, csurf, etc.)
  - Rotate tokens after use
  - Set token in response, validate in request
  - Test with tools like Burp Suite

### [ ] Validate Request Origins (CORS)
- **Description**: Explicitly whitelist trusted origins. Don't use wildcard '*' for sensitive endpoints.
- **Severity**: HIGH
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  ```
  Access-Control-Allow-Origin: https://example.com
  Access-Control-Allow-Methods: GET, POST
  Access-Control-Allow-Headers: Content-Type, Authorization
  Access-Control-Allow-Credentials: true
  ```
  - Never use `Access-Control-Allow-Origin: *` with credentials
  - Explicitly list trusted domains
  - Use dynamic origin validation if needed
  - Set appropriate CORS methods (not all methods for all endpoints)
  - Validate preflight requests

### [ ] Lock Down CORS (Restrict API Access)
- **Description**: Implement strict CORS policies to prevent unauthorized cross-origin API access.
- **Severity**: CRITICAL
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Default to rejecting all cross-origin requests
  - Explicitly whitelist specific origins (not *)
  - Only allow necessary HTTP methods per endpoint
  - Whitelist specific headers (not Authorization by default)
  - Never allow credentials with wildcard origin
  - Set max-age low (e.g., 600 seconds)
  - Log all CORS violations
  - Monitor for CORS attacks
  - Test with browser dev tools and Burp Suite
  - Document CORS policy for team

---

## Dependency & Code Security

### [ ] Scan Dependencies for Vulnerabilities
- **Description**: Use npm audit, Snyk, OWASP DependencyCheck, or similar to identify and patch vulnerable packages regularly.
- **Severity**: CRITICAL
- **OWASP**: 06 - Vulnerable and Outdated Components
- **Implementation**:
  - Run `npm audit` or `pip check` regularly
  - Use Snyk for continuous vulnerability scanning
  - Set up automated dependency updates (Dependabot, Renovate)
  - Review security advisories for your dependencies
  - Update vulnerable packages immediately
  - Run security scans in CI/CD pipeline
  - Test after updates to ensure compatibility

### [ ] Avoid Deserializing Untrusted Data
- **Description**: Never deserialize user input directly. Use safe parsing (JSON) instead of pickle, eval, or Java serialization.
- **Severity**: CRITICAL
- **OWASP**: 08 - Software and Data Integrity Failures
- **Implementation**:
  - Never use `pickle.loads()` on user data (Python)
  - Never use `eval()` or `exec()` on user input
  - Never use `Object.freeze()` on untrusted objects
  - Use JSON.parse() instead of eval() for JSON
  - Use safe YAML parsing libraries
  - Validate deserialized objects before use
  - Use whitelisting for allowed classes in deserialization

### [ ] Review Third-Party Code and Integrations
- **Description**: Audit dependencies and external services. Understand what permissions and data access they require.
- **Severity**: HIGH
- **OWASP**: 06 - Vulnerable and Outdated Components
- **Implementation**:
  - Review major dependencies' source code
  - Check package popularity and maintenance status
  - Verify package authors and publishers
  - Understand required permissions for external services
  - Use least-privileged API keys for integrations
  - Monitor third-party service security advisories
  - Implement fallback if third-party service goes down

### [ ] Disable Directory Listing
- **Description**: Prevent attackers from viewing directory contents by disabling auto-indexing on web servers.
- **Severity**: HIGH
- **OWASP**: 05 - Security Misconfiguration
- **Implementation**:
  - In Apache: Set `Options -Indexes` in .htaccess
  - In Nginx: Remove `autoindex on;` directive
  - In Node.js/Express: Use proper routing only
  - Test with browser: navigate to /uploads/ or /public/
  - Ensure all directories require explicit routing
  - Log requests to non-existent paths
  - Monitor for directory enumeration attempts
  - Document web server configuration

### [ ] Remove Default Admin Routes and Credentials
- **Description**: Remove or secure all default admin panels, debug routes, and default credentials.
- **Severity**: CRITICAL
- **OWASP**: 05 - Security Misconfiguration
- **Implementation**:
  - Remove default /admin routes (or password-protect)
  - Remove debug endpoints from production (/debug, /metrics)
  - Disable default credentials (admin/admin, root/root)
  - Remove default accounts if any
  - Scan codebase for hardcoded credentials
  - Document all existing admin routes and their security
  - Implement authentication for all admin endpoints
  - Monitor access to admin routes
  - Log all admin panel access
  - Disable /phpMyAdmin, /wp-admin if not needed

---

## AI-Specific & Advanced Threats

### [ ] Validate and Sanitize AI Model Inputs (Prompt Injection Prevention)
- **Description**: Treat user prompts as untrusted input. Sanitize, validate, and use system prompts to define boundaries.
- **Severity**: CRITICAL
- **AI Risk**: HIGH
- **Implementation**:
  - Define strict system prompts that override user instructions
  - Implement input length limits for prompts (e.g., 10,000 characters)
  - Filter for known attack patterns (jailbreak attempts)
  - Block prompt injection keywords: "ignore", "system prompt", "forget", "forget instructions"
  - Log all model inputs and outputs for auditing
  - Implement prompt templates to control structure
  - Use role-based constraints in system prompts
  - Test with adversarial prompts (jailbreak attempts)
  - Monitor for model behavior changes
  - Implement input sanitization before sending to model

### [ ] Block Prompt Injection Attacks
- **Description**: Implement multiple layers of defense against prompt injection and jailbreak attempts.
- **Severity**: CRITICAL
- **AI Risk**: CRITICAL
- **Implementation**:
  - Create whitelist of allowed instruction patterns
  - Monitor for attempts to change model behavior
  - Detect and block commands that override system prompts
  - Implement input encoding to prevent instruction mixing
  - Use structured inputs (JSON/templates) instead of free text
  - Test model with common jailbreak attempts regularly
  - Set model parameters to restrict output (max_tokens, temperature)
  - Implement output filtering for compliance
  - Log all potential prompt injection attempts
  - Use different models for untrusted inputs vs. trusted sources

### [ ] Cap AI Usage and Implement Request Limits
- **Description**: Limit total tokens, API calls, and model usage per user/organization to prevent abuse.
- **Severity**: HIGH
- **AI Risk**: HIGH
- **Implementation**:
  - Set daily token limits per user (e.g., 100,000 tokens/day)
  - Set monthly token limits per organization
  - Implement cost-based quotas
  - Rate limit model API calls (e.g., 100 requests/minute)
  - Set per-request token limits
  - Queue requests when limits are approaching
  - Send warning notifications at 80% usage
  - Stop processing at 100% usage
  - Implement upgrade prompts for users reaching limits
  - Monitor unusual usage patterns

### [ ] Limit Request Size and Prevent Resource Exhaustion
- **Description**: Prevent large requests that could cause DoS or resource exhaustion.
- **Severity**: CRITICAL
- **OWASP**: 04 - Insecure Design
- **Implementation**:
  - Set maximum request body size: e.g., 10MB
  - Set maximum request timeout: e.g., 30 seconds
  - Implement streaming for large uploads
  - Set maximum file upload size
  - Limit batch operation sizes (e.g., max 1000 records)
  - Implement request queueing
  - Monitor memory usage during request processing
  - Set database query timeouts
  - Reject requests exceeding limits with 413 (Payload Too Large)

### [ ] Implement Output Guardrails for AI Responses
- **Description**: Filter AI model outputs for malicious content, PII, or policy violations before returning to users.
- **Severity**: CRITICAL
- **AI Risk**: HIGH
- **Implementation**:
  - Scan outputs for PII (credit cards, SSNs, emails)
  - Detect harmful content (violence, illegal advice, hate speech)
  - Implement content filters based on keywords and patterns
  - Use toxicity detection APIs
  - Flag outputs that violate policies
  - Log suspicious outputs for review
  - Implement human-in-the-loop review for high-risk outputs
  - Set guardrails in model parameters if available

### [ ] Limit Model Access and Rate-Limit API Calls
- **Description**: Implement per-user/IP rate limits and token quotas. Prevent abuse of model APIs.
- **Severity**: HIGH
- **AI Risk**: HIGH
- **Implementation**:
  - Limit API calls per user per hour/day
  - Limit total tokens per user per billing period
  - Implement cost-based rate limiting
  - Monitor for unusual usage patterns
  - Set per-request timeouts
  - Queue requests with priority levels
  - Implement backoff and retry logic
  - Alert on quota violations

### [ ] Monitor for Data Leakage in Model Training/Responses
- **Description**: Log model interactions. Check for PII, secrets, or training data being leaked in outputs.
- **Severity**: HIGH
- **AI Risk**: HIGH
- **Implementation**:
  - Log all model interactions (input, output, user, timestamp)
  - Implement automated PII detection in responses
  - Check for exposure of API keys or secrets
  - Monitor for patterns of sensitive data leakage
  - Implement human review process for suspicious outputs
  - Set retention policies for logs
  - Implement data redaction for sensitive logs
  - Use pattern matching to detect duplicated training data

### [ ] Adversarial Input Testing for AI Models
- **Description**: Test edge cases, jailbreak attempts, and adversarial prompts. Understand model failure modes.
- **Severity**: HIGH
- **AI Risk**: HIGH
- **Implementation**:
  - Create test suite of adversarial prompts
  - Test jailbreak attempts (e.g., "roleplay as system", "ignore instructions")
  - Test prompt injection attacks
  - Test for bias and stereotype generation
  - Test extreme/unusual inputs
  - Document model limitations and failure modes
  - Implement feature flags for new features
  - Beta test with limited users before release

---

## Logging, Monitoring & Incident Response

### [ ] Log Security Events and Access
- **Description**: Log authentication attempts, access to sensitive data, API calls, and errors. Don't log passwords or PII.
- **Severity**: HIGH
- **OWASP**: 09 - Logging and Monitoring Failures
- **Implementation**:
  - Log all login attempts (success and failure)
  - Log access to sensitive data with user ID and timestamp
  - Log all API calls with method, path, and response code
  - Log errors and exceptions
  - Never log passwords, API keys, or PII
  - Use structured logging (JSON) for easy parsing
  - Set log retention policies (e.g., 90 days)
  - Implement log rotation to prevent disk space issues

### [ ] Monitor for Suspicious Activity
- **Description**: Set up alerts for unusual login patterns, bulk data exports, and rate limit violations.
- **Severity**: HIGH
- **OWASP**: 09 - Logging and Monitoring Failures
- **Implementation**:
  - Alert on multiple failed logins from same IP
  - Alert on logins from unusual locations
  - Alert on bulk data exports or large requests
  - Alert on repeated rate limit violations
  - Alert on error rate spikes
  - Implement real-time alerting via email/Slack
  - Use SIEM tools for log aggregation
  - Create dashboards for security metrics

### [ ] Develop and Test Incident Response Plan
- **Description**: Document procedures for security breaches, data loss, and service outages. Practice responses.
- **Severity**: RECOMMENDED
- **OWASP**: 09 - Logging and Monitoring Failures
- **Implementation**:
  - Document incident response procedures
  - Define roles and responsibilities
  - Create runbooks for common incidents
  - Conduct regular incident response drills
  - Test backup and recovery procedures
  - Document communication templates
  - Establish escalation procedures
  - Schedule post-incident reviews

### [ ] Implement Audit Trails for Sensitive Operations
- **Description**: Track who accessed what, when, and from where. Maintain immutable logs of data changes.
- **Severity**: HIGH
- **OWASP**: 01 - Broken Access Control
- **Implementation**:
  - Log all data modifications (create, update, delete)
  - Include user ID, timestamp, IP address, and changes
  - Implement change tracking for sensitive fields
  - Store audit logs immutably (append-only)
  - Retain audit logs for compliance periods
  - Implement audit log review procedures
  - Alert on sensitive data modifications
  - Generate audit reports for compliance

---

## API Security & Rate Limiting

### [ ] Implement Rate Limiting on All Endpoints
- **Description**: Limit requests per IP/user to prevent DoS attacks and brute force attempts.
- **Severity**: CRITICAL
- **OWASP**: 04 - Insecure Design
- **Implementation**:
  - Global limit: 1000 requests/hour per IP
  - Login endpoint: 5 attempts per 15 minutes per IP
  - API endpoint: 100 requests/minute per user
  - Use sliding window or token bucket algorithm
  - Return 429 (Too Many Requests) status code
  - Include Retry-After header in response
  - Implement distributed rate limiting for multi-server setups
  - Monitor rate limit violations

### [ ] Validate and Type-Check All API Inputs
- **Description**: Use schema validation. Reject requests with invalid types, missing required fields, or unexpected structure.
- **Severity**: CRITICAL
- **OWASP**: 03 - Injection
- **Implementation**:
  - Define JSON schemas for all request bodies
  - Validate request structure before processing
  - Type check all fields (string, number, boolean, etc.)
  - Enforce required fields
  - Reject extra/unexpected fields (don't just ignore them)
  - Use validation libraries (joi, yup, ajv)
  - Return 400 with specific error messages
  - Log validation failures

### [ ] Implement API Versioning and Deprecation
- **Description**: Version APIs to avoid breaking changes. Provide clear deprecation timelines and migration guides.
- **Severity**: RECOMMENDED
- **Implementation**:
  - Use URL versioning: `/api/v1/users` and `/api/v2/users`
  - Document breaking changes in changelogs
  - Announce deprecation 6+ months before removal
  - Provide migration guides
  - Support multiple versions simultaneously
  - Monitor usage of deprecated endpoints
  - Remove only unused deprecated endpoints

### [ ] Use API Keys and Token-Based Authentication
- **Description**: Implement OAuth2, JWT, or API key authentication. Rotate keys regularly. Never embed in code.
- **Severity**: CRITICAL
- **OWASP**: 02 - Cryptographic Failures
- **Implementation**:
  - Use Bearer tokens in Authorization header
  - Implement JWT with short expiration (15-60 minutes)
  - Implement refresh tokens for long-lived access
  - Sign JWTs with strong secrets (256-bit minimum)
  - Validate JWT signature on every request
  - Implement token revocation mechanism
  - Rotate keys/secrets regularly
  - Use HTTPS for all API calls with credentials

---

## OWASP Top 10 Coverage

### [ ] OWASP-01: Broken Access Control
- **Description**: Enforce proper authorization, implement RLS, use security headers, validate all access requests server-side.
- **Related Checklist Items**:
  - [ ] Block unauthorized record access
  - [ ] Enable row-level security
  - [ ] Enforce server-side authentication
  - [ ] Implement CSRF tokens
  - [ ] Validate request origins (CORS)
  - [ ] Trim API responses to necessary data only
  - [ ] Block unauthorized field access/modification
  - [ ] Implement audit trails for sensitive operations

### [ ] OWASP-02: Cryptographic Failures
- **Description**: Encrypt data at rest and in transit, use strong password hashing, manage keys securely, disable weak protocols.
- **Related Checklist Items**:
  - [ ] Hide API keys and secrets
  - [ ] Encrypt sensitive data at rest
  - [ ] Force HTTPS / TLS encryption in transit
  - [ ] Hash passwords with strong algorithms
  - [ ] Use API keys and token-based authentication

### [ ] OWASP-03: Injection
- **Description**: Use parameterized queries, validate all input, escape output, use ORMs where possible.
- **Related Checklist Items**:
  - [ ] Parameterize all database queries
  - [ ] Validate all user input on server-side
  - [ ] Escape user-generated content
  - [ ] Validate and type-check all API inputs

### [ ] OWASP-04: Insecure Design
- **Description**: Use threat modeling, secure design patterns, require authentication, restrict file uploads, implement rate limiting.
- **Related Checklist Items**:
  - [ ] Restrict file uploads by type and size
  - [ ] Implement rate limiting on all endpoints
  - [ ] Add bot protection / CAPTCHA
  - [ ] Validate and sanitize AI model inputs

### [ ] OWASP-05: Security Misconfiguration
- **Description**: Remove default credentials, disable unnecessary services, use security headers, keep dependencies updated.
- **Related Checklist Items**:
  - [ ] Add security headers
  - [ ] Scan dependencies for vulnerabilities
  - [ ] Force HTTPS / TLS encryption in transit

### [ ] OWASP-06: Vulnerable and Outdated Components
- **Description**: Scan dependencies regularly, patch vulnerabilities promptly, audit third-party code, use software composition analysis.
- **Related Checklist Items**:
  - [ ] Scan dependencies for vulnerabilities
  - [ ] Review third-party code and integrations

### [ ] OWASP-07: Identification and Authentication Failures
- **Description**: Enforce strong passwords, implement MFA, rate-limit login, use secure session management, add bot protection.
- **Related Checklist Items**:
  - [ ] Enforce server-side authentication
  - [ ] Hash passwords with strong algorithms
  - [ ] Rate limit login attempts
  - [ ] Add bot protection / CAPTCHA
  - [ ] Secure session cookies

### [ ] OWASP-08: Software and Data Integrity Failures
- **Description**: Don't deserialize untrusted data, verify package integrity, use secure CI/CD, keep dependencies updated.
- **Related Checklist Items**:
  - [ ] Avoid deserializing untrusted data
  - [ ] Scan dependencies for vulnerabilities

### [ ] OWASP-09: Logging and Monitoring Failures
- **Description**: Log security events, monitor suspicious activity, maintain audit trails, test incident response plans.
- **Related Checklist Items**:
  - [ ] Log security events and access
  - [ ] Monitor for suspicious activity
  - [ ] Develop and test incident response plan
  - [ ] Implement audit trails for sensitive operations

### [ ] OWASP-10: Server-Side Request Forgery (SSRF)
- **Description**: Validate URLs, whitelist allowed destinations, disable dangerous protocols, use network segmentation.
- **Implementation**:
  - [ ] Validate all URLs before making requests
  - [ ] Whitelist allowed destinations/domains
  - [ ] Disable dangerous protocols (gopher, file, ftp)
  - [ ] Use network segmentation
  - [ ] Implement timeouts on external requests
  - [ ] Log all external requests

---

## Additional Security Considerations

### Common Vulnerabilities Beyond OWASP Top 10

- **XXE (XML External Entity)**: Never parse untrusted XML with external entity resolution enabled
- **Race Conditions**: Use database transactions for atomic operations
- **Timing Attacks**: Use constant-time comparisons for sensitive operations
- **Directory Traversal**: Validate file paths, prevent `../` in uploads
- **Open Redirects**: Validate redirect URLs, use whitelists
- **Insecure Randomness**: Use cryptographically secure random number generators
- **Weak Password Reset**: Use secure tokens, short expiration times, one-time use
- **Account Enumeration**: Don't reveal whether username/email exists
- **Security Headers Missing**: Implement all major security headers
- **Outdated Frameworks**: Keep frameworks and libraries updated

### Security Testing

- **Static Analysis**: Use SAST tools (SonarQube, Veracode, CodeQL)
- **Dynamic Analysis**: Use DAST tools (Burp Suite, OWASP ZAP)
- **Dependency Scanning**: Use Snyk, npm audit, pip check
- **Container Scanning**: Scan Docker images for vulnerabilities
- **Penetration Testing**: Hire professional pen testers annually
- **Security Audits**: Review code and architecture regularly
- **Bug Bounty Programs**: Consider running bug bounty for critical apps

### Compliance & Standards

- **GDPR**: Encrypt PII, implement data deletion, get user consent
- **HIPAA**: Encrypt health data, implement audit trails
- **PCI-DSS**: Secure payment data handling
- **SOC 2**: Implement logging, monitoring, incident response
- **ISO 27001**: Implement information security management system

---

## Implementation Priority

### Phase 1: Critical (Implement First)
- Authentication & Access Control
- Data Protection & Encryption
- Database Security
- HTTPS/TLS
- API Key Management

### Phase 2: High (Implement Next)
- HTTP Security Headers
- Rate Limiting
- Logging & Monitoring
- Input Validation
- CSRF Protection

### Phase 3: Enhanced (Ongoing)
- Dependency Scanning
- Vulnerability Assessment
- Incident Response
- Security Audits
- Penetration Testing

---

## Checklist Usage

This checklist should be:
1. **Reviewed** before starting development
2. **Implemented** during development
3. **Tested** before deployment
4. **Audited** regularly (quarterly or after incidents)
5. **Updated** as new vulnerabilities are discovered

Track completion status and maintain this checklist as part of your security governance process.

---

## References

- **OWASP Top 10 2021**: https://owasp.org/Top10/
- **OWASP Testing Guide**: https://owasp.org/www-project-web-security-testing-guide/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **CWE Top 25**: https://cwe.mitre.org/top25/
- **SANS Top 25**: https://www.sans.org/top25-software-errors/

---

**Last Updated**: August 15, 2026  
**Version**: 1.1  
**Maintainer**: Security Team

---

## Latest Additions (v1.1)

New critical items added from additional security requirements:

- **Reset Sessions on Password Change** - Force re-authentication after password updates
- **Lock Accounts After Failed Logins** - Automatic account lockout to prevent brute force
- **Expire Password Reset Links** - Time-limited, single-use password reset tokens
- **Prevent User Enumeration** - Generic error messages to prevent account discovery
- **Verify Payment Webhooks** - HMAC signature validation and replay attack prevention
- **Set Prices Server-Side** - Never trust client-side pricing information
- **Add HSTS** - HTTP Strict-Transport-Security for browser-enforced HTTPS
- **Block Prompt Injection** - Multi-layer defense against AI model prompt injection attacks
- **Cap AI Usage** - Token limits and quota management per user/organization
- **Limit Request Size** - Prevent DoS through oversized requests
- **Rate Limit Password Reset** - Prevent abuse of password reset functionality
- **Sanitize Input Before Storing** - Remove malicious content from database storage
- **Lock Down CORS** - Strict cross-origin request policy
- **Disable Directory Listing** - Prevent directory enumeration
- **Remove Default Admin Routes** - Secure or eliminate default endpoints
- **Restrict Database Permissions** - Granular role-based access control
