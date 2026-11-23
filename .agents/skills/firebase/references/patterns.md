# Firebase

## Patterns


---
  #### **Name**
Modular SDK Import
  #### **Description**
Import only what you need for smaller bundles
  #### **When**
Client-side Firebase usage
  #### **Example**
    # MODULAR IMPORTS:
    
    """
    Firebase v9+ uses modular SDK. Import only what you need.
    This enables tree-shaking and smaller bundles.
    """
    
    // WRONG: v8-compat style (larger bundle)
    import firebase from 'firebase/compat/app';
    import 'firebase/compat/firestore';
    const db = firebase.firestore();
    
    // RIGHT: v9+ modular (tree-shakeable)
    import { initializeApp } from 'firebase/app';
    import { getFirestore, collection, doc, getDoc } from 'firebase/firestore';
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Get a document
    const docRef = doc(db, 'users', 'userId');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log(docSnap.data());
    }
    
    // Query with constraints
    import { query, where, orderBy, limit } from 'firebase/firestore';
    
    const q = query(
      collection(db, 'posts'),
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    

---
  #### **Name**
Security Rules Design
  #### **Description**
Secure your data with proper rules from day one
  #### **When**
Any Firestore database
  #### **Example**
    # FIRESTORE SECURITY RULES:
    
    """
    Rules are your last line of defense. Every read and write
    goes through them. Get them wrong, and your data is exposed.
    """
    
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
    
        // Helper functions
        function isSignedIn() {
          return request.auth != null;
        }
    
        function isOwner(userId) {
          return request.auth.uid == userId;
        }
    
        function isAdmin() {
          return request.auth.token.admin == true;
        }
    
        // Users collection
        match /users/{userId} {
          // Anyone can read public profile
          allow read: if true;
    
          // Only owner can write their own data
          allow write: if isOwner(userId);
    
          // Private subcollection
          match /private/{document=**} {
            allow read, write: if isOwner(userId);
          }
        }
    
        // Posts collection
        match /posts/{postId} {
          // Anyone can read published posts
          allow read: if resource.data.published == true
                      || isOwner(resource.data.authorId);
    
          // Only authenticated users can create
          allow create: if isSignedIn()
                        && request.resource.data.authorId == request.auth.uid;
    
          // Only author can update/delete
          allow update, delete: if isOwner(resource.data.authorId);
        }
    
        // Admin-only collection
        match /admin/{document=**} {
          allow read, write: if isAdmin();
        }
      }
    }
    

---
  #### **Name**
Data Modeling for Queries
  #### **Description**
Design Firestore data structure around query patterns
  #### **When**
Designing Firestore schema
  #### **Example**
    # FIRESTORE DATA MODELING:
    
    """
    Firestore is NOT relational. You can't JOIN.
    Design your data for how you'll QUERY it, not how it relates.
    """
    
    // WRONG: Normalized (SQL thinking)
    // users/{userId}
    // posts/{postId} with authorId field
    // To get "posts by user" - need to query posts collection
    
    // RIGHT: Denormalized for queries
    // users/{userId}/posts/{postId} - subcollection
    // OR
    // posts/{postId} with embedded author data
    
    // Document structure for a post
    const post = {
      id: 'post123',
      title: 'My Post',
      content: '...',
    
      // Embed frequently-needed author data
      author: {
        id: 'user456',
        name: 'Jane Doe',
        avatarUrl: '...'
      },
    
      // Arrays for IN queries (max 30 items for 'in')
      tags: ['javascript', 'firebase'],
    
      // Maps for compound queries
      stats: {
        likes: 42,
        comments: 7,
        views: 1000
      },
    
      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    
      // Booleans for filtering
      published: true,
      featured: false
    };
    
    // Query patterns this enables:
    // - Get post with author info: 1 read (no join needed)
    // - Posts by tag: where('tags', 'array-contains', 'javascript')
    // - Featured posts: where('featured', '==', true)
    // - Recent posts: orderBy('createdAt', 'desc')
    
    // When author updates their name, update all their posts
    // This is the tradeoff: writes are more complex, reads are fast
    

---
  #### **Name**
Real-time Listeners
  #### **Description**
Subscribe to data changes with proper cleanup
  #### **When**
