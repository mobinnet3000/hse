# Firebase - Sharp Edges

## Security Rules Allow All

### **Id**
security-rules-allow-all
### **Summary**
"allow read, write: if true" exposes your entire database
### **Severity**
critical
### **Situation**
  You're prototyping fast, so you set security rules to allow everything.
  Or you copied rules from a tutorial that says "for testing only."
  You forget to fix them before launch.
  
### **Why**
  Anyone can read all your data. Anyone can delete everything. Anyone can
  write anything. Your users' private data is public. This is not theoretical -
  databases get scraped within hours of being discovered.
  
### **Solution**
  # SECURE RULES FROM DAY ONE
  
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      // DEFAULT DENY - nothing gets through unless explicitly allowed
      match /{document=**} {
        allow read, write: if false;
      }
  
      // Explicitly allow what's needed
      match /users/{userId} {
        allow read: if request.auth != null;
        allow write: if request.auth.uid == userId;
      }
  
      match /posts/{postId} {
        allow read: if resource.data.published == true;
        allow create: if request.auth != null
                      && request.resource.data.authorId == request.auth.uid;
        allow update, delete: if request.auth.uid == resource.data.authorId;
      }
    }
  }
  
  # Test your rules!
  npm install -g firebase-tools
  firebase emulators:start
  # Run @firebase/rules-unit-testing tests
  
### **Symptoms**
  - Unknown users in your database
  - Data appears deleted or modified
  - Complaints about leaked data
### **Detection Pattern**
allow\s+(read|write)[^;]*:\s*if\s+true

## Firestore Query Cost Explosion

### **Id**
firestore-query-cost-explosion
### **Summary**
Listeners on large collections cause massive read costs
### **Severity**
critical
### **Situation**
  You attach an onSnapshot listener to a collection without filters.
  The collection grows to 100k documents. Every time any document
  changes, your listener fires. Your bill explodes.
  
### **Why**
  Firestore charges per document read. When you attach a listener to a
  collection, you're billed for reading every document. If the collection
  has 100k docs, that's 100k reads. Each time a document changes, you pay
  for the read. With active data, this compounds.
  
### **Solution**
  # ALWAYS LIMIT AND FILTER LISTENERS
  
  // DANGEROUS: No limits
  onSnapshot(collection(db, 'messages'), callback);
  
  // SAFE: Scoped and limited
  const q = query(
    collection(db, 'messages'),
    where('roomId', '==', currentRoom),  // Filter to relevant docs
    orderBy('createdAt', 'desc'),
    limit(50)  // Cap the reads
  );
  onSnapshot(q, callback);
  
  // For large datasets, use pagination
  const first = query(
    collection(db, 'posts'),
    orderBy('createdAt'),
    limit(25)
  );
  
  // Get next page
  const next = query(
    collection(db, 'posts'),
    orderBy('createdAt'),
    startAfter(lastDoc),
    limit(25)
  );
  
  # Monitor usage in Firebase Console
  # Set up billing alerts!
  
### **Symptoms**
  - Unexpectedly high Firebase bill
  - Console shows millions of reads
  - App slows down with data growth
### **Detection Pattern**
onSnapshot\s*\(\s*collection\s*\([^)]+\)\s*,

## No Unsubscribe Memory Leak

### **Id**
no-unsubscribe-memory-leak
### **Summary**
Firestore listeners without cleanup leak memory and cost money
### **Severity**
high
### **Situation**
  You set up onSnapshot listeners but don't unsubscribe when the
  component unmounts. Listeners accumulate. Memory usage grows.
  You're paying for reads on components that don't exist anymore.
  
### **Why**
  onSnapshot returns an unsubscribe function. If you don't call it,
  the listener stays active forever. In React, every mount without
  unmount cleanup creates another listener. After navigating around,
  you might have dozens of duplicate listeners.
  
### **Solution**
  # ALWAYS UNSUBSCRIBE
  
  // React with useEffect
  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      setData(snapshot.data());
    });
  
    // Cleanup on unmount
    return () => unsubscribe();
  }, [docRef]);
  
  // Class component
  componentDidMount() {
    this.unsubscribe = onSnapshot(docRef, ...);
  }
  
  componentWillUnmount() {
    this.unsubscribe?.();
  }
  
  // Vue with onUnmounted
  onMounted(() => {
    unsubscribe = onSnapshot(docRef, ...);
  });
  
  onUnmounted(() => {
    unsubscribe();
  });
  
### **Symptoms**
  - Memory usage grows over time
  - Duplicate data updates
  - Reads continue after navigating away
### **Detection Pattern**
onSnapshot\s*\([^)]+\)(?!.*unsubscribe)

