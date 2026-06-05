import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Services with long-polling to prevent proxy/WebSocket timeout issues
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

// ===== SOLUCIÓN PARA EL ERROR DE DOMINIO =====
export const auth = getAuth(app);

// Verificar el dominio actual y mostrar información de depuración
const currentDomain = window.location.origin;
console.log('🌐 Dominio actual:', currentDomain);
console.log('🔐 Auth Domain configurado:', auth.config?.authDomain);
console.log('📋 Proyecto Firebase:', firebaseConfig.projectId);

// Verificar si el dominio está autorizado (solo para depuración)
if (currentDomain.includes('vercel.app') || currentDomain.includes('localhost')) {
  console.log('✅ Dominio reconocido por Firebase');
} else {
  console.warn('⚠️ Dominio no estándar, verificar Authorized domains en Firebase Console');
}
// ===== FIN DE LA SOLUCIÓN =====

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// ===== FUNCIÓN MEJORADA PARA LOGIN CON POPUP (con manejo de error de dominio) =====
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    // Si el error es por dominio no autorizado
    if (error.code === 'auth/unauthorized-domain') {
      console.error('❌ Error: Dominio no autorizado en Firebase');
      console.error('Dominio actual:', window.location.origin);
      console.error('Agrega este dominio en: Firebase Console → Authentication → Settings → Authorized domains');
      
      // Fallback: intentar con redirect en lugar de popup
      console.log('🔄 Intentando con signInWithRedirect...');
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

// ===== MANEJAR RESULTADO DE REDIRECT (para cuando se usa signInWithRedirect) =====
export async function handleRedirectResult() {
  try {
    const result = await auth.getRedirectResult();
    if (result) {
      console.log('✅ Login exitoso con redirect:', result.user);
      return result.user;
    }
    return null;
  } catch (error: any) {
    console.error('❌ Error en redirect:', error);
    return null;
  }
}

// Error handler specified verbatim by system instructions
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Hardened Error Event: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
