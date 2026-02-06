'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  UserCredential
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
 * Sign in with Google and request Calendar scopes 
 */
export async function signInWithGoogleCalendar(authInstance: Auth): Promise<{ credential: UserCredential, token: string | undefined }> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.events.readonly');
  
  const result = await signInWithPopup(authInstance, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return { credential: result, token: credential?.accessToken };
}

/** 
 * Sign in with Microsoft/Outlook and request Calendar scopes 
 */
export async function signInWithOutlookCalendar(authInstance: Auth): Promise<{ credential: UserCredential, token: string | undefined }> {
  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('Calendars.Read');
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  const result = await signInWithPopup(authInstance, provider);
  const credential = OAuthProvider.credentialFromResult(result);
  return { credential: result, token: credential?.accessToken };
}
