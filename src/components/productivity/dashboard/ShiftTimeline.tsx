import React, { useMemo } from 'react';
import { format, parse, differenceInMinutes, addMinutes } from 'date-fns';
import { MachineStop, Shift, MasterData } from '../../../types';
import { cn, ensureHhMm } from '../../../lib/utils';

interface Props {
  shift?: any;
  stops: any[];
  masters?: any;
  onEdit?: (stop: any) => void;
  readOnly?: boolean;
}

export default function ShiftTimeline({ shift, stops, masters, onEdit, readOnly = false }: Props) {
  const getMinutesFromStart = (timeStr: string, shiftStart: string) => {
    try {
      const time = parse(ensureHhMm(timeStr), 'HH:mm', new Date());
      const start = parse(ensureHhMm(shiftStart), 'HH:mm', new Date());
      let diff = differenceInMinutes(time, start);
      if (diff < 0) diff += 1440; // Midnight wrap
      return diff;
    } catch (e) {
      return 0;
    }
  };

  const validShiftStart = ensureHhMm(
    shift?.startTime || 
    shift?.hora_inicio || 
    shift?.horaInicio || 
    shift?.start_time || 
    '06:00'
  );

  const validShiftEnd = ensureHhMm(
    shift?.endTime || 
    shift?.hora_fin || 
    shift?.horaFin || 
    shift?.end_time || 
    '14:00'
  );

  const getShiftDurationMinutes = (sStart: string, sEnd: string) => {
    try {
      const start = parse(sStart, 'HH:mm', new Date());
      const end = parse(sEnd, 'HH:mm', new Date());
      let diff = differenceInMinutes(end, start);
      if (diff <= 0) diff += 1440; // Overnight shift
      return diff || 480;
    } catch (e) {
      return 480;
    }
  };

  const totalMinutes = Math.max(
    1,
    shift?.durationHours 
      ? shift.durationHours * 60 
      : shift?.duracion_horas
      ? shift.duracion_horas * 60
      : getShiftDurationMinutes(validShiftStart, validShiftEnd)
  );

  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const [tooltipDirections, setTooltipDirections] = React.useState<Record<number, 'up' | 'down'>>({});

  const handleMouseEnter = (idx: number, e: React.MouseEvent<HTMLDivElement>) => {
    setHoveredIdx(idx);
    const rect = e.currentTarget.getBoundingClientRect();
    const dir = rect.top < 260 ? 'down' : 'up';
    setTooltipDirections(prev => ({ ...prev, [idx]: dir }));
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  const getStopTimes = (stop: any) => {
    const rawStart = stop.startTime || stop.horaInicio || stop.hora_inicio || stop.hora_inicio_paro || stop.inicio || stop['inicio'] || '';
    const rawEnd = stop.endTime || stop.horaFin || stop.hora_fin || stop.hora_fin_paro || stop.fin || stop['fin'] || '';
    
    const extractTime = (val: any) => {
      if (!val) return '';
      return ensureHhMm(val);
    };

    const startTime = extractTime(rawStart);
    const endTime = extractTime(rawEnd);

    let durationMinutes = Number(
      stop.durationMinutes || 
      stop.duracionMinutos || 
      stop.duracion_minutos || 
      stop.duracion_minutos_paro || 
      stop.durationTime ||
      stop['duración'] ||
      stop.duracion ||
      0
    );

    return { startTime, endTime, durationMinutes };
  };

  const segments = useMemo(() => {
    const list: any[] = [];

    // Filter valid stops that have a start time
    const validStops = (stops || []).filter((s) => {
      if (!s) return false;
      const { startTime } = getStopTimes(s);
      return Boolean(startTime);
    });

    // Sort stops chromatically by their start time relative to shift start
    const sortedStops = [...validStops].sort((a, b) => {
      const timesA = getStopTimes(a);
      const timesB = getStopTimes(b);
      return getMinutesFromStart(timesA.startTime, validShiftStart) - getMinutesFromStart(timesB.startTime, validShiftStart);
    });

    let currentPointer = 0; // minutes from shift start

    sortedStops.forEach((stop) => {
      const { startTime, endTime, durationMinutes } = getStopTimes(stop);
      const stopStart = getMinutesFromStart(startTime, validShiftStart);
      let stopDuration = durationMinutes;

      if (stopDuration <= 0 && startTime && endTime) {
        const sM = getMinutesFromStart(startTime, validShiftStart);
        const eM = getMinutesFromStart(endTime, validShiftStart);
        let diff = eM - sM;
        if (diff < 0) diff += 1440;
        stopDuration = diff;
      }

      if (stopDuration <= 0) {
        stopDuration = 15; // default fallback 15m
      }

      const stopEnd = stopStart + stopDuration;

      // 1. GAP - OPERATIVE
      if (stopStart > currentPointer) {
        const gapDuration = stopStart - currentPointer;
        const shiftStartObj = parse(validShiftStart, 'HH:mm', new Date());
        list.push({
          type: 'OPERATIVE',
          duration: gapDuration,
          startTime: format(addMinutes(shiftStartObj, currentPointer), 'HH:mm'),
          endTime: format(addMinutes(shiftStartObj, stopStart), 'HH:mm')
        });
      }

      // 2. STOP SEGMENT
      const causeId = stop.causeId || stop.id_causa || stop.causa_id;
      const causeText = stop.causeText || stop.motivo || stop.causa_paro || stop.observaciones || stop.descripcion || 'Sin Causa';

      const causeObj = masters?.causes?.find((c: any) => 
        (causeId && String(c.id).toLowerCase() === String(causeId).toLowerCase()) || 
        c.text === causeText ||
        c.nombre === causeText ||
        c.descripcion === causeText
      );

      const rawStopType = String(
        stop.stopType || 
        stop.tipoParo || 
        stop.tipo_paro || 
        stop.tipo_de_paro || 
        causeObj?.stopType || 
        (causeObj as any)?.tipo_paro || 
        'INTERNO'
      ).toUpperCase();

      let hacText = 'S/D';
      if (stop.hacName && stop.hacDetail) {
        hacText = `${stop.hacName} - ${stop.hacDetail}`;
      } else if (stop.hacName || stop.hac || stop.equipo || stop.nombre_equipo || stop.linea) {
        hacText = stop.hacName || stop.hac || stop.equipo || stop.nombre_equipo || stop.linea || 'S/D';
      } else if (stop.hacDetail) {
        hacText = stop.hacDetail;
      }

      const calculatedEndTime = endTime || format(addMinutes(parse(validShiftStart, 'HH:mm', new Date()), stopEnd), 'HH:mm');

      list.push({
        type: rawStopType.includes('EXTERN') ? 'EXTERNAL' : 'INTERNAL',
        duration: stopDuration,
        startTime: ensureHhMm(startTime),
        endTime: ensureHhMm(calculatedEndTime),
        cause: causeText,
        hac: hacText,
        stop: stop
      });

      currentPointer = Math.max(currentPointer, stopEnd);
    });

    // 3. FINAL OPERATIVE SEGMENT
    if (currentPointer < totalMinutes) {
      const shiftStartObj = parse(validShiftStart, 'HH:mm', new Date());
      list.push({
        type: 'OPERATIVE',
        duration: totalMinutes - currentPointer,
        startTime: format(addMinutes(shiftStartObj, currentPointer), 'HH:mm'),
        endTime: validShiftEnd
      });
    }

    return list;
  }, [shift, stops, masters, totalMinutes, validShiftStart, validShiftEnd]);

  const labels = useMemo(() => {
    const lbls = [];
    const shiftStartDate = parse(validShiftStart, 'HH:mm', new Date());
    const durationHours = Math.max(1, Math.round(totalMinutes / 60));

    for (let i = 0; i <= durationHours; i++) {
       const labelTime = format(addMinutes(shiftStartDate, i * 60), 'HH:mm');
       lbls.push({ 
         time: labelTime, 
         left: totalMinutes > 0 ? (i * 60 / totalMinutes) * 100 : 0 
       });
    }
    return lbls;
  }, [validShiftStart, totalMinutes]);


  // Compute precise percentages for each segment relative to the entire timeline
  const segmentsWithPlacements = useMemo(() => {
    let currentLeft = 0;
    return segments.map((seg) => {
      const segWidth = (seg.duration / totalMinutes) * 100;
      const placement = {
        ...seg,
        startPercent: currentLeft,
        segmentWidth: segWidth,
        centerPercent: currentLeft + (segWidth / 2)
      };
      currentLeft += segWidth;
      return placement;
    });
  }, [segments, totalMinutes]);

  return (
    <div className="w-full space-y-4">
      {/* Segmented Bar */}
      <div className="relative h-12 w-full rounded-lg border border-border flex bg-bg">
        {segmentsWithPlacements.map((seg, idx) => {
          const width = seg.segmentWidth;
          
          let bgColorClass = "bg-success"; // OPERATIVE
          if (seg.type === 'INTERNAL') bgColorClass = "bg-danger"; // INTERNAL
          if (seg.type === 'EXTERNAL') bgColorClass = "bg-zinc-500"; // EXTERNAL

          const isOperative = seg.type === 'OPERATIVE';
          
          const isStop = seg.type === 'INTERNAL' || seg.type === 'EXTERNAL';
          const prevSeg = idx > 0 ? segmentsWithPlacements[idx - 1] : null;
          const hasPrevStop = prevSeg && (prevSeg.type === 'INTERNAL' || prevSeg.type === 'EXTERNAL');
          const showDivider = isStop && hasPrevStop;

          // Slide the translation from 6% (far left) to 94% (far right) dynamically tracking the segment's center.
          // This keeps the tooltip perfectly centered or pushes it inside screen boundaries in extreme cases.
          const clampedX = Math.max(6, Math.min(94, seg.centerPercent));

          return (
            <div 
              key={idx}
              className={cn(
                "h-full relative group transition-all duration-200 hover:z-[100] group-hover:z-[100] z-0",
                bgColorClass,
                showDivider && "border-l border-white/40",
                !readOnly && !isOperative && "cursor-pointer hover:filter hover:brightness-110",
                readOnly && "cursor-default",
                idx === 0 && "rounded-l-[7px]",
                idx === segmentsWithPlacements.length - 1 && "rounded-r-[7px]"
              )}
              style={{ width: `${width}%` }}
              onClick={() => !readOnly && seg.stop && onEdit?.(seg.stop)}
              onMouseEnter={(e) => handleMouseEnter(idx, e)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Tooltip on Hover - Dual wrapper structure prevents transform clashing */}
              <div 
                className={cn(
                  "absolute pointer-events-none group-hover:pointer-events-auto z-[200]",
                  (tooltipDirections[idx] || 'up') === 'down' ? "top-full mt-3" : "bottom-full mb-3"
                )}
                style={{
                  left: '50%',
                  transform: `translateX(-${clampedX}%)`,
                  width: '16rem', // equivalent to w-64 (256px)
                }}
              >
                <div className={cn(
                  "relative bg-surface/95 border border-border p-3.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-2xl text-left backdrop-blur-md",
                  (tooltipDirections[idx] || 'up') === 'down' ? "-translate-y-2 group-hover:translate-y-0" : "translate-y-2 group-hover:translate-y-0"
                )}>
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
                  {/* Arrow points precisely to segment center */}
                  <div 
                    className={cn(
                      "absolute w-2 h-2 bg-surface/95 border-border",
                      (tooltipDirections[idx] || 'up') === 'down' ? "-top-1 border-t border-l" : "-bottom-1 border-r border-b"
                    )}
                    style={{
                      left: `${clampedX}%`,
                      transform: 'translateX(-50%) rotate(45deg)'
                    }}
                  />
                </div>
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
