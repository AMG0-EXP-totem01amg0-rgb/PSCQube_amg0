import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { GlassCard, GlassButton } from '../ui/GlassUI';
import { getSupabaseClient } from '../../lib/supabaseClient';

interface WelcomeScreenProps {
  onEnter: () => void;
  onLoginSuccess: (user: any, googleEmail: string) => void;
  addToast: (msg: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export default function WelcomeScreen({ onEnter, onLoginSuccess, addToast }: WelcomeScreenProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authStage, setAuthStage] = useState<null | 'authenticating' | 'verifying_user' | 'authorized' | 'unauthorized' | 'error'>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // General verification of Google Email against authorized users (USUARIOSV2)
  const verifyAndAuthorizeEmail = async (email: string, fullName?: string) => {
    setIsLoggingIn(true);
    setAuthStage('verifying_user');
    setStatusMessage('Consultando base de datos...');
    try {
      // Fetch authorized users list from the backend
      const res = await fetch('/api/sheets?table=USUARIOSV2');
      if (!res.ok) {
        throw new Error("No se pudo obtener la lista de usuarios autorizados desde el servidor.");
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const targetEmail = email.trim().toLowerCase();

        // 1. First search for match in the "email" column
        let matched = data.data.find((u: any) => {
          const emailA = String(u.email || u.mail || "").trim().toLowerCase();
          return emailA && emailA === targetEmail;
        });

        // 2. If not found, search in the "email2" column
        if (!matched) {
          matched = data.data.find((u: any) => {
            const emailB = String(u.email2 || "").trim().toLowerCase();
            return emailB && emailB === targetEmail;
          });
        }

        if (matched) {
          setAuthStage('authorized');
          setStatusMessage('¡Ingreso autorizado con éxito!');
          // Authenticated! Map client properties
          const matchedUserObj = { ...matched };
          if (matchedUserObj.nombre && !matchedUserObj.name) matchedUserObj.name = matchedUserObj.nombre;
          if (matchedUserObj.usuariosap && !matchedUserObj.sapUser) matchedUserObj.sapUser = matchedUserObj.usuariosap;
          if (matchedUserObj.puesto && !matchedUserObj.position) matchedUserObj.position = matchedUserObj.puesto;
          if (matchedUserObj.perfil && !matchedUserObj.profile) matchedUserObj.profile = matchedUserObj.perfil;
          if (matchedUserObj.permisos && !matchedUserObj.permissions) matchedUserObj.permissions = matchedUserObj.permisos;

          addToast(`Sesión iniciada con éxito como ${matchedUserObj.name || email}`, 'success');
          setTimeout(() => {
            onLoginSuccess(matchedUserObj, email);
          }, 600);
        } else {
          setAuthStage('unauthorized');
          setStatusMessage('Usuario no autorizado. Contacte al administrador.');
          // Sign out of Supabase because this email is not registered in USUARIOSV2
          const supabase = await getSupabaseClient();
          if (supabase) {
            await supabase.auth.signOut();
          }
          addToast(`Usuario no autorizado. Contacte al administrador.`, 'error');
        }
      } else {
        throw new Error(data.error || "Formato de respuesta de usuarios no válido.");
      }
    } catch (err: any) {
      console.error("[VerifyAndAuthorizeEmailError]", err);
      setAuthStage('error');
      setStatusMessage(err.message || "Error al verificar autorización de correo.");
      addToast(err.message || "Error al verificar autorización de correo.", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    async function checkAuth() {
      const supabase = await getSupabaseClient();
      if (!supabase) return;

      // Extract and check if we already have an active Supabase login session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isMounted) {
        const email = session.user.email;
        if (email) {
          await verifyAndAuthorizeEmail(email, session.user.user_metadata?.full_name);
        }
      }

      // Handle transition automatically when Redirect returns
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user && isMounted) {
          const email = session.user.email;
          if (email) {
            await verifyAndAuthorizeEmail(email, session.user.user_metadata?.full_name);
          }
        }
      });
      subscription = data.subscription;
    }

