'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password);
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password);
}

/** 
 * Sign in with Google and request Calendar scopes.
 */
export async function signInWithGoogleCalendar(authInstance: Auth) {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  try {
    const result = await signInWithPopup(authInstance, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { user: result.user, token: credential?.accessToken };
  } catch (error) {
    console.error("Google Auth Error:", error);
    throw error;
  }
}

/** 
 * Sign in with Microsoft and request Calendar scopes.
 */
export async function signInWithOutlookCalendar(authInstance: Auth) {
  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('Calendars.Read');
  try {
    const result = await signInWithPopup(authInstance, provider);
    const credential = OAuthProvider.credentialFromResult(result);
    return { user: result.user, token: credential?.accessToken };
  } catch (error) {
    console.error("Microsoft Auth Error:", error);
    throw error;
  }
}
