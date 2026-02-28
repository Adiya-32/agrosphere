export type TimeHorizon = "past" | "present" | "future";
export type SpectralLayer = "ndvi" | "sar" | "degradation";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MetricSeries {
  x: (string | number)[];
  y: number[];
  unit: string;
  label: string;
  suggestedMin?: number;
  suggestedMax?: number;
}

export interface LayerKpis {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  note: string;
}

export interface CarbonEstimate {
  areaHa: number;
  co2TonsPerYear: number;
  priceUsdPerTon: number;
  totalCo2Tons: number;
  estimatedUsd: number;
  confidencePct: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromLatLng(loc: LatLng) {
  // Stable hash-like seed from coordinates
  const a = Math.floor((loc.lat + 90) * 100000);
  const b = Math.floor((loc.lng + 180) * 100000);
  return (a * 2654435761 + b * 1597334677) >>> 0;
}

function mean(arr: number[]) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function trendDirection(arr: number[]) {
  if (arr.length < 3) return "≈";
  const first = mean(arr.slice(0, Math.floor(arr.length / 3)));
  const last = mean(arr.slice(Math.floor((arr.length * 2) / 3)));
  const delta = last - first;
  if (Math.abs(delta) < 0.03 * Math.max(1, Math.abs(first))) return "≈";
  return delta > 0 ? "↑" : "↓";
}

export function layerLabel(layer: SpectralLayer) {
  switch (layer) {
    case "ndvi":
      return "NDVI (Plant Health)";
    case "sar":
      return "SAR (Soil Moisture)";
    case "degradation":
      return "Degradation Risk";
  }
}

export function generateLayerSeries(
  location: LatLng,
  layer: SpectralLayer,
  horizon: TimeHorizon,
): MetricSeries {
  const rng = mulberry32(seedFromLatLng(location) + (layer === "ndvi" ? 11 : layer === "sar" ? 22 : 33));

  const now = new Date();
  const x: (string | number)[] = [];
  const y: number[] = [];

  if (horizon === "past") {
    const startYear = 2016;
    for (let i = 0; i < 10; i++) {
      x.push(startYear + i);
    }
  } else if (horizon === "present") {
    // Last 12 months
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setMonth(d.getMonth() - 11);
    for (let i = 0; i < 12; i++) {
      x.push(d.toLocaleString(undefined, { month: "short" }) + " " + d.getFullYear());
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    // Next 5 years
    const start = now.getFullYear() + 1;
    for (let i = 0; i < 5; i++) {
      x.push(start + i);
    }
  }

  // Base signal varies with location
  const locFactor = (location.lat % 1 + location.lng % 1 + 2) % 1; // 0..1-ish

  if (layer === "ndvi") {
    const base = clamp(0.25 + locFactor * 0.45 + rng() * 0.15, 0.15, 0.85);
    const seasonalAmp = 0.08 + rng() * 0.08;
    const noise = 0.03 + rng() * 0.03;

    for (let i = 0; i < x.length; i++) {
      const season = Math.sin((i / Math.max(1, x.length - 1)) * Math.PI * 2) * seasonalAmp;
      const drift = horizon === "future" ? i * (0.01 + rng() * 0.004) : horizon === "past" ? i * (rng() * 0.002 - 0.001) : 0;
      const v = clamp(base + season + drift + (rng() - 0.5) * noise, 0, 1);
      y.push(Number(v.toFixed(3)));
    }

    return {
      x,
      y,
      unit: "",
      label: "NDVI",
      suggestedMin: 0,
      suggestedMax: 1,
    };
  }

  if (layer === "sar") {
    const base = clamp(35 + locFactor * 35 + rng() * 10, 10, 90);
    const seasonalAmp = 8 + rng() * 10;
    const noise = 4 + rng() * 4;

    for (let i = 0; i < x.length; i++) {
      const season = Math.cos((i / Math.max(1, x.length - 1)) * Math.PI * 2) * seasonalAmp;
      const drift = horizon === "future" ? i * (1.2 + rng() * 0.4) : horizon === "past" ? i * (rng() * 0.6 - 0.3) : 0;
      const v = clamp(base + season - drift + (rng() - 0.5) * noise, 0, 100);
      y.push(Number(v.toFixed(1)));
    }

    return {
      x,
      y,
      unit: "%",
      label: "Soil moisture index",
      suggestedMin: 0,
      suggestedMax: 100,
    };
  }

  // degradation
  const base = clamp(25 + (1 - locFactor) * 45 + rng() * 12, 0, 95);
  const noise = 6 + rng() * 6;

  for (let i = 0; i < x.length; i++) {
    const drift = horizon === "future" ? i * (2.0 + rng() * 0.8) : horizon === "past" ? i * (rng() * 1.2 - 0.4) : 0;
    const v = clamp(base + drift + (rng() - 0.5) * noise, 0, 100);
    y.push(Number(v.toFixed(1)));
  }

  return {
    x,
    y,
    unit: "/100",
    label: "Risk score",
    suggestedMin: 0,
    suggestedMax: 100,
  };
}

export function layerKpis(series: MetricSeries, layer: SpectralLayer, horizon: TimeHorizon): LayerKpis {
  const avg = mean(series.y);
  const cur = series.y[series.y.length - 1] ?? 0;
  const vol = stdev(series.y);
  const tr = trendDirection(series.y);

  const horizonLabel = horizon === "past" ? "история" : horizon === "present" ? "текущее" : "прогноз";

  if (layer === "ndvi") {
    const health =
      cur >= 0.65 ? "Отлично" : cur >= 0.45 ? "Норма" : cur >= 0.3 ? "Стресс" : "Критично";
    return {
      primaryLabel: `NDVI (${horizonLabel})`,
      primaryValue: `${cur.toFixed(2)} ${tr}`,
      secondaryLabel: "Среднее / волатильность",
      secondaryValue: `${avg.toFixed(2)} / ${vol.toFixed(2)}`,
      note: `Оценка: ${health}. Значения ближе к 1 — здоровая растительность.`,
    };
  }

  if (layer === "sar") {
    const droughtRisk = cur <= 25 ? "Высокий" : cur <= 40 ? "Средний" : "Низкий";
    return {
      primaryLabel: `Влажность (${horizonLabel})`,
      primaryValue: `${cur.toFixed(0)}% ${tr}`,
      secondaryLabel: "Среднее / волатильность",
      secondaryValue: `${avg.toFixed(0)}% / ${vol.toFixed(1)}`,
      note: `Риск засухи: ${droughtRisk}. Ниже 25% — вероятен дефицит влаги.`,
    };
  }

  const level = cur >= 70 ? "Высокий" : cur >= 45 ? "Средний" : "Низкий";
  return {
    primaryLabel: `Риск деградации (${horizonLabel})`,
    primaryValue: `${cur.toFixed(0)}/100 ${tr}`,
    secondaryLabel: "Среднее / волатильность",
    secondaryValue: `${avg.toFixed(0)}/100 / ${vol.toFixed(1)}`,
    note: `Уровень: ${level}. Учитывай уклон, эрозию, перегруз выпасом и засоление.`,
  };
}

export function estimateCarbon(location: LatLng, layer: SpectralLayer, horizon: TimeHorizon): CarbonEstimate {
  const rng = mulberry32(seedFromLatLng(location) + 9001);
  const areaHa = Math.round(60 + rng() * 220); // 60..280 ha

  // Heuristic: better NDVI -> more sequestration, higher degradation risk -> less
  const ndviSeries = generateLayerSeries(location, "ndvi", horizon);
  const degrSeries = generateLayerSeries(location, "degradation", horizon);
  const ndvi = mean(ndviSeries.y);
  const degr = mean(degrSeries.y) / 100;

  const baseTonsPerHa = clamp(1.2 + ndvi * 2.2 - degr * 0.8 + (rng() - 0.5) * 0.2, 0.6, 3.4);
  const co2TonsPerYear = baseTonsPerHa * areaHa;

  // Price assumptions
  const priceUsdPerTon = clamp(14 + rng() * 18, 10, 40);

  // If user is on degradation layer, we slightly penalize confidence
  const layerPenalty = layer === "degradation" ? 8 : layer === "sar" ? 4 : 0;
  const horizonPenalty = horizon === "future" ? 10 : horizon === "past" ? 4 : 0;
  const confidencePct = Math.round(clamp(78 - layerPenalty - horizonPenalty + (rng() - 0.5) * 10, 45, 88));

  const totalCo2Tons = co2TonsPerYear; // annualized estimate
  const estimatedUsd = totalCo2Tons * priceUsdPerTon;

  return {
    areaHa,
    co2TonsPerYear: Number(co2TonsPerYear.toFixed(1)),
    priceUsdPerTon: Number(priceUsdPerTon.toFixed(2)),
    totalCo2Tons: Number(totalCo2Tons.toFixed(1)),
    estimatedUsd: Math.round(estimatedUsd),
    confidencePct,
  };
}

