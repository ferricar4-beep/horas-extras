/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

// ==========================================
// GRAFICO DE BARRAS INTERACTIVO (SVG)
// ==========================================
interface BarChartProps {
  data: { label: string; value: number }[];
  title: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, title }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxValue = Math.max(...data.map(d => d.value), 10);
  const chartHeight = 200;
  const chartWidth = 500;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  return (
    <div className="bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)] relative">
      <h3 className="font-display font-semibold text-gray-700 text-sm mb-4 uppercase tracking-wider">
        {title}
      </h3>
      
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
          No hay datos para mostrar en este período
        </div>
      ) : (
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full min-w-[400px] h-auto"
          >
            {/* Líneas de cuadrícula horizontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = paddingTop + graphHeight * (1 - ratio);
              const value = Math.round(maxValue * ratio * 10) / 10;
              return (
                <g key={i} className="opacity-40">
                  <line
                     x1={paddingLeft}
                     y1={y}
                     x2={chartWidth - paddingRight}
                     y2={y}
                     stroke="#e5e7eb"
                     strokeWidth={1}
                     strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-gray-400 font-sans text-[10px]"
                  >
                    {value}h
                  </text>
                </g>
              );
            })}

            {/* Renderizar Barras */}
            {data.map((item, idx) => {
              const barCount = data.length;
              const barWidth = Math.min(30, (graphWidth / barCount) * 0.6);
              const barSpacing = graphWidth / barCount;
              const x = paddingLeft + idx * barSpacing + (barSpacing - barWidth) / 2;
              
              const barHeight = (item.value / maxValue) * graphHeight;
              const y = paddingTop + graphHeight - barHeight;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-all duration-200"
                >
                  {/* Fondo sutil hover */}
                  <rect
                    x={paddingLeft + idx * barSpacing}
                    y={paddingTop}
                    width={barSpacing}
                    height={graphHeight}
                    className={`fill-transparent transition-colors duration-200 ${
                      hoveredIdx === idx ? 'fill-brand-red-soft/20' : ''
                    }`}
                  />
                  
                  {/* Barra Principal */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 2)}
                    rx={3}
                    className={`transition-all duration-300 ${
                      hoveredIdx === idx
                        ? 'fill-brand-red-hover filter drop-shadow-md'
                        : 'fill-brand-red'
                    }`}
                  />

                  {/* Etiqueta Eje X */}
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight - paddingBottom + 16}
                    textAnchor="middle"
                    className={`font-sans text-[9px] transition-colors ${
                      hoveredIdx === idx ? 'fill-brand-red font-semibold' : 'fill-gray-400'
                    }`}
                  >
                    {item.label}
                  </text>

                  {/* Tooltip flotante dentro del SVG */}
                  {hoveredIdx === idx && (
                    <g className="pointer-events-none">
                      <rect
                        x={Math.max(10, Math.min(chartWidth - 90, x - 30))}
                        y={Math.max(5, y - 28)}
                        width={80}
                        height={22}
                        rx={4}
                        fill="#22242A"
                        className="shadow-md"
                      />
                      <text
                        x={Math.max(10, Math.min(chartWidth - 90, x - 30)) + 40}
                        y={Math.max(5, y - 28) + 14}
                        textAnchor="middle"
                        fill="#ffffff"
                        className="font-sans text-[9px] font-medium"
                      >
                        {item.value.toFixed(1)} hrs
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Línea Base Eje X */}
            <line
              x1={paddingLeft}
              y1={chartHeight - paddingBottom}
              x2={chartWidth - paddingRight}
              y2={chartHeight - paddingBottom}
              stroke="#cbd5e1"
              strokeWidth={1}
            />
          </svg>
        </div>
      )}
    </div>
  );
};


// ==========================================
// GRAFICO DE DONA INTERACTIVO (SVG)
// ==========================================
interface DonutChartProps {
  data: { label: string; value: number }[];
  title: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, title }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Paleta de colores de la marca Ferricar y Semáforo
  const colores = [
    '#C8333E', // Rojo de marca
    '#35407A', // Índigo noche
    '#D69A1E', // Ámbar semáforo
    '#158F63', // Verde semáforo
    '#D9631E', // Alerta (naranja quemado)
    '#4A4D57', // Grafito secundario
    '#A8262F', // Rojo hover
    '#22242A', // Grafito primario
  ];

  const filteredData = data.filter(d => d.value > 0);
  const totalValue = filteredData.reduce((sum, d) => sum + d.value, 0);

  // Calcular acumulados de ángulo
  let accumulatedAngle = 0;
  const slices = filteredData.map((d, i) => {
    const percentage = totalValue > 0 ? (d.value / totalValue) * 100 : 0;
    const angle = totalValue > 0 ? (d.value / totalValue) * 360 : 0;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle = endAngle;

    return {
      label: d.label,
      value: d.value,
      percentage,
      startAngle,
      endAngle,
      color: colores[i % colores.length],
    };
  });

  // Funciones trigonométricas auxiliares para dibujar el arco del SVG
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const getArcPath = (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    // Si el arco es de 360 grados exactos, hacer un truco para evitar error de renderizado del arco
    const isFullCircle = endAngle - startAngle >= 360;
    const finalEndAngle = isFullCircle ? endAngle - 0.01 : endAngle;

    const start = polarToCartesian(x, y, radius, finalEndAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = finalEndAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  };

  const size = 220;
  const center = size / 2;
  const radius = 70;
  const strokeWidth = 24;

  return (
    <div className="bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)] h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display font-semibold text-gray-700 text-sm mb-4 uppercase tracking-wider">
          {title}
        </h3>
      </div>

      {filteredData.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
          No hay horas extras registradas en este período
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-around gap-4 my-auto">
          {/* El SVG de la dona */}
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Círculo de fondo */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#f3f4f6"
                strokeWidth={strokeWidth}
              />

              {/* Trazos de los arcos */}
              {slices.map((slice, idx) => {
                const path = getArcPath(center, center, radius, slice.startAngle, slice.endAngle);
                const isHovered = hoveredIdx === idx;
                
                return (
                  <path
                    key={idx}
                    d={path}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      transformOrigin: 'center',
                      transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </svg>

            {/* Texto en el centro de la dona */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hoveredIdx !== null ? (
                <>
                  <span className="text-[11px] font-sans font-medium text-gray-400 uppercase tracking-tight max-w-[100px] text-center truncate">
                    {slices[hoveredIdx].label}
                  </span>
                  <span className="text-lg font-display font-bold text-gray-800">
                    {slices[hoveredIdx].percentage.toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-mono text-brand-red font-bold">
                    {slices[hoveredIdx].value.toFixed(1)} hrs
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-sans font-medium text-gray-400 uppercase tracking-wider">
                    Total Extras
                  </span>
                  <span className="text-xl font-display font-bold text-gray-800">
                    {totalValue.toFixed(1)}h
                  </span>
                  <span className="text-[9px] font-sans text-gray-400">
                    en el período
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Leyenda interactiva */}
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
            {slices.slice(0, 6).map((slice, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-xs transition-colors p-1 rounded-md cursor-pointer ${
                  hoveredIdx === idx ? 'bg-gray-50 font-medium' : ''
                }`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div
                  className="w-3 h-3 rounded-xs shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-gray-600 truncate max-w-[120px]">{slice.label}</span>
                <span className="text-gray-400 font-mono text-[10px] ml-auto">
                  {slice.value.toFixed(1)}h
                </span>
              </div>
            ))}
            {slices.length > 6 && (
              <div className="text-[10px] text-gray-400 italic pl-5">
                + {slices.length - 6} rutas más
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
