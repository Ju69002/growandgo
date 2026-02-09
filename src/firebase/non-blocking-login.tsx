
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
 * Déclenché uniquement par action utilisateur.
 */
export async function signInWithGoogleCalendar(authInstance: Auth) {
  const provider = new GoogleAuthProvider();
  // Ajout des scopes Google Calendar
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  
  // Force l'affichage de la fenêtre de sélection de compte si nécessaire
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
