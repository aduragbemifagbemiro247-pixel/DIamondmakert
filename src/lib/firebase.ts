import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testFirestoreConnection();

export interface CustomerAddressDoc {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export interface CustomerProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  wooCustomerId?: number;
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  return cred.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function resetUserPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutFirebaseUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureFirestoreUserProfile(
  user: User,
  wooCustomerId?: number
): Promise<CustomerProfileDoc> {
  const ref = doc(db, 'users', user.uid);
  const path = `users/${user.uid}`;
  try {
    const snap = await getDoc(ref);
    const displayName = (user.displayName || user.email?.split('@')[0] || 'Customer').slice(0, 120);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        email: (user.email || '').slice(0, 254),
        displayName,
        phone: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (typeof wooCustomerId === 'number') {
        payload.wooCustomerId = wooCustomerId;
      }
      await setDoc(ref, payload);
      return {
        uid: user.uid,
        email: user.email || '',
        displayName,
        phone: '',
        wooCustomerId,
      };
    }

    const existing = snap.data() as CustomerProfileDoc;
    if (typeof wooCustomerId === 'number' && existing.wooCustomerId !== wooCustomerId) {
      await updateDoc(ref, {
        wooCustomerId,
        updatedAt: serverTimestamp(),
      });
    }
    return existing;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateFirestoreUserProfile(
  uid: string,
  patch: { displayName: string; phone: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: patch.displayName.trim().slice(0, 120),
      phone: patch.phone.trim().slice(0, 24),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchFirestoreAddresses(uid: string): Promise<CustomerAddressDoc[]> {
  const path = `users/${uid}/addresses`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'addresses'));
    return snap.docs.map((d) => d.data() as CustomerAddressDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveFirestoreAddress(
  uid: string,
  addr: CustomerAddressDoc
): Promise<void> {
  const cleanId = addr.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `addr_${Date.now()}`;
  const path = `users/${uid}/addresses/${cleanId}`;
  const ref = doc(db, 'users', uid, 'addresses', cleanId);
  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        id: cleanId,
        label: addr.label.trim().slice(0, 40),
        firstName: addr.firstName.trim().slice(0, 60),
        lastName: addr.lastName.trim().slice(0, 60),
        phone: addr.phone.trim().slice(0, 20),
        street: addr.street.trim().slice(0, 200),
        city: addr.city.trim().slice(0, 80),
        state: addr.state.trim().slice(0, 50),
        country: 'NG',
        isDefault: Boolean(addr.isDefault),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        label: addr.label.trim().slice(0, 40),
        firstName: addr.firstName.trim().slice(0, 60),
        lastName: addr.lastName.trim().slice(0, 60),
        phone: addr.phone.trim().slice(0, 20),
        street: addr.street.trim().slice(0, 200),
        city: addr.city.trim().slice(0, 80),
        state: addr.state.trim().slice(0, 50),
        country: 'NG',
        isDefault: Boolean(addr.isDefault),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteFirestoreAddress(uid: string, addressId: string): Promise<void> {
  const path = `users/${uid}/addresses/${addressId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'addresses', addressId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchFirestoreWishlist(uid: string): Promise<string[]> {
  const path = `users/${uid}/wishlist`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'wishlist'));
    return snap.docs.map((d) => d.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function addFirestoreWishlistItem(uid: string, productId: string): Promise<void> {
  const cleanId = productId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `users/${uid}/wishlist/${cleanId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'wishlist', cleanId), {
      productId: cleanId,
      addedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function removeFirestoreWishlistItem(uid: string, productId: string): Promise<void> {
  const path = `users/${uid}/wishlist/${productId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'wishlist', productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