## Admin Sdk In Client

### **Id**
admin-sdk-in-client
### **Summary**
Firebase Admin SDK credentials exposed in client code
### **Severity**
critical
### **Situation**
  You need to do something that requires admin access. You import
  firebase-admin in your client code and include the service account
  key. Your app works, but anyone can extract those credentials.
  
### **Why**
  Admin SDK has unlimited access. It bypasses all security rules.
  With admin credentials, an attacker can: read all data, delete
  everything, impersonate any user, modify authentication. Game over.
  
### **Solution**
  # ADMIN SDK = SERVER ONLY
  
  // CLIENT CODE - use regular SDK
  import { initializeApp } from 'firebase/app';
  import { getFirestore } from 'firebase/firestore';
  
  const app = initializeApp({
    apiKey: "...",  // This is OK to expose
    // ...client config
  });
  
  // SERVER CODE (Cloud Functions, Node.js backend)
  import { initializeApp, cert } from 'firebase-admin/app';
  import { getFirestore } from 'firebase-admin/firestore';
  
  // In Cloud Functions, auto-initializes
  initializeApp();
  
  // In other servers, use service account
  initializeApp({
    credential: cert(serviceAccount)  // NEVER in client!
  });
  
  # For operations requiring admin access:
  # 1. Create a Cloud Function
  # 2. Call it from client with user's auth token
  # 3. Verify token in function
  # 4. Perform admin operation
  
### **Symptoms**
  - Service account JSON in client bundle
  - firebase-admin in client dependencies
  - Full database access without rules
### **Detection Pattern**
firebase-admin|credential.*cert\s*\(

## No Auth Verification Functions

### **Id**
no-auth-verification-functions
### **Summary**
Cloud Functions don't verify authentication
### **Severity**
critical
### **Situation**
  You create an HTTP Cloud Function. You assume only your app calls
  it. You don't verify the auth token. Anyone who finds the URL can
  call your function with any data.
  
### **Why**
  Cloud Function URLs are public. Anyone can call them. Without auth
  verification, there's no way to know who's calling. Attackers can
  abuse your function, access other users' data, or rack up your bill.
  
### **Solution**
  # VERIFY AUTH IN EVERY FUNCTION
  
  import { onRequest } from 'firebase-functions/v2/https';
  import { getAuth } from 'firebase-admin/auth';
  
  export const secureEndpoint = onRequest(
    { cors: true },
    async (req, res) => {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }
  
      const token = authHeader.split('Bearer ')[1];
  
      try {
        // Verify the token
        const decoded = await getAuth().verifyIdToken(token);
  
        // Now you know who's calling
        const userId = decoded.uid;
  
        // Proceed with operation
        res.json({ userId, message: 'Authenticated!' });
  
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
      }
    }
  );
  
  // Client-side: include token in requests
  const token = await getAuth().currentUser.getIdToken();
  const response = await fetch(functionUrl, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
### **Symptoms**
  - Function accessible without login
  - Unknown users triggering functions
  - Abuse of function endpoints
### **Detection Pattern**
onRequest\s*\([^)]*\)[^{]*\{(?!.*verifyIdToken)

## Firestore Relational Thinking

### **Id**
firestore-relational-thinking
### **Summary**
Designing Firestore like a relational database
### **Severity**
high
### **Situation**
  You design your Firestore schema with normalized data, expecting
  to JOIN collections like SQL. Then you realize Firestore can't
  join. You're stuck with N+1 queries or a complete redesign.
  
### **Why**
  Firestore has no joins. Period. If you need data from two
  collections, that's two queries. If you need to get a post and
  its author separately for every post, that's N+1 reads. This is
  slow and expensive.
  
### **Solution**
  # DENORMALIZE FOR QUERIES
  
  // WRONG: Normalized (SQL thinking)
  // posts/{postId}: { title, authorId }
  // users/{userId}: { name, avatar }
  // To display: 2 queries per post
  
  // RIGHT: Embed frequently-needed data
  // posts/{postId}
  {
    title: "My Post",
    content: "...",
    author: {
      id: "user123",
      name: "Jane Doe",
      avatar: "https://..."
    },
    createdAt: Timestamp
  }
  
  // Trade-off: When author updates profile,
  // update all their posts too
  
  async function updateUserName(userId, newName) {
    const batch = writeBatch(db);
  
    // Update user document
    batch.update(doc(db, 'users', userId), { name: newName });
  
    // Update all user's posts
    const posts = await getDocs(
      query(collection(db, 'posts'),
        where('author.id', '==', userId))
    );
  
    posts.docs.forEach(post => {
      batch.update(post.ref, { 'author.name': newName });
    });
  
    await batch.commit();
  }
  
### **Symptoms**
  - Many sequential reads
  - Can't query across collections
  - Slow list views
### **Detection Pattern**


## Emulator Not Used

### **Id**
emulator-not-used
### **Summary**
Testing against production instead of emulators
### **Severity**
medium
### **Situation**
  You're developing and testing directly against your production
  Firebase project. Your test data mixes with real data. A bug in
  your test code deletes production documents.
  
### **Why**
  Production data is precious. Test data is garbage. When they mix,
  you can't tell them apart. When your tests delete "all documents
  in collection," they might delete real user data.
  
### **Solution**
  # USE FIREBASE EMULATORS
  
  # Install Firebase CLI
  npm install -g firebase-tools
  
  # Initialize emulators
  firebase init emulators
  
  # Start emulators
  firebase emulators:start
  
  // Connect to emulators in development
  import { connectFirestoreEmulator } from 'firebase/firestore';
  import { connectAuthEmulator } from 'firebase/auth';
  
  if (process.env.NODE_ENV === 'development') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
  }
  
  // In tests
  import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
  
  const testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8')
    }
  });
  
  // Clean up after tests
  await testEnv.clearFirestore();
  