Real-time features
  #### **Example**
    # REAL-TIME LISTENERS:
    
    """
    onSnapshot creates a persistent connection. Always unsubscribe
    when component unmounts to prevent memory leaks and extra reads.
    """
    
    // React hook for real-time document
    function useDocument(path) {
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
    
      useEffect(() => {
        const docRef = doc(db, path);
    
        // Subscribe to document
        const unsubscribe = onSnapshot(
          docRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setData({ id: snapshot.id, ...snapshot.data() });
            } else {
              setData(null);
            }
            setLoading(false);
          },
          (err) => {
            setError(err);
            setLoading(false);
          }
        );
    
        // Cleanup on unmount
        return () => unsubscribe();
      }, [path]);
    
      return { data, loading, error };
    }
    
    // Usage
    function UserProfile({ userId }) {
      const { data: user, loading } = useDocument(`users/${userId}`);
    
      if (loading) return <Spinner />;
      return <div>{user?.name}</div>;
    }
    
    // Collection with query
    function usePosts(limit = 10) {
      const [posts, setPosts] = useState([]);
    
      useEffect(() => {
        const q = query(
          collection(db, 'posts'),
          where('published', '==', true),
          orderBy('createdAt', 'desc'),
          limit(limit)
        );
    
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setPosts(results);
        });
    
        return () => unsubscribe();
      }, [limit]);
    
      return posts;
    }
    

---
  #### **Name**
Cloud Functions Patterns
  #### **Description**
Server-side logic with Cloud Functions v2
  #### **When**
Backend logic, triggers, scheduled tasks
  #### **Example**
    # CLOUD FUNCTIONS V2:
    
    """
    Cloud Functions run server-side code triggered by events.
    V2 uses more standard Node.js patterns and better scaling.
    """
    
    import { onRequest } from 'firebase-functions/v2/https';
    import { onDocumentCreated } from 'firebase-functions/v2/firestore';
    import { onSchedule } from 'firebase-functions/v2/scheduler';
    import { getFirestore } from 'firebase-admin/firestore';
    import { initializeApp } from 'firebase-admin/app';
    
    initializeApp();
    const db = getFirestore();
    
    // HTTP function
    export const api = onRequest(
      { cors: true, region: 'us-central1' },
      async (req, res) => {
        // Verify auth token
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
    
        try {
          const decoded = await getAuth().verifyIdToken(token);
          // Process request with decoded.uid
          res.json({ userId: decoded.uid });
        } catch (error) {
          res.status(401).json({ error: 'Invalid token' });
        }
      }
    );
    
    // Firestore trigger - on document create
    export const onUserCreated = onDocumentCreated(
      'users/{userId}',
      async (event) => {
        const snapshot = event.data;
        const userId = event.params.userId;
    
        if (!snapshot) return;
    
        const userData = snapshot.data();
    
        // Send welcome email, create related documents, etc.
        await db.collection('notifications').add({
          userId,
          type: 'welcome',
          message: `Welcome, ${userData.name}!`,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    );
    
    // Scheduled function (every day at midnight)
    export const dailyCleanup = onSchedule(
      { schedule: '0 0 * * *', timeZone: 'UTC' },
      async (event) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
    
        // Delete old documents
        const oldDocs = await db.collection('logs')
          .where('createdAt', '<', cutoff)
          .limit(500)
          .get();
    
        const batch = db.batch();
        oldDocs.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    
        console.log(`Deleted ${oldDocs.size} old logs`);
      }
    );
    

---
  #### **Name**
Batch Operations
  #### **Description**
Atomic writes and transactions for consistency
  #### **When**
Multiple document updates that must succeed together
  #### **Example**
    # BATCH WRITES AND TRANSACTIONS:
    
    """
    Batches: Multiple writes that all succeed or all fail.
    Transactions: Read-then-write operations with consistency.
    Max 500 operations per batch/transaction.
    """
    
    import {
      writeBatch, runTransaction, doc, getDoc,
      increment, serverTimestamp
    } from 'firebase/firestore';
    
    // Batch write - no reads, just writes
    async function createPostWithTags(post, tags) {
      const batch = writeBatch(db);
    
      // Create post
      const postRef = doc(collection(db, 'posts'));
      batch.set(postRef, {
        ...post,
        createdAt: serverTimestamp()
      });
    
      // Update tag counts
      for (const tag of tags) {
        const tagRef = doc(db, 'tags', tag);
        batch.set(tagRef, {
          count: increment(1),
          lastUsed: serverTimestamp()
        }, { merge: true });
      }
    
      await batch.commit();
      return postRef.id;
    }
    
    // Transaction - read and write atomically
    async function likePost(postId, userId) {
      return runTransaction(db, async (transaction) => {
        const postRef = doc(db, 'posts', postId);
        const likeRef = doc(db, 'posts', postId, 'likes', userId);
    
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
          throw new Error('Post not found');
        }
    
        const likeSnap = await transaction.get(likeRef);
        if (likeSnap.exists()) {
          throw new Error('Already liked');
        }
    
        // Increment like count and add like document
        transaction.update(postRef, {
          likeCount: increment(1)
        });
    
        transaction.set(likeRef, {
          userId,
          createdAt: serverTimestamp()
        });
    
        return postSnap.data().likeCount + 1;
      });
    }
    

---
  #### **Name**
Social Login (Google, GitHub, etc.)
  #### **Description**
OAuth provider setup and authentication flows
  #### **When**
Social login implementation
  #### **Example**
    # SOCIAL LOGIN WITH FIREBASE AUTH
    
    import {
      getAuth, signInWithPopup, signInWithRedirect,
      GoogleAuthProvider, GithubAuthProvider, OAuthProvider
    } from "firebase/auth";
    
    const auth = getAuth();
    
    // GOOGLE
    const googleProvider = new GoogleAuthProvider();
    googleProvider.addScope("email");
    googleProvider.setCustomParameters({ prompt: "select_account" });
    
    async function signInWithGoogle() {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
      } catch (error) {
        if (error.code === "auth/account-exists-with-different-credential") {
          return handleAccountConflict(error);
        }
        throw error;
      }
    }
    
    // GITHUB
    const githubProvider = new GithubAuthProvider();
    githubProvider.addScope("read:user");
    
    // APPLE (Required for iOS apps!)
    const appleProvider = new OAuthProvider("apple.com");
    appleProvider.addScope("email");
    appleProvider.addScope("name");
    

