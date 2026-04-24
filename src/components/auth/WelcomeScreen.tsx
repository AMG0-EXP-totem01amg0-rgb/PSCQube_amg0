import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { GlassCard, GlassButton } from '../ui/GlassUI';

interface WelcomeScreenProps {
  onEnter: () => void;
}

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-bg text-text-main p-4 transition-all duration-500"
      style={{ 
        background: 'radial-gradient(circle at top, var(--bg-header), var(--bg-main))' 
      }}
    >
      {/* Background Industrial Textures */}
      <div className="industrial-grid-layer opacity-10 dark:opacity-30" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <main className="relative z-10 w-full max-w-4xl">
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
              className="p-8 md:p-10 relative overflow-hidden shadow-2xl border-border bg-surface/90 dark:bg-surface-elevated/95"
              style={{ 
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="relative z-10 space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-text-main mb-1">Bienvenido al Sistema</h2>
                  <p className="text-sm text-text-muted font-medium italic">Inicia sesión para acceder al panel de control.</p>
                </div>

                <div className="space-y-4" id="access-actions">
                  <GlassButton 
                    onClick={onEnter} 
                    className="w-full h-14 text-base font-bold group bg-primary hover:bg-primary-hover border-none text-white shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]"
                  >
                    Ingresar
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </GlassButton>

                  {/* Future Placeholder for Clerk Auth */}
                  <div className="relative py-4 flex items-center gap-4">
                    <div className="h-[1px] flex-1 bg-border" />
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">o bien</span>
                    <div className="h-[1px] flex-1 bg-border" />
                  </div>

                  <GlassButton 
                    variant="secondary"
                    className="w-full h-14 text-base opacity-30 cursor-not-allowed group border-border"
                    disabled
                  >
                    <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continuar con Google
                  </GlassButton>
                  <p className="text-[10px] text-center text-text-muted font-bold uppercase tracking-wider opacity-20">
                    Soporte para Google Auth próximamente
                  </p>
                </div>
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