### **Symptoms**
  - Test data in production
  - Accidentally deleted real data
  - No local development possible offline
### **Detection Pattern**


## Timestamp Confusion

### **Id**
timestamp-confusion
### **Summary**
Using JavaScript Date instead of Firestore Timestamp
### **Severity**
medium
### **Situation**
  You store timestamps as JavaScript Date objects or ISO strings.
  Firestore queries on date ranges don't work as expected. Timezone
  issues appear. Ordering is wrong.
  
### **Why**
  Firestore has a native Timestamp type. It's what you should use.
  JavaScript Dates get serialized as strings or maps, not Timestamps.
  Queries like where('createdAt', '>', someDate) may not work.
  
### **Solution**
  # USE FIRESTORE TIMESTAMPS
  
  import { serverTimestamp, Timestamp } from 'firebase/firestore';
  
  // WRONG: JavaScript Date
  await setDoc(docRef, {
    createdAt: new Date()  // Serialized inconsistently
  });
  
  // RIGHT: Server timestamp (set by server)
  await setDoc(docRef, {
    createdAt: serverTimestamp()  // Always accurate
  });
  
  // RIGHT: Explicit Timestamp
  await setDoc(docRef, {
    scheduledFor: Timestamp.fromDate(new Date('2024-12-31'))
  });
  
  // Querying with timestamps
  const yesterday = Timestamp.fromDate(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  
  const recentPosts = await getDocs(
    query(
      collection(db, 'posts'),
      where('createdAt', '>', yesterday),
      orderBy('createdAt', 'desc')
    )
  );
  
  // Converting to JavaScript Date
  const createdAt = doc.data().createdAt.toDate();
  
### **Symptoms**
  - Date queries return wrong results
  - Timezone inconsistencies
  - orderBy on dates doesn't work
### **Detection Pattern**
new Date\s*\(\s*\)|Date\.now\s*\(\s*\)

## Popup Blocked No Fallback

### **Id**
popup-blocked-no-fallback
### **Summary**
Popup auth fails silently when blocked
### **Severity**
high
### **Situation**
  User clicks "Sign in with Google", nothing happens. No error shown.
  Their browser or popup blocker silently prevented the popup.
  
### **Why**
  Many browsers block popups by default. Safari blocks cross-origin popups.
  Mobile browsers often block them. If you only use signInWithPopup,
  a significant portion of users cannot sign in.
  
### **Solution**
  # ALWAYS HAVE REDIRECT FALLBACK
  
  async function signIn(provider) {
    try {
      return await signInWithPopup(auth, provider);
    } catch (error) {
      if (error.code === "auth/popup-blocked") {
        // Fallback to redirect
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw error;
    }
  }
  
  // Or detect mobile and use redirect directly
  if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
    await signInWithRedirect(auth, provider);
  } else {
    await signInWithPopup(auth, provider);
  }
  
### **Symptoms**
  - Sign in button does nothing on some browsers
  - Works on desktop but not mobile
  - Safari users cannot sign in

## Account Exists Different Credential

### **Id**
account-exists-different-credential
### **Summary**
Same email with different providers causes confusing error
### **Severity**
high
### **Situation**
  User signs up with Google (john@gmail.com). Later tries to sign in
  with GitHub using same email. Gets cryptic error. Cannot sign in.
  No guidance on what to do.
  
### **Why**
  Firebase links accounts by email by default. When same email exists
  with different provider, auth/account-exists-with-different-credential
  is thrown. Users have no idea what this means.
  
### **Solution**
  # HANDLE ACCOUNT LINKING
  
  async function signIn(provider) {
    try {
      return await signInWithPopup(auth, provider);
    } catch (error) {
      if (error.code === "auth/account-exists-with-different-credential") {
        const email = error.customData?.email;
        const methods = await fetchSignInMethodsForEmail(auth, email);
  
        // Tell user what to do
        const existingProvider = methods[0];
        alert("You already have an account with " + existingProvider + 
              ". Sign in with that to link your accounts.");
  
        // Optionally auto-redirect to existing provider
        return null;
      }
      throw error;
    }
  }
  
### **Symptoms**
  - Users report cannot sign in
  - Error message about different credential
  - Support tickets about account access

## Apple Name Only First Signin

### **Id**
apple-name-only-first-signin
### **Summary**
Apple only provides user name on first sign-in
### **Severity**
medium
### **Situation**
  User signs in with Apple. You show their name. They sign out and
  back in. Name is now null. Apple only sends name ONCE, on first auth.
  
### **Why**
  Apple privacy feature - they only share name on initial authorization.
  If you dont save it immediately to your database, its gone forever.
  User would need to revoke app access in Apple settings and re-auth.
  
### **Solution**
  # SAVE APPLE NAME IMMEDIATELY
  
  async function signInWithApple() {
    const result = await signInWithPopup(auth, appleProvider);
  
    // Extract name from the credential (only available first time!)
    const fullName = result._tokenResponse?.fullName;
  
    if (fullName?.firstName) {
      // Save to user profile immediately
      await updateProfile(result.user, {
        displayName: fullName.firstName + " " + fullName.lastName
      });
  
      // Also save to your database
      await saveUserToDb(result.user.uid, {
        name: fullName.firstName + " " + fullName.lastName,
        email: result.user.email
      });
    }
  
    return result.user;
  }
  
### **Symptoms**
  - Apple users have no display name after second sign-in
  - Name shows as null or undefined
  - Cannot recover name without user revoking access

## Token Not Refreshed

### **Id**
token-not-refreshed
### **Summary**
Using stale token for API calls
### **Severity**
high
### **Situation**
  User stays on page for 2 hours. Makes API call. Token expired.
  Backend rejects with 401. User has to refresh page to fix it.
  
### **Why**
  Firebase ID tokens expire after 1 hour. Firebase auto-refreshes
  the token, but if you cached it (in a variable, cookie, or header),
  youre sending the stale one.
  
### **Solution**
  # ALWAYS GET FRESH TOKEN
  
  // WRONG: Cache token once
  const token = await user.getIdToken();
  // ... later, token might be expired
  
  // RIGHT: Get fresh token for each call
  async function apiCall(url) {
    const token = await getIdToken(auth.currentUser); // Auto-refreshes
    return fetch(url, {
      headers: { Authorization: "Bearer " + token }
    });
  }
  
  // RIGHT: Handle 401 with force refresh
  async function apiCall(url) {
    let token = await getIdToken(auth.currentUser);
    let res = await fetch(url, { headers: { Authorization: "Bearer " + token }});
  
    if (res.status === 401) {
      token = await getIdToken(auth.currentUser, true); // Force refresh
      res = await fetch(url, { headers: { Authorization: "Bearer " + token }});
    }
    return res;
  }
  
### **Symptoms**
  - API calls fail after user idle for 1+ hour
  - 401 errors from backend
  - Works after page refresh

## Redirect Result Not Checked

### **Id**
redirect-result-not-checked
### **Summary**
Redirect auth result never handled
### **Severity**
high
### **Situation**
  User clicks sign in, gets redirected to Google, comes back to app.
  Nothing happens. Theyre not signed in. The redirect result was ignored.
  
### **Why**
  signInWithRedirect navigates away. When user returns, you must call
  getRedirectResult to complete the sign-in. If you dont check on
  page load, the auth flow is never completed.
  
### **Solution**
  # CHECK REDIRECT RESULT ON LOAD
  
  // In your app initialization
  useEffect(() => {
    async function checkRedirect() {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User just signed in via redirect
          console.log("Signed in:", result.user.email);
          // Navigate to dashboard, etc.
        }
      } catch (error) {
        console.error("Redirect error:", error);
      }
    }
    checkRedirect();
  }, []);
  
  // Or in Next.js
  // pages/_app.js or app/layout.tsx
  useEffect(() => {
    getRedirectResult(auth).catch(console.error);
  }, []);
  
### **Symptoms**
  - Redirect sign-in does not complete
  - User returns to app but not signed in
  - Works with popup but not redirect