---
  #### **Name**
Popup vs Redirect Auth
  #### **Description**
When to use popup vs redirect for OAuth
  #### **When**
Choosing authentication flow
  #### **Example**
    # Popup: Desktop, SPA (simpler, can be blocked)
    # Redirect: Mobile, iOS Safari (always works)
    
    async function signIn(provider) {
      if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
        return signInWithRedirect(auth, provider);
      }
      try {
        return await signInWithPopup(auth, provider);
      } catch (e) {
        if (e.code === "auth/popup-blocked") {
          return signInWithRedirect(auth, provider);
        }
        throw e;
      }
    }
    
    // Check redirect result on page load
    useEffect(() => {
      getRedirectResult(auth).then(r => r && setUser(r.user));
    }, []);
    

---
  #### **Name**
Account Linking
  #### **Description**
Link multiple providers to one account
  #### **When**
User has accounts with different providers
  #### **Example**
    import { fetchSignInMethodsForEmail, linkWithCredential } from "firebase/auth";
    
    async function handleAccountConflict(error) {
      const email = error.customData?.email;
      const pendingCred = OAuthProvider.credentialFromError(error);
      const methods = await fetchSignInMethodsForEmail(auth, email);
    
      if (methods.includes("google.com")) {
        alert("Sign in with Google to link accounts");
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await linkWithCredential(result.user, pendingCred);
        return result.user;
      }
    }
    
    // Link new provider
    await linkWithPopup(auth.currentUser, new GithubAuthProvider());
    
    // Unlink provider (keep at least one!)
    await unlink(auth.currentUser, "github.com");
    

---
  #### **Name**
Auth State Persistence
  #### **Description**
Control session lifetime
  #### **When**
Managing user sessions
  #### **Example**
    import { setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
    
    // LOCAL: survives browser close (default)
    // SESSION: cleared on tab close
    
    async function signInWithRememberMe(email, pass, remember) {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      return signInWithEmailAndPassword(auth, email, pass);
    }
    
    // React auth hook
    function useAuth() {
      const [user, setUser] = useState(null);
      const [loading, setLoading] = useState(true);
      useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }), []);
      return { user, loading };
    }
    

---
  #### **Name**
Email Verification and Password Reset
  #### **Description**
Complete email auth flow
  #### **When**
Email/password authentication
  #### **Example**
    import { sendEmailVerification, sendPasswordResetEmail, reauthenticateWithCredential } from "firebase/auth";
    
    // Sign up with verification
    async function signUp(email, password) {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user);
      return result.user;
    }
    
    // Password reset
    await sendPasswordResetEmail(auth, email);
    
    // Change password (requires recent auth)
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPass);
    

---
  #### **Name**
