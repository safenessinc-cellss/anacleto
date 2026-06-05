import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { Translation } from "../translations";
import { ShieldCheck, Mail, Lock, ArrowRight, UserPlus, Eye, EyeOff, Info, HelpCircle } from "lucide-react";

interface LoginProps {
  t: Translation;
  language?: string;
  onLoginSuccess: () => void;
}

export default function Login({ t, language = "pt", onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [showDomainConfigGuide, setShowDomainConfigGuide] = useState(false);

  // Label map for Google authentication trigger matching chosen language
  const googleLabelMap: Record<string, string> = {
    pt: "Entrar com o Google - Acesso Rápido",
    en: "Sign in with Google - Fast Access",
    es: "Iniciar sesión con Google",
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
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const user = credential.user;
      
      // Auto-validate admin settings if email matches key user, save meta and proceed
      if (user.email === "safeness.c.a@gmail.com" || user.email === auth.currentUser?.email) {
        try {
          await setDoc(doc(db, "admins", user.uid), {
            id: user.uid,
            email: user.email?.toLowerCase() || "",
            name: user.displayName || "Safeness Admin",
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Could not save admin document in Firestore. Check rules/schema: ", dbErr);
        }
      }
      
      onLoginSuccess();
    } catch (err: any) {
      console.error("Google login failed:", err);
      if (err.code === "auth/operation-not-allowed") {
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

  const handleDemoAccess = async () => {
    setDemoLoading(true);
    setErrorMsg("");
    const demoEmail = "safeness.c.a@gmail.com";
    const demoPassword = "password123";
    try {
      // First try to sign in
      await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      onLoginSuccess();
    } catch (err: any) {
      console.log("Demo user sign in failed, matching code: ", err.code);
      
      // If the provider itself is disabled in console
      if (err.code === "auth/operation-not-allowed") {
        setErrorMsg("O login tradicional por e-mail/senha não está ativo no Firebase. Ative o provedor 'E-mail/Senha' no console Firebase ou utilize o botão Google acima.");
        setShowConfigGuide(true);
        setDemoLoading(false);
        return;
      }

      // If user doesn't exist under auth, register them
      if (
        err.code === "auth/user-not-found" || 
        err.code === "auth/invalid-credential" || 
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-email"
      ) {
        try {
          const credential = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          // Write admin authorization token to Firestore db
          await setDoc(doc(db, "admins", credential.user.uid), {
            id: credential.user.uid,
            email: demoEmail,
            name: "Anacleto Admin",
            createdAt: new Date().toISOString()
          });
          onLoginSuccess();
        } catch (regErr: any) {
          console.error("Failed to register demo user: ", regErr);
          if (regErr.code === "auth/operation-not-allowed") {
            setErrorMsg("O login tradicional por e-mail/senha não está ativo no Firebase. Ative o provedor 'E-mail/Senha' no console Firebase ou utilize o botão Google acima.");
            setShowConfigGuide(true);
          } else {
            // If already exists or other error, try final signing in again
            try {
              await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
              onLoginSuccess();
            } catch (doubleErr) {
              setErrorMsg("Não foi possível estabelecer sessão automática: " + (regErr.message || regErr));
            }
          }
        }
      } else {
        console.error("Failed to login demo user: ", err);
        setErrorMsg("Erro de acesso automático: " + (err.message || err));
      }
    } finally {
      setDemoLoading(false);
    }
  };

  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (isRegisterMode) {
        // Sign up with Firebase auth
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Write admin authorization token to Firestore db
        await setDoc(doc(db, "admins", credential.user.uid), {
          id: credential.user.uid,
          email: email.toLowerCase(),
          name: fullName || "Manager",
          createdAt: new Date().toISOString()
        });

        alert("Sucesso! Administrador criado e autorizado nas regras do Firestore.");
        setIsRegisterMode(false);
      } else {
        // Regular sign in
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/operation-not-allowed") {
        setErrorMsg("O provedor de e-mail e senha está inativo no seu console Firebase. Vá em Firebase Console -> Authentication -> Sign-in Method e ative 'E-mail/Senha'.");
        setShowConfigGuide(true);
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrorMsg(t.toastLoginError);
      } else {
        setErrorMsg(err.message || "Ocorreu um erro ao processar a autenticação.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 bg-luxury-darker font-sans">
      <div className="w-full max-w-md bg-[#121316] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-luxury-border p-8 text-center transition-all duration-300">
        
        {/* Glowing badge */}
        <div className="w-16 h-16 bg-[#16171d] text-luxury-gold rounded-2xl flex items-center justify-center mx-auto mb-6 border border-luxury-gold/30 shadow-[0_0_15px_rgba(197,168,80,0.15)]">
          <ShieldCheck className="w-10 h-10 text-luxury-gold" />
        </div>

        <h1 className="text-xl font-serif font-bold text-white uppercase tracking-wider mb-2">
          {isRegisterMode ? "Registro de Administrador" : t.loginTitle}
        </h1>
        <p className="text-slate-400 text-[11px] uppercase tracking-widest font-mono mb-8 text-luxury-gold/80">
          {isRegisterMode ? "Cadastre uma credencial de gerenciamento" : "Acesso premium protegido por criptografia"}
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
                  <li><strong className="text-slate-300">E-mail/Senha</strong> (ative e salve para liberar o formulário e o botão de acesso rápido).</li>
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
        {!isRegisterMode && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading || demoLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#18191e] hover:bg-[#1f202a] text-white border border-luxury-border hover:border-luxury-gold/50 rounded-xl text-xs font-bold transition duration-200 cursor-pointer disabled:opacity-50 shadow-md"
            >
              {googleLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-t-transparent border-luxury-gold rounded-full animate-spin"></span>
                  Conectando conta Google...
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24">
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

            <div className="flex items-center my-5">
              <div className="flex-grow border-t border-luxury-border"></div>
              <span className="px-3 text-slate-500 text-[10px] font-bold uppercase tracking-widest font-mono">OU ENTRAR COM SENHA</span>
              <div className="flex-grow border-t border-luxury-border"></div>
            </div>
          </div>
        )}

        <form onSubmit={handleAuthentication} className="space-y-4">
          {isRegisterMode && (
            <div className="text-left">
              <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                {t.userNameLabel}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs text-white border border-luxury-border bg-luxury-darker rounded-xl focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/40 transition outline-hidden"
                  placeholder="Nome do Administrador"
                />
              </div>
            </div>
          )}

          <div className="text-left">
            <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
              {t.emailPlaceholder}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-luxury-gold/60" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 text-xs text-white border border-luxury-border bg-luxury-darker rounded-xl focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/40 transition outline-hidden"
                placeholder="exemplo@anacleto.gt.tc"
              />
            </div>
          </div>

          <div className="text-left">
            <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
              {t.passwordPlaceholder}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-luxury-gold/60" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-xs text-white border border-luxury-border bg-luxury-darker rounded-xl focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/40 transition outline-hidden"
                placeholder="******"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading || demoLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-luxury-gold hover:bg-luxury-gold-dark text-luxury-darker rounded-xl text-xs font-black uppercase tracking-widest transition duration-200 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {loading ? (
              "Processando..."
            ) : (
              <>
                {isRegisterMode ? "Registrar Administrador" : t.loginButton}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {!isRegisterMode && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center my-3">
              <div className="flex-grow border-t border-luxury-border"></div>
              <span className="px-3 text-slate-500 text-[10px] font-bold uppercase tracking-widest font-mono">OU ACESSO DE DEMONSTRAÇÃO</span>
              <div className="flex-grow border-t border-luxury-border"></div>
            </div>

            <button
              type="button"
              onClick={handleDemoAccess}
              disabled={loading || googleLoading || demoLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-transparent border border-luxury-gold/30 hover:border-luxury-gold text-luxury-gold hover:bg-luxury-gold/5 rounded-xl text-xs font-extrabold uppercase tracking-wide transition duration-200 cursor-pointer disabled:opacity-50"
            >
              {demoLoading ? (
                "Carregando sessão..."
              ) : (
                <>
                  <span>⚡</span>
                  Acesso Direto (Usuário Demo)
                </>
              )}
            </button>
          </div>
        )}

        {/* Toggle Mode */}
        <div className="mt-8 pt-6 border-t border-luxury-border flex justify-between items-center text-[11px]">
          <button
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setErrorMsg("");
              setShowConfigGuide(false);
            }}
            className="text-luxury-gold hover:text-luxury-gold-light font-bold tracking-wide uppercase cursor-pointer flex items-center gap-1.5 mx-auto transition"
          >
            {isRegisterMode ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                Deseja fazer login? Entrar
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Cadastrar Novo Administrador
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
