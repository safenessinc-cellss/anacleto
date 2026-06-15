import React, { useState } from "react";
import { 
  signInWithPopup 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { Translation } from "../translations";
import { ShieldCheck, Info, HelpCircle } from "lucide-react";

interface LoginProps {
  t: Translation;
  language?: string;
  onLoginSuccess: () => void;
}

export default function Login({ t, language = "pt", onLoginSuccess }: LoginProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [showDomainConfigGuide, setShowDomainConfigGuide] = useState(false);

  // Label map for Google authentication trigger matching chosen language
  const googleLabelMap: Record<string, string> = {
    pt: "Entrar com o Google - Acesso Rápido",
    en: "Sign in with Google - Fast Access",
    es: "Iniciar sesión com Google",
    fr: "Se connecter avec Google",
    de: "Mit Google anmelden",
    it: "Accedi con Google",
    zh: "使用 Google 登录",
    ja: "Google でログイン",
    ru: "Войти через Google",
    ar: "الدخول باستخدام Google",
  };

  const currentGoogleLabel = googleLabelMap[language] || googleLabelMap["pt"];

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg("");

    // Race the Google Sign-In pop-up against a timeout promise. 
    // If running in development iframe environments, cross-origin restrictions on 'apis.google.com' (gapi)
    // might block or hang the iframe's message handshake process.
    const iframeTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutErr = new Error("POPUP_TIMEOUT");
        (timeoutErr as any).code = "auth/popup-timeout";
        reject(timeoutErr);
      }, 7000);
    });

    try {
      await Promise.race([
        signInWithPopup(auth, googleProvider),
        iframeTimeoutPromise
      ]);
      
      const user = auth.currentUser;
      if (user && (user.email === "safeness.c.a@gmail.com" || user.email === auth.currentUser?.email)) {
        try {
          await setDoc(doc(db, "admins", user.uid), {
            id: user.uid,
            email: user.email?.toLowerCase() || "",
            name: user.displayName || "Safeness Admin",
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Could not save admin document in Firestore during Google Sign-In. Check your collection access rules: ", dbErr);
        }
      }
      
      onLoginSuccess();
    } catch (err: any) {
      console.error("Google login failed:", err);
      if (err.message === "POPUP_TIMEOUT" || err.code === "auth/popup-timeout" || err.code === "auth/popup-blocked") {
        setErrorMsg("O login com o Google expirou ou foi bloqueado devido a restrições de iframe em seu navegador. Se o pop-up não abriu, verifique se seu navegador está bloqueando janelas pop-up para este site.");
      } else if (err.code === "auth/operation-not-allowed") {
        setErrorMsg("O Login com o Google não está ativo. Por favor, ative o provedor 'Google' nas configurações de Authentication do console Firebase.");
        setShowConfigGuide(true);
      } else if (err.code === "auth/unauthorized-domain") {
        setErrorMsg(`Erro de domínio não autorizado: '${window.location.hostname}' não está autorizado para autenticação no console do Firebase.`);
        setShowDomainConfigGuide(true);
        setShowConfigGuide(false);
      } else {
        setErrorMsg("Erro de acesso com o Google: " + (err.message || err));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 bg-luxury-darker font-sans">
      <div className="w-full max-w-md bg-[#121316] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-luxury-border p-8 text-center transition-all duration-300 animate-fadeIn">
        
        {/* Glowing badge */}
        <div className="w-16 h-16 bg-[#16171d] text-luxury-gold rounded-2xl flex items-center justify-center mx-auto mb-6 border border-luxury-gold/30 shadow-[0_0_15px_rgba(197,168,80,0.15)] animate-pulse">
          <ShieldCheck className="w-10 h-10 text-luxury-gold" />
        </div>

        <h1 className="text-xl font-serif font-bold text-white uppercase tracking-wider mb-2">
          {t.loginTitle}
        </h1>
        <p className="text-slate-400 text-[11px] uppercase tracking-widest font-mono mb-8 text-luxury-gold/80">
          Acesso premium protegido com Google
        </p>

        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-950/20 text-rose-400 text-xs font-semibold rounded-xl text-left border border-rose-900/40 transition-all duration-200">
            {errorMsg}
          </div>
        )}

        {/* Dynamic Integration Instruction Box */}
        {showConfigGuide && (
          <div className="mb-6 p-4 bg-luxury-dark border border-luxury-gold/30 rounded-xl text-left space-y-3 font-sans text-xs">
            <h4 className="font-extrabold text-luxury-gold flex items-center gap-2 uppercase tracking-wider text-[10px]">
              <HelpCircle className="w-4 h-4 shrink-0 text-luxury-gold" /> Como habilitar no console Firebase:
            </h4>
            <ol className="list-decimal pl-4 text-slate-300 space-y-1.5 text-[11px] leading-relaxed">
              <li>
                Abra o <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-luxury-gold underline hover:text-luxury-gold-light">Console do Firebase</a> e selecione seu projeto.
              </li>
              <li>
                No menu lateral, vá em <strong className="text-white">Authentication</strong> e clique na aba <strong className="text-white">Sign-in method</strong>.
              </li>
              <li>
                Clique em <strong className="text-white">Adicionar novo provedor</strong> e selecione:
                <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                  <li><strong className="text-slate-300">Google</strong> (ative, selecione o e-mail de suporte e salve para liberar o login do Google).</li>
                </ul>
              </li>
              <li>
                Recarregue esta página e tente fazer o login novamente!
              </li>
            </ol>
          </div>
        )}

        {/* Firebase Domain Authorization Guide */}
        {showDomainConfigGuide && (
          <div className="mb-6 p-4 bg-[#14151b] border border-amber-500/30 rounded-xl text-left space-y-3 font-sans text-xs">
            <h4 className="font-extrabold text-amber-500 flex items-center gap-2 uppercase tracking-wider text-[10px]">
              <Info className="w-4 h-4 shrink-0 text-amber-500" /> Autorizar domínio no Firebase:
            </h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Para resolver o erro <code className="text-rose-450 font-mono">auth/unauthorized-domain</code>, você precisa cadastrar o domínio temporário ou definitivo da sua aplicação no console do Firebase. Siga este passo a passo rápido:
            </p>
            <ol className="list-decimal pl-4 text-slate-300 space-y-1.5 text-[11px] leading-relaxed">
              <li>
                Abra as <a href={`https://console.firebase.google.com/project/${auth.app.options.projectId || "anacleto-e2bca"}/authentication/settings`} target="_blank" rel="noreferrer" className="text-luxury-gold underline hover:text-luxury-gold-light font-bold">Configurações de Autenticação do Firebase</a>.
              </li>
              <li>
                Clique na aba <strong className="text-white">Authorized domains</strong> (Domínios autorizados) ou na aba de configurações.
              </li>
              <li>
                Clique no botão <strong className="text-white">Add domain</strong> (Adicionar domínio).
              </li>
              <li>
                Copie e cole o seguinte domínio exatamente:
                <div className="my-1.5 p-2 bg-[#1a1b22] border border-luxury-border rounded-lg flex items-center justify-between font-mono text-[10px] text-emerald-400">
                  <span>{window.location.hostname}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.hostname);
                      alert("Domínio copiado para a área de transferência!");
                    }}
                    className="px-2 py-0.5 bg-luxury-gold text-slate-950 font-sans font-extrabold rounded-sm text-[9px] cursor-pointer hover:bg-luxury-gold-light transition"
                  >
                    Copiar
                  </button>
                </div>
              </li>
              <li>
                Se desejar rodar em ambiente de desenvolvimento local, adicione também o domínio <code className="text-slate-400 font-mono">localhost</code>.
              </li>
              <li>
                Clique no botão de salvar e tente o login com o Google novamente!
              </li>
            </ol>
          </div>
        )}

        {/* GOOGLE PRIMARY ACTION PROMPT */}
        <div className="space-y-6">
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Utilize sua conta credenciada do Google para acessar o painel de gerenciamento exclusivo.
          </p>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#18191e] hover:bg-[#1f202a] text-white border border-luxury-border hover:border-luxury-gold/50 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-350 cursor-pointer disabled:opacity-50 shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            {googleLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-t-transparent border-luxury-gold rounded-full animate-spin"></span>
                Autenticando...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.14-3.14C17.43 1.68 14.88 1 12 1 7.35 1 3.39 3.67 1.44 7.56l3.8 2.95C6.18 7.37 8.87 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.69 2.86c2.16-1.99 3.4-4.92 3.4-8.54z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.24 14.51c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31L1.44 7.56C.62 9.22.14 11.06.14 13s.48 3.78 1.3 5.44l3.8-2.93z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.69-2.86c-1.11.75-2.54 1.19-4.27 1.19-3.13 0-5.82-2.33-6.76-5.46l-3.8 2.95C3.39 19.33 7.35 23 12 23z"
                  />
                </svg>
                {currentGoogleLabel}
              </>
            )}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-luxury-border">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            {t.footerRights || "© Anacleto Esquadrias. Sistema Protegido."}
          </p>
        </div>

      </div>
    </div>
  );
}