Token Management for APIs
  #### **Description**
Handle ID tokens for backend calls
  #### **When**
Authenticating with backend APIs
  #### **Example**
    import { getIdToken, onIdTokenChanged } from "firebase/auth";
    
    // Get token (auto-refreshes if expired)
    const token = await getIdToken(auth.currentUser);
    
    // API helper with auto-retry
    async function apiCall(url, opts = {}) {
      const token = await getIdToken(auth.currentUser);
      const res = await fetch(url, {
        ...opts,
        headers: { ...opts.headers, Authorization: "Bearer " + token }
      });
      if (res.status === 401) {
        const newToken = await getIdToken(auth.currentUser, true);
        return fetch(url, { ...opts, headers: { ...opts.headers, Authorization: "Bearer " + newToken }});
      }
      return res;
    }
    
    // Sync to cookie for SSR
    onIdTokenChanged(auth, async u => {
      document.cookie = u ? "__session=" + await u.getIdToken() : "__session=; max-age=0";
    });
    
    // Check admin claim
    const { claims } = await auth.currentUser.getIdTokenResult();
    const isAdmin = claims.admin === true;
    

## Anti-Patterns


---
  #### **Name**
No Security Rules
  #### **Description**
Leaving default rules or using allow all
  #### **Why**
    Default rules deny all access (good) or some tutorials suggest
    allow read, write: if true (catastrophic). Your database is
    public. Anyone can read all data, delete everything.
    
  #### **Instead**
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Default deny
        match /{document=**} {
          allow read, write: if false;
        }
    
        // Explicitly allow what's needed
        match /public/{docId} {
          allow read: if true;
          allow write: if request.auth != null;
        }
      }
    }
    

---
  #### **Name**
Client-Side Admin Operations
  #### **Description**
Using Firebase Admin SDK in client code
  #### **Why**
    Admin SDK bypasses all security rules and has full access.
    If your client code has admin credentials, anyone can
    steal them and destroy your database.
    
  #### **Instead**
    // Client: Use regular Firebase SDK
    import { getFirestore } from 'firebase/firestore';
    
    // Server (Cloud Functions): Use Admin SDK
    import { getFirestore } from 'firebase-admin/firestore';
    
    // Never expose admin credentials to clients
    // Use Cloud Functions for admin operations
    

---
  #### **Name**
Listener on Large Collections
  #### **Description**
Attaching onSnapshot to collections without limits
  #### **Why**
    You pay for every document read. A listener on a 100k document
    collection reads ALL of them on attach, then on every change.
    This can cost hundreds of dollars per day.
    
  #### **Instead**
    // WRONG: Listener on entire collection
    onSnapshot(collection(db, 'messages'), ...);
    
    // RIGHT: Always limit and filter
    const q = query(
      collection(db, 'messages'),
      where('roomId', '==', currentRoom),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    onSnapshot(q, ...);
    

---
  #### **Name**
Ignoring Offline Persistence
  #### **Description**
Not understanding offline behavior
  #### **Why**
    Firestore caches data locally by default on mobile/web.
    Writes go to cache first, then sync. If you're not handling
    pending writes, users see stale data or duplicates.
    
  #### **Instead**
    // Check if data is from cache
    onSnapshot(docRef, { includeMetadataChanges: true }, (snapshot) => {
      const source = snapshot.metadata.fromCache ? 'cache' : 'server';
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;
    
      if (hasPendingWrites) {
        // Show pending indicator
      }
    });
    
    // Disable offline persistence if not needed (reduces storage)
    import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
    const db = initializeFirestore(app, {
      localCache: null // Disable
    });
    

---
  #### **Name**
Sequential Document Reads
  #### **Description**
Reading documents one at a time in a loop
  #### **Why**
    Each getDoc is a separate round trip. Reading 100 documents
    one by one is slow and still charges 100 reads.
    
  #### **Instead**
    // WRONG: Sequential reads
    const users = [];
    for (const id of userIds) {
      const snap = await getDoc(doc(db, 'users', id));
      users.push(snap.data());
    }
    
    // RIGHT: Parallel reads with Promise.all
    const userRefs = userIds.map(id => doc(db, 'users', id));
    const snapshots = await Promise.all(
      userRefs.map(ref => getDoc(ref))
    );
    const users = snapshots.map(snap => snap.data());
    
    // BETTER: Use getAll in Admin SDK (Cloud Functions)
    const snapshots = await db.getAll(...userRefs);
    