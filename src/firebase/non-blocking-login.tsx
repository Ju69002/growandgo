'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
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
 * Sign in with Google and request Calendar scopes (Read & Write).
 */
export async function signInWithGoogleCalendar(authInstance: Auth) {
  const provider = new GoogleAuthProvider();
  // We need 'calendar.events' to be able to create events, not just 'readonly'
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  try {
    const result = await signInWithPopup(authInstance, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { user: result.user, token: credential?.accessToken };
  } catch (error) {
    console.error("Google Auth Error:", error);
    throw error;
  }
}
