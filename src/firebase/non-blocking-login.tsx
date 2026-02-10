
'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';

/** Sign-in standard (Email/Password). */
export async function initiateEmailSignIn(authInstance: Auth, email: string, password: string) {
  return signInWithEmailAndPassword(authInstance, email, password);
}

/** 
 * Sign in with Google (Découplé).
 * Utilisé pour Google Calendar.
 */
export async function signInWithGoogleCalendar(authInstance: Auth) {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  provider.setCustomParameters({ prompt: 'select_account' });
  
  const result = await signInWithPopup(authInstance, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  
  return { user: result.user, token };
}

/** 
 * Sign in with Google pour Drive.
 */
export async function signInWithGoogleDrive(authInstance: Auth) {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({ prompt: 'select_account' });
  
  const result = await signInWithPopup(authInstance, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  
  return { user: result.user, token };
}

/** Envoyer un e-mail de réinitialisation. */
export async function sendResetEmail(authInstance: Auth, email: string) {
  return sendPasswordResetEmail(authInstance, email);
}
