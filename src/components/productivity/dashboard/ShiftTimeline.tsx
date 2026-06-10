import React, { useMemo } from 'react';
import { format, parse, differenceInMinutes, addMinutes } from 'date-fns';
import { MachineStop, Shift, MasterData } from '../../../types';
import { cn } from '../../../lib/utils';

interface Props {
  shift: Shift;
  stops: MachineStop[];
  masters: MasterData;
  onEdit?: (stop: MachineStop) => void;
  readOnly?: boolean;
}

export default function ShiftTimeline({ shift, stops, masters, onEdit, readOnly = false }: Props) {
  const getMinutesFromStart = (timeStr: string, shiftStart: string) => {
    try {
      const time = parse(timeStr, 'HH:mm', new Date());
      const start = parse(shiftStart, 'HH:mm', new Date());
      let diff = differenceInMinutes(time, start);
      if (diff < 0) diff += 1440; // Midnight wrap
      return diff;
    } catch (e) {
      return 0;
    }
  };

  const totalMinutes = shift.durationHours * 60;

  const segments = useMemo(() => {
    const list: any[] = [];
    // Sort stops chromatically by their start time relative to shift start
    const sortedStops = [...stops].sort((a, b) => 
      getMinutesFromStart(a.startTime, shift.startTime) - getMinutesFromStart(b.startTime, shift.startTime)
    );

    let currentPointer = 0; // minutes from shift start

    sortedStops.forEach((stop, index) => {
      const stopStart = getMinutesFromStart(stop.startTime, shift.startTime);
      const stopDuration = stop.durationMinutes;
      const stopEnd = stopStart + stopDuration;

      // 1. GAP - OPERATIVE
      if (stopStart > currentPointer) {
        list.push({
          type: 'OPERATIVE',
          duration: stopStart - currentPointer,
          startTime: format(addMinutes(parse(shift.startTime, 'HH:mm', new Date()), currentPointer), 'HH:mm'),
          endTime: stop.startTime
        });
      }

      // 2. STOP SEGMENT
      const cause = masters.causes.find(c => c.id === stop.causeId);
      const stopTypeResolved = String(stop.stopType || cause?.stopType || 'INTERNO').toUpperCase();
      
      const hacObj = (masters.hacs || []).find(h => {
        if (!h) return false;
        const hId = h.id ? String(h.id).trim().toUpperCase() : '';
        const hHac = h.hac ? String(h.hac).trim().toUpperCase() : '';
        const stopHacId = stop.hacId ? String(stop.hacId).trim().toUpperCase() : '';
        const stopHacName = stop.hacName ? String(stop.hacName).trim().toUpperCase() : '';
        return (hId && stopHacId && hId === stopHacId) || 
               (hHac && stopHacId && hHac === stopHacId) || 
               (hHac && stopHacName && hHac === stopHacName);
      });
      const hacText = hacObj 
        ? `${hacObj.hac} - ${hacObj.detail}` 
        : (stop.hacDetail ? `${stop.hacName || ''} - ${stop.hacDetail}` : (stop.hacName || 'S/D'));

      list.push({
        type: stopTypeResolved === 'EXTERNO' ? 'EXTERNAL' : 'INTERNAL',
        duration: stopDuration,
        startTime: stop.startTime,
        endTime: stop.endTime,
        cause: cause?.text || stop.causeText || 'Sin Causa',
        hac: hacText,
        stop: stop
      });

      currentPointer = Math.max(currentPointer, stopEnd);
    });

    // 3. FINAL OPERATIVE SEGMENT
    if (currentPointer < totalMinutes) {
      list.push({
        type: 'OPERATIVE',
        duration: totalMinutes - currentPointer,
        startTime: format(addMinutes(parse(shift.startTime, 'HH:mm', new Date()), currentPointer), 'HH:mm'),
        endTime: shift.endTime
      });
    }

    return list;
  }, [shift, stops, masters]);

  const labels = useMemo(() => {
    const lbls = [];
    // Every 1 hour label
    for (let i = 0; i <= shift.durationHours; i++) {
       const shiftStartDate = parse(shift.startTime, 'HH:mm', new Date());
       const labelTime = format(addMinutes(shiftStartDate, i * 60), 'HH:mm');
       lbls.push({ 
         time: labelTime, 
         left: (i * 60 / totalMinutes) * 100 
       });
    }
    return lbls;
  }, [shift, totalMinutes]);

  return (
    <div className="w-full space-y-4">
      {/* Segmented Bar */}
      <div className="relative h-12 w-full rounded-lg border border-border flex bg-bg">
        {segments.map((seg, idx) => {
          const width = (seg.duration / totalMinutes) * 100;
          
          let bgColorClass = "bg-success"; // OPERATIVE
          if (seg.type === 'INTERNAL') bgColorClass = "bg-danger"; // INTERNAL
          if (seg.type === 'EXTERNAL') bgColorClass = "bg-zinc-500"; // EXTERNAL

          const isOperative = seg.type === 'OPERATIVE';
          
          const isStop = seg.type === 'INTERNAL' || seg.type === 'EXTERNAL';
          const prevSeg = idx > 0 ? segments[idx - 1] : null;
          const hasPrevStop = prevSeg && (prevSeg.type === 'INTERNAL' || prevSeg.type === 'EXTERNAL');
          const showDivider = isStop && hasPrevStop;

          return (
            <div 
              key={idx}
              className={cn(
                "h-full relative group transition-all duration-200",
                bgColorClass,
                showDivider && "border-l border-white/40",
                !readOnly && !isOperative && "cursor-pointer hover:filter hover:brightness-110",
                readOnly && "cursor-default",
                idx === 0 && "rounded-l-[7px]",
                idx === segments.length - 1 && "rounded-r-[7px]"
              )}
              style={{ width: `${width}%` }}
              onClick={() => !readOnly && seg.stop && onEdit?.(seg.stop)}
            >
              {/* Tooltip on Hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-surface/95 border border-border p-3.5 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50 shadow-2xl translate-y-2 group-hover:translate-y-0 text-left backdrop-blur-md">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">
                    ⏱️ {seg.startTime} - {seg.endTime}
                  </span>
                  <span className="text-[9.5px] font-black text-primary uppercase tracking-widest">
                    ⚡ {seg.duration} MIN
                  </span>
                </div>
                
                {isOperative ? (
                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Sistema Operativo
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">HAC IMPLICADO</div>
                      <div className="text-[11px] font-bold text-text-main leading-snug uppercase">
                        {seg.hac}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">CAUSA DEL PARO</div>
                      <div className="text-[11px] font-bold text-text-main leading-snug uppercase">
                        {seg.cause}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black tracking-widest border uppercase",
                        seg.type === 'INTERNAL' 
                          ? "bg-red-500/10 border-red-500/20 text-red-400" 
                          : "bg-zinc-500/10 text-text-main border-zinc-500/20"
                      )}>
                        {seg.type === 'INTERNAL' ? 'PARO INTERNO' : 'PARO EXTERNO'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface/95 border-r border-b border-border rotate-45" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Scale labels */}
      <div className="relative h-6">
        {labels.map((lbl, idx) => (
          <div 
            key={idx}
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${lbl.left}%` }}
          >
            <div className="w-px h-1.5 bg-border mb-1" />
            <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter whitespace-nowrap">
              {lbl.time}
            </span>
          </div>
        ))}
        
        {/* Continuous baseline for labels */}
        <div className="absolute top-0 left-0 right-0 h-px bg-border -z-10" />
      </div>
    </div>
  );
}