    checkAuth();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthStage('authenticating');
    setStatusMessage('Validando usuario');
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client is not available. Check your SUPABASE_URL configuration.');
      }

      // Supabase Native SignIn with Google OAuth redirected flow
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('[GoogleLoginOAuthError]', err);
      setAuthStage('error');
      setStatusMessage(err.message || 'Error de conexión con Google Auth.');
      addToast(err.message || 'Error de conexión con Google Auth de Supabase.', 'error');
      setIsLoggingIn(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-bg text-text-main p-4 transition-all duration-500"
      style={{ 
        background: 'radial-gradient(circle at top, var(--bg-header), var(--bg-main))' 
      }}
    >
      {/* Background Industrial Textures */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <main className="relative z-10 w-full max-w-4xl font-sans">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Section 1: Branding */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none bg-gradient-to-r from-text-main to-text-main/60 bg-clip-text text-transparent">
                PSCQUBE
              </h1>
              <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] opacity-90">
                Operaciones Digitales
              </p>
            </div>

            <p className="text-lg text-text-muted leading-relaxed max-w-md font-medium">
              Plataforma de control operativo y seguimiento productivo de última generación. Optimización y rendimiento en una sola interfaz.
            </p>
          </motion.div>

          {/* Section 2: Access Gateway */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <GlassCard 
              className="p-8 md:p-10 relative overflow-hidden shadow-2xl border border-border bg-surface/90 dark:bg-surface-elevated/95 min-h-[350px] flex flex-col justify-between"
              style={{ 
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="relative z-10 space-y-8 my-auto">
                {/* 1. Loader & Status sequence pane */}
                {(authStage === 'authenticating' || authStage === 'verifying_user' || authStage === 'authorized') ? (
                  <div className="text-center py-8 space-y-6">
                    <div className="relative flex justify-center">
                      <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      {authStage === 'authorized' && (
                        <div className="absolute inset-0 flex items-center justify-center text-primary font-bold text-lg animate-pulse">✓</div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-text-main tracking-tight uppercase">
                        {authStage === 'authenticating' && "Autenticando con Google"}
                        {authStage === 'verifying_user' && "Consultando usuariosv2"}
                        {authStage === 'authorized' && "Acceso Autorizado"}
                      </h3>
                      <p className="text-sm font-semibold text-primary font-mono tracking-wide animate-pulse">
                        {statusMessage}
                      </p>
                    </div>

                    <div className="text-[11px] text-text-muted font-bold tracking-widest uppercase opacity-40">
                      Por favor, espere un momento...
                    </div>
                  </div>
                ) : (authStage === 'unauthorized' || authStage === 'error') ? (
                  /* 2. Error or Blocked Access pane */
                  <div className="space-y-6 py-4">
                    <div className="flex items-center gap-3 text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                      <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <h3 className="font-bold text-base leading-tight">Acceso Denegado</h3>
                        <p className="text-xs font-semibold opacity-90 mt-0.5">El correo no pertenece a un personal autorizado.</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-text-muted font-medium">
                      <p>
                        Tu identidad se verificó exitosamente en Google, pero tu correo electrónico no tiene permisos registrados en la tabla <span className="font-mono text-primary font-bold">usuariosv2</span>.
                      </p>
                      <p className="text-xs bg-surface/50 p-2.5 rounded border border-border italic font-mono text-center">
                        {statusMessage}
                      </p>
                    </div>

                    <div className="pt-2">
                      <GlassButton 
                        onClick={() => {
                          setAuthStage(null);
                          setIsLoggingIn(false);
                          setStatusMessage('');
                        }}
                        className="w-full h-12 text-sm font-bold bg-white/5 border border-border hover:bg-white/10 text-text-main"
                      >
                        Intentar con otra cuenta
                      </GlassButton>
                    </div>
                  </div>
                ) : (
                  /* 3. Normal Access State pane */
                  <>
                    <div>
                      <h2 className="text-xl font-bold text-text-main mb-1">Bienvenido al Sistema</h2>
                      <p className="text-sm text-text-muted font-medium italic">Inicia sesión de forma segura para acceder.</p>
                    </div>

                    <div className="space-y-4" id="access-actions">
                      <GlassButton 
                        onClick={onEnter} 
                        disabled={isLoggingIn}
                        className="w-full h-14 text-base font-bold group bg-primary hover:bg-primary-hover border-none text-white shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        Ingresar Directo
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                      </GlassButton>

                      <div className="relative py-4 flex items-center gap-4">
                        <div className="h-[1px] flex-1 bg-border/80" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">o bien</span>
                        <div className="h-[1px] flex-1 bg-border/80" />
                      </div>

                      <GlassButton 
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn}
                        variant="secondary"
                        className="w-full h-14 text-base group border border-border hover:border-primary/50 transition-all flex items-center justify-center gap-3 bg-[#111827]/30 hover:bg-[#111827]/70 font-semibold text-text-main shadow-md active:scale-[0.98] disabled:opacity-50"
                      >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#ea4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.52 5.52 0 0 1 8.4 13a5.52 5.52 0 0 1 5.59-5.514c2.25 0 4.172 1.258 5.176 3.1l3.57-2.77C20.67 4.19 16.7 2 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.3 0 9.81-3.81 10-9H12.24z" />
                        </svg>
                        Ingresar con Google
                      </GlassButton>
                      <p className="text-[11px] text-center text-text-muted font-semibold tracking-wide">
                        Requiere que su email esté registrado <span className="font-mono text-primary font-bold">usuariosv2</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </main>

      <footer className="absolute bottom-6 left-0 right-0 text-center opacity-10 pointer-events-none">
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-text-muted">
          PSCQUBE &copy; 2026
        </p>
      </footer>
    </div>
  );
}
