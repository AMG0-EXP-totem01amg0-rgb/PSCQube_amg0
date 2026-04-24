import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Leaf, Users, Package } from 'lucide-react';
import { GlassCard } from './ui/GlassUI';

interface Props {
  title: string;
  type: 'SAFETY' | 'ENVIRONMENT' | 'HR' | 'PRODUCTIVITY';
}

export default function PlaceholderView({ title, type }: Props) {
  const configs = {
    SAFETY: { icon: <ShieldCheck size={48} className="text-orange-400" />, desc: 'Módulos de Higiene y Seguridad Industrial a definir.' },
    ENVIRONMENT: { icon: <Leaf size={48} className="text-emerald-400" />, desc: 'Control de impacto ambiental y gestión de residuos.' },
    HR: { icon: <Users size={48} className="text-violet-400" />, desc: 'Gestión de capital humano, turnos y capacitaciones.' },
    PRODUCTIVITY: { icon: <Package size={48} className="text-blue-400" />, desc: 'Módulo de registro operativo en desarrollo.' },
  };

  const { icon, desc } = configs[type];

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto py-12">
      <GlassCard className="flex flex-col items-center justify-center py-24 text-center gap-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-b from-text-main/[0.02] to-transparent pointer-events-none" />
        <div className="w-28 h-28 bg-bg rounded-3xl flex items-center justify-center shadow-lg border border-border group-hover:scale-110 transition-transform duration-500">
          {icon}
        </div>
        <div className="z-10">
          <h3 className="text-4xl font-black text-text-main tracking-tighter uppercase mb-4">{title}</h3>
          <p className="text-text-muted font-medium max-w-sm mx-auto leading-relaxed">{desc}</p>
        </div>
        <div className="mt-4 px-8 py-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-lg">
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Próximamente</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
