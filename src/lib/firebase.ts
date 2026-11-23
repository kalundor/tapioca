import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const BASE_SCOPES = [
  'openid',
  'email',
  'profile',
];

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
];

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleAuthProvider = new GoogleAuthProvider();
for (const scope of BASE_SCOPES) {
  googleAuthProvider.addScope(scope);
}

export const workspaceAuthProvider = new GoogleAuthProvider();
for (const scope of [...BASE_SCOPES, ...WORKSPACE_SCOPES]) {
  workspaceAuthProvider.addScope(scope);
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedIdToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, accessToken: string | null, idToken: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        const idToken = await user.getIdToken();
        cachedIdToken = idToken;
        if (onAuthSuccess) {
          onAuthSuccess(user, cachedAccessToken, idToken);
        }
      } catch {
        cachedAccessToken = null;
        cachedIdToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      cachedIdToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (withWorkspaceScopes = false): Promise<{
  user: User;
  accessToken: string;
  idToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const provider = withWorkspaceScopes ? workspaceAuthProvider : googleAuthProvider;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    cachedIdToken = await result.user.getIdToken();
    return {
      user: result.user,
      accessToken: cachedAccessToken || '',
      idToken: cachedIdToken,
    };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      // User simply closed the popup before finishing login. Clean exit.
      return null;
    }
    if (error?.code === 'auth/popup-blocked') {
      console.warn('Google Sign-In popup was blocked by the browser.');
      throw new Error(
        'O pop-up de login foi bloqueado pelo navegador. Por favor, habilite pop-ups para fazer login.'
      );
    }
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getIdToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    cachedIdToken = await auth.currentUser.getIdToken();
  }
  return cachedIdToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedIdToken = null;
};

export const PROJECT_ID = firebaseConfig.projectId;
