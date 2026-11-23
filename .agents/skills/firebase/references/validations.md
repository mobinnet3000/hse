# Firebase - Validations

## Security rules allow all access

### **Id**
allow-all-rules
### **Severity**
error
### **Type**
regex
### **Pattern**
  - allow\s+(read|write)\s*:\s*if\s+true\s*;
  - allow\s+(read|write)\s*:\s*if\s+true$
### **Message**
Security rules allow all access - your database is public
### **Fix Action**
Replace with proper authentication checks
### **Applies To**
  - *.rules
  - firestore.rules
  - storage.rules

## Firebase Admin SDK in client code

### **Id**
admin-sdk-client
### **Severity**
error
### **Type**
regex
### **Pattern**
  - from\s+["']firebase-admin
  - require\s*\(\s*['"]firebase-admin
  - import.*firebase-admin
### **Message**
Admin SDK should never be used in client-side code
### **Fix Action**
Use regular Firebase SDK for client, Admin SDK only in Cloud Functions
### **Applies To**
  - *.js
  - *.ts
  - *.jsx
  - *.tsx
### **Exclude**
  - **/functions/**
  - **/api/**
  - **/server/**

## Service account credentials in code

### **Id**
service-account-exposed
### **Severity**
error
### **Type**
regex
### **Pattern**
  - "type"\s*:\s*"service_account"
  - private_key.*-----BEGIN
  - client_email.*@.*\.iam\.gserviceaccount\.com
### **Message**
Service account credentials found in code - critical security risk
### **Fix Action**
Remove credentials, use environment variables or secret manager
### **Applies To**
  - *.json
  - *.js
  - *.ts

## Listener on entire collection without filter

### **Id**
unfiltered-collection-listener
### **Severity**
warning
### **Type**
regex
### **Pattern**
  - onSnapshot\s*\(\s*collection\s*\([^)]+\)\s*,
  - onSnapshot\s*\(\s*db\.collection\s*\([^)]+\)\s*,
### **Message**
Listener on collection without query filters - may cause high read costs
### **Fix Action**
Add where() and limit() clauses to scope the listener
### **Applies To**
  - *.js
  - *.ts
  - *.jsx
  - *.tsx

## Query without limit clause

### **Id**
no-limit-on-query
### **Severity**
info
### **Type**
regex
### **Pattern**
  - getDocs\s*\(\s*collection\s*\(
  - getDocs\s*\(\s*query\s*\([^)]*\)\s*\)(?!.*limit)
### **Message**
Query without limit - may read more documents than needed
### **Fix Action**
Add limit() to prevent reading entire collection
### **Applies To**
  - *.js
  - *.ts
  - *.jsx
  - *.tsx

## Sequential document reads in loop

### **Id**
sequential-reads
### **Severity**
warning
### **Type**
regex
### **Pattern**
  - for\s*\([^)]*\)\s*\{[^}]*await\s+getDoc
  - forEach\s*\([^)]*\)\s*\{[^}]*await\s+getDoc
  - \.map\s*\(\s*async[^)]*=>[^}]*getDoc
### **Message**
Sequential document reads - use Promise.all for parallel reads
### **Fix Action**
Collect document refs, then Promise.all(refs.map(ref => getDoc(ref)))
### **Applies To**
  - *.js
  - *.ts
  - *.jsx
  - *.tsx

## onSnapshot without cleanup

### **Id**
missing-unsubscribe
### **Severity**
warning
### **Type**
regex
### **Pattern**
  - onSnapshot\s*\([^)]+\)(?!.*unsubscribe)
  - onSnapshot\s*\([^)]+\)\s*;(?!.*return\s*\(\s*\)\s*=>)
### **Message**
onSnapshot listener may not be properly cleaned up
### **Fix Action**
Store unsubscribe function and call it on component unmount
### **Applies To**
  - *.js
  - *.ts
  - *.jsx
  - *.tsx

## Using JavaScript Date for Firestore timestamps

### **Id**
javascript-date-instead-of-timestamp
### **Severity**
info
### **Type**
regex
### **Pattern**
  - createdAt\s*:\s*new\s+Date\s*\(
  - updatedAt\s*:\s*new\s+Date\s*\(
  - timestamp\s*:\s*Date\.now\s*\(
### **Message**
Use serverTimestamp() or Timestamp.fromDate() instead of Date
### **Fix Action**
import { serverTimestamp } from 'firebase/firestore' and use serverTimestamp()
### **Applies To**
  - *.js
  - *.ts
  - *.jsx
  - *.tsx

## Using compatibility (v8) SDK instead of modular

### **Id**
compat-sdk-import
### **Severity**
info
### **Type**
regex
### **Pattern**
  - from\s+["']firebase/compat
  - require\s*\(\s*['"]firebase/compat
  - firebase\.firestore\(\)
  - firebase\.auth\(\)
### **Message**
Using v8 compat SDK - modular v9+ is smaller and tree-shakeable
### **Fix Action**
Migrate to modular imports: import { getFirestore } from 'firebase/firestore'
### **Applies To**
  - *.js
  - *.ts
  - *.jsx
  - *.tsx

## Collection paths duplicated across codebase

### **Id**
hardcoded-collection-path
### **Severity**
info
### **Type**
regex
### **Pattern**
  - collection\s*\(\s*db\s*,\s*['"]\w+['"]\s*\)
### **Message**
Consider centralizing collection paths in constants
### **Fix Action**
Create a collections.ts file with exported path constants
### **Applies To**
  - *.js
  - *.ts

## HTTP Cloud Function without authentication check

### **Id**
cloud-function-no-auth
### **Severity**
warning
### **Type**
regex
### **Pattern**
  - onRequest\s*\([^)]*,\s*async\s*\([^)]*\)\s*=>\s*\{(?!.*verifyIdToken)
  - https\.onRequest\s*\([^)]*\{(?!.*verifyIdToken)
### **Message**
HTTP function may not verify authentication
### **Fix Action**
Add token verification with getAuth().verifyIdToken(token)
### **Applies To**
  - **/functions/**/*.js
  - **/functions/**/*.ts

## Security rule without auth check

### **Id**
no-request-auth-check
### **Severity**
warning
### **Type**
regex
### **Pattern**
  - allow\s+(read|write|create|update|delete)\s*:\s*if(?!.*request\.auth)
### **Message**
Security rule doesn't check request.auth - may allow unauthenticated access
### **Fix Action**
Add request.auth != null or request.auth.uid == userId checks
### **Applies To**
  - *.rules
  - firestore.rules

## Write rule without data validation

### **Id**
no-data-validation
### **Severity**
info
### **Type**
regex
### **Pattern**
  - allow\s+(create|update)\s*:\s*if\s+request\.auth\s*!=\s*null\s*;
### **Message**
Write rule allows any data - consider validating request.resource.data
### **Fix Action**
Add data validation like request.resource.data.keys().hasAll(['field1', 'field2'])
### **Applies To**
  - *.rules
  - firestore.rules