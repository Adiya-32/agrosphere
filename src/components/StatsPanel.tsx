import React from "react";
import Plot from "react-plotly.js";
import {
  estimateCarbon,
  generateLayerSeries,
  layerKpis,
  layerLabel,
  type SpectralLayer,
  type TimeHorizon,
} from "../lib/satelliteAnalysis";

interface StatsPanelProps {
  location: { lat: number; lng: number } | null;
  timeHorizon: TimeHorizon;
  selectedLayer: SpectralLayer;
}

export function StatsPanel({ location, timeHorizon, selectedLayer }: StatsPanelProps) {
  if (!location) {
    return (
      <div className="glass-panel h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-4">
          <span className="text-white/20 text-2xl">?</span>
        </div>
        <h3 className="text-lg font-medium text-white/60">No Area Selected</h3>
        <p className="text-sm text-white/40 mt-2">
          Click on the map to initialize satellite AI analysis
        </p>
      </div>
    );
  }

  const series = generateLayerSeries(location, selectedLayer, timeHorizon);
  const kpis = layerKpis(series, selectedLayer, timeHorizon);
  const carbon = estimateCarbon(location, selectedLayer, timeHorizon);

  const color =
    selectedLayer === "ndvi" ? "#10b981" : selectedLayer === "sar" ? "#3b82f6" : "#ef4444";
  const dash = timeHorizon === "future" ? "dot" : "solid";

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            {layerLabel(selectedLayer)} — {timeHorizon.toUpperCase()}
          </h3>
          <div className="text-[10px] font-mono text-white/40">
            LAT: {location.lat.toFixed(4)} LNG: {location.lng.toFixed(4)}
          </div>
        </div>
        <div className="w-full h-[300px]">
          <Plot
            data={[
              {
                x: series.x,
                y: series.y,
                type: "scatter",
                mode: "lines+markers",
                name: selectedLayer.toUpperCase(),
                line: { color, width: 3, dash },
                marker: { color, size: 7 },
              },
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              margin: { l: 40, r: 20, t: 10, b: 70 },
              showlegend: true,
              legend: { font: { color: "#fff", size: 10 }, orientation: "h", y: -0.25 },
              xaxis: { gridcolor: "rgba(255,255,255,0.1)", tickfont: { color: "#fff", size: 10 } },
              yaxis: {
                gridcolor: "rgba(255,255,255,0.1)",
                tickfont: { color: "#fff", size: 10 },
                range:
                  typeof series.suggestedMin === "number" && typeof series.suggestedMax === "number"
                    ? [series.suggestedMin, series.suggestedMax]
                    : undefined,
                title: {
                  text: series.unit ? `${series.label} (${series.unit})` : series.label,
                  font: { color: "rgba(255,255,255,0.65)", size: 10 },
                },
              },
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-4 border-l-4 border-emerald-500">
          <p className="text-[10px] uppercase tracking-wider text-white/40">{kpis.primaryLabel}</p>
          <p className="text-2xl font-bold font-display mt-1">{kpis.primaryValue}</p>
          <p className="text-[10px] text-white/35 mt-2 leading-relaxed">{kpis.note}</p>
        </div>
        <div className="glass-panel p-4 border-l-4 border-blue-500">
          <p className="text-[10px] uppercase tracking-wider text-white/40">{kpis.secondaryLabel}</p>
          <p className="text-2xl font-bold font-display mt-1">{kpis.secondaryValue}</p>
          <p className="text-[10px] text-white/35 mt-2 leading-relaxed">
            Carbon (annual): ~{carbon.totalCo2Tons.toFixed(0)} tCO₂ • ${carbon.priceUsdPerTon.toFixed(0)}/t • $
            {carbon.estimatedUsd.toLocaleString()} ({carbon.confidencePct}%)
          </p>
        </div>
      </div>
    </div>
  );
}
