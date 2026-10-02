import React, { useState } from 'react';
import { UserCheck, Search, Plus, Calendar, Save, Trash2, Clock, X, Check, Edit2, History } from 'lucide-react';
import { HSInspector, HSInspectorLog } from '../types';
import { GlassButton } from '../../ui/GlassUI';

interface InspectorsMasterProps {
  inspectors: HSInspector[];
  appUsers: any[]; // all available users
  onAddOrUpdate: (userIds: string[], validUntil: string | null) => void;
  onRevoke: (userId: string) => void;
  onFetchLogs?: (inspectorId: string) => Promise<HSInspectorLog[]>;
}

export function InspectorsMaster({ inspectors, appUsers, onAddOrUpdate, onRevoke, onFetchLogs }: InspectorsMasterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [validUntil, setValidUntil] = useState<string>('');

  const [showLogsModal, setShowLogsModal] = useState<string | null>(null); // inspectorId
  const [logs, setLogs] = useState<HSInspectorLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [showEditModal, setShowEditModal] = useState<string | null>(null); // inspector userId
  const [editValidUntil, setEditValidUntil] = useState<string>('');

  const handleSave = () => {
    if (selectedUserIds.length === 0) return;
    onAddOrUpdate(selectedUserIds, validUntil || null);
    setShowAddModal(false);
    setSelectedUserIds([]);
    setValidUntil('');
  };

  const handleEditSave = () => {
    if (!showEditModal) return;
    onAddOrUpdate([showEditModal], editValidUntil || null);
    setShowEditModal(null);
    setEditValidUntil('');
  };

  const openLogs = async (inspectorId: string) => {
    setShowLogsModal(inspectorId);
    setLoadingLogs(true);
    if (onFetchLogs) {
      const data = await onFetchLogs(inspectorId);
      setLogs(data);
    }
    setLoadingLogs(false);
  };

  const filteredInspectors = inspectors.filter(insp => 
    insp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    insp.dni.includes(searchTerm)
  );

  const availableUsers = appUsers.filter(u => 
    u.isActive && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.dni.includes(searchTerm)) &&
    !inspectors.some(i => i.userId === u.id && i.isActive)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main"
          />
        </div>
        <GlassButton
          onClick={() => setShowAddModal(true)}
          variant="primary"
          icon={<Plus size={18} />}
        >
          Añadir Inspectores
        </GlassButton>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {filteredInspectors.map(insp => {
          const isValid = insp.isActive && (!insp.validUntil || new Date(insp.validUntil) >= new Date());
          
          return (
            <div key={insp.id} className="p-4 rounded-xl border border-border bg-bg/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-text-main">{insp.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isValid ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/20 text-rose-500 border border-rose-500/20'}`}>
                    {isValid ? 'VIGENTE' : (insp.isActive ? 'VENCIDO' : 'INACTIVO')}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span className="flex items-center gap-1"><UserCheck size={12}/> DNI: {insp.dni}</span>
                  <span className="flex items-center gap-1"><Clock size={12}/> Vencimiento: {insp.validUntil ? new Date(insp.validUntil).toLocaleDateString('es-AR') : 'Sin Vencimiento'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openLogs(insp.id)}
                  className="p-2 text-text-muted hover:text-text-main hover:bg-bg/80 rounded-lg transition-colors border border-transparent hover:border-border"
                  title="Ver Historial"
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(insp.userId);
                    setEditValidUntil(insp.validUntil ? new Date(insp.validUntil).toISOString().split('T')[0] : '');
                  }}
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20"
                  title="Editar Vigencia"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onRevoke(insp.userId)}
                  className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                  title="Revocar habilitación"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredInspectors.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            No se encontraron inspectores.
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="text-lg font-bold text-text-main">Añadir Inspectores</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-text-muted hover:text-text-main rounded-lg hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">
                  Vencimiento de la Habilitación (Opcional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">
                  Seleccionar Usuarios
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar para añadir..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-bg/50 border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main"
                  />
                </div>
                
                <div className="border border-border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto bg-bg/30">
                  {availableUsers.map(user => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                      <div 
                        key={user.id} 
                        onClick={() => setSelectedUserIds(prev => 
                          isSelected ? prev.filter(id => id !== user.id) : [...prev, user.id]
                        )}
                        className={`flex items-center gap-3 p-3 border-b border-border/50 cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-bg/80'}`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary text-white' : 'border-border'}`}>
                          {isSelected && <Check size={14} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-main">{user.name}</p>
                          <p className="text-xs text-text-muted">DNI: {user.dni} | {user.role}</p>
                        </div>
                      </div>
                    );
                  })}
                  {availableUsers.length === 0 && (
                    <div className="p-4 text-center text-sm text-text-muted">
                      No hay usuarios disponibles para seleccionar.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-3 bg-bg/50">
              <GlassButton onClick={() => setShowAddModal(false)} variant="ghost">Cancelar</GlassButton>
              <GlassButton 
                onClick={handleSave} 
                variant="primary" 
                icon={<Save size={18} />}
                disabled={selectedUserIds.length === 0}
              >
                Guardar ({selectedUserIds.length})
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="text-lg font-bold text-text-main">Editar Vigencia</h3>
              <button onClick={() => setShowEditModal(null)} className="p-1 text-text-muted hover:text-text-main rounded-lg hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4">
              <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">
                Nuevo Vencimiento (Opcional)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input
                  type="date"
                  value={editValidUntil}
                  onChange={(e) => setEditValidUntil(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-3 bg-bg/50">
              <GlassButton onClick={() => setShowEditModal(null)} variant="ghost">Cancelar</GlassButton>
              <GlassButton onClick={handleEditSave} variant="primary" icon={<Save size={18} />}>
                Guardar Cambios
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2"><History size={18} /> Historial de Habilitaciones</h3>
              <button onClick={() => setShowLogsModal(null)} className="p-1 text-text-muted hover:text-text-main rounded-lg hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="text-center py-8 text-text-muted text-sm">Cargando historial...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">No hay registros para este inspector.</div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {logs.map((log, index) => {
                    const date = new Date(log.createdAt);
                    
                    let actionText = '';
                    let actionColor = '';
                    switch (log.action) {
                      case 'CREATED':
                        actionText = 'Habilitado';
                        actionColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
                        break;
                      case 'REVOKED':
                        actionText = 'Revocado';
                        actionColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
                        break;
                      case 'UPDATED_VALIDITY':
                        actionText = 'Vigencia Actualizada';
                        actionColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
                        break;
                      default:
                        actionText = log.action;
                        actionColor = 'text-text-muted bg-bg border-border';
                    }

                    return (
                      <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface bg-bg shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                          <History size={14} className="text-text-muted" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-bg/50 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionColor}`}>
                              {actionText}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">{date.toLocaleDateString('es-AR')} {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="text-xs text-text-main space-y-1">
                            {log.action === 'UPDATED_VALIDITY' && (
                              <div className="flex items-center gap-2">
                                <span className="line-through text-text-muted">{log.previousValidUntil ? new Date(log.previousValidUntil).toLocaleDateString('es-AR') : 'Sin fecha'}</span>
                                <span>→</span>
                                <span className="font-bold">{log.newValidUntil ? new Date(log.newValidUntil).toLocaleDateString('es-AR') : 'Sin vencimiento'}</span>
                              </div>
                            )}
                            {log.action === 'CREATED' && (
                              <div className="font-bold">
                                Vencimiento: {log.newValidUntil ? new Date(log.newValidUntil).toLocaleDateString('es-AR') : 'Sin vencimiento'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-end bg-bg/50">
              <GlassButton onClick={() => setShowLogsModal(null)} variant="ghost">Cerrar</GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
