import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Globe, 
  Layers, 
  Calendar, 
  Leaf, 
  Droplets, 
  AlertTriangle, 
  Calculator, 
  MessageSquare, 
  ChevronRight, 
  LogOut,
  Github,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthModal } from './components/AuthModal';
import { MapView } from './components/MapView';
import { StatsPanel } from './components/StatsPanel';
import { AIAssistant } from './components/AIAssistant';
import { cn } from './lib/utils';
import {
  estimateCarbon,
  generateLayerSeries,
  layerKpis,
  type SpectralLayer,
  type TimeHorizon,
} from './lib/satelliteAnalysis';

type Language = 'ru' | 'en' | 'kk';

export default function App() {
  const [user, setUser] = useState<{ username: string, token: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('present');
  const [selectedLayer, setSelectedLayer] = useState<SpectralLayer>('ndvi');
  const [carbonCredits, setCarbonCredits] = useState<number | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [language, setLanguage] = useState<Language>('ru');

  useEffect(() => {
    const saved = localStorage.getItem('agro_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const savedLang = localStorage.getItem('agro_lang') as Language | null;
    if (savedLang === 'ru' || savedLang === 'en' || savedLang === 'kk') {
      setLanguage(savedLang);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('agro_lang', lang);
  };

  const uiText = useMemo(
    () => ({
      title: 'AgroSphere AI',
      subtitle: 'Satellite Intelligence MVP',
      navFeatures: 'Features',
      navAnalytics: 'Analytics',
      navCarbon: 'Carbon Engine',
      signIn: 'Sign In',
      joinNow: 'Join Now',
      heroHeading: 'Precision Agriculture From Space',
      heroHighlight: 'Agriculture',
      heroText:
        'Monitor soil health, predict yields, and monetize carbon sequestration using multi-spectral satellite data and AI.',
      badgeSentinel: 'Sentinel-2 Live',
      badgeGemini: 'Groq AI Analysis',
      timeHorizon: 'Time Horizon',
      past: 'Past (10 Years)',
      present: 'Present Day',
      future: 'AI Forecast',
      horizonHintPast: 'Historical series: 2016–2025',
      horizonHintPresent: 'Current state: last 12 months',
      horizonHintFuture: 'Forecast: next 5 years',
      horizonConfirmHint:
        'Pick and confirm a location on the map to see NDVI / SAR / degradation metrics for this horizon.',
      spectralLayers: 'Spectral Layers',
      carbonEngine: 'Carbon Engine',
      carbonText: 'Calculate potential CO₂ sequestration credits for this area.',
      carbonButton: 'Calculate Credits',
      carbonConfirmHint:
        'To enable calculation, choose a point on the map and confirm it (check icon).',
      overlayTitle:
        'To use the map, AI assistant and analytics, please sign in or create an account.',
      overlaySubtitle:
        'Registration is required: without it, data is not stored and analyses are disabled.',
      overlayButton: 'Sign in / Join now',
      confirmLocation: 'Confirm Location',
      recentAnalysis: 'Recent Analysis',
      recentNeedAuth: 'Sign in to save and reopen previous analyses for your fields.',
      recentEmpty:
        'No saved analyses yet. Ask a question to the assistant for a selected point to create one.',
      activeSession: 'ACTIVE SESSION',
    }),
    [],
  );

  const handleAuthSuccess = (username: string, token: string) => {
    const userData = { username, token };
    setUser(userData);
    localStorage.setItem('agro_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('agro_user');
  };

  const calculateCarbon = () => {
    if (!locationConfirmed || !selectedLocation) return;
    const estimate = estimateCarbon(selectedLocation, selectedLayer, timeHorizon);
    setCarbonCredits(estimate.estimatedUsd);
  };

  const carbonDetails = useMemo(() => {
    if (!locationConfirmed || !selectedLocation || carbonCredits == null) return null;
    return estimateCarbon(selectedLocation, selectedLayer, timeHorizon);
  }, [locationConfirmed, selectedLocation, selectedLayer, timeHorizon, carbonCredits]);

  const sidebarLayerSnapshot = useMemo(() => {
    if (!locationConfirmed || !selectedLocation) return null;
    const ndvi = generateLayerSeries(selectedLocation, 'ndvi', timeHorizon);
    const sar = generateLayerSeries(selectedLocation, 'sar', timeHorizon);
    const degr = generateLayerSeries(selectedLocation, 'degradation', timeHorizon);
    return {
      ndvi: layerKpis(ndvi, 'ndvi', timeHorizon).primaryValue,
      sar: layerKpis(sar, 'sar', timeHorizon).primaryValue,
      degradation: layerKpis(degr, 'degradation', timeHorizon).primaryValue,
    };
  }, [locationConfirmed, selectedLocation, timeHorizon]);

  const horizonHint =
    timeHorizon === 'past'
      ? uiText.horizonHintPast
      : timeHorizon === 'present'
        ? uiText.horizonHintPresent
        : uiText.horizonHintFuture;

  const refreshSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }
    try {
      const res = await fetch('/api/sessions', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) return;
      const raw = await res.json();
      const parsed = (raw as any[]).map((row) => {
        let parsedData: any = null;
        try {
          parsedData =
            row.data && typeof row.data === 'string'
              ? JSON.parse(row.data)
              : row.data ?? null;
        } catch {
          parsedData = null;
        }
        return { ...row, parsedData };
      });
      setSessions(parsed);
    } catch (e) {
      console.error('Failed to load sessions', e);
    }
  }, [user]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const handleSessionClick = (session: any) => {
    const d = session.parsedData || {};

    if (d.location && typeof d.location.lat === 'number' && typeof d.location.lng === 'number') {
      setSelectedLocation({ lat: d.location.lat, lng: d.location.lng });
      setLocationConfirmed(true);
    } else if (typeof session.location === 'string') {
      const [latStr, lngStr] = session.location.split(',').map((s: string) => s.trim());
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        setSelectedLocation({ lat, lng });
        setLocationConfirmed(true);
      }
    }

    if (d.layer) {
      setSelectedLayer(d.layer as SpectralLayer);
    }
    if (d.horizon) {
      setTimeHorizon(d.horizon as TimeHorizon);
    }

    setCarbonCredits(null);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <Globe className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight leading-none">
              {uiText.title}
            </h1>
            <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest mt-1">
              {uiText.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-8 mr-8 text-sm font-medium text-white/60">
            <a href="#features" className="hover:text-emerald-400 transition-colors">
              {uiText.navFeatures}
            </a>
            <a href="#analytics" className="hover:text-emerald-400 transition-colors">
              {uiText.navAnalytics}
            </a>
            <a href="#carbon" className="hover:text-emerald-400 transition-colors">
              {uiText.navCarbon}
            </a>
          </nav>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px]">
              {(['ru', 'en', 'kk'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={cn(
                    'px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                    language === lang
                      ? 'bg-emerald-400 text-black font-semibold'
                      : 'text-white/60 hover:text-white',
                  )}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold">{user.username}</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {uiText.activeSession}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-red-400"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="btn-secondary text-sm"
              >
                {uiText.signIn}
              </button>
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="btn-primary text-sm"
              >
                {uiText.joinNow}
              </button>
            </div>
          )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto w-full flex-1">
        
        {/* Hero Section */}
        <section className="mb-20 text-center max-w-3xl mx-auto pt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl md:text-7xl font-bold font-display tracking-tighter mb-6 leading-[0.9]">
              {uiText.heroHeading.split(' ')[0]}{' '}
              <span className="neon-text-emerald">{uiText.heroHighlight}</span>{' '}
              {uiText.heroHeading.split(' ').slice(1).join(' ')}
            </h2>
            <p className="text-lg text-white/60 mb-10 leading-relaxed">
              {uiText.heroText}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="glass-panel px-6 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                <span className="text-sm font-mono uppercase tracking-wider">
                  {uiText.badgeSentinel}
                </span>
              </div>
              <div className="glass-panel px-6 py-3 flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-mono uppercase tracking-wider">
                  {uiText.badgeGemini}
                </span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Interactive Dashboard */}
        <div className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar Controls */}
          <aside className="lg:col-span-3 space-y-6 sticky top-28">
            
            {/* Time Horizon */}
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-4 text-white/40">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {uiText.timeHorizon}
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { id: 'past', label: uiText.past, icon: '↺' },
                  { id: 'present', label: uiText.present, icon: '●' },
                  { id: 'future', label: uiText.future, icon: '↗' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTimeHorizon(t.id as TimeHorizon)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all border border-transparent",
                      timeHorizon === t.id 
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" 
                        : "hover:bg-white/5 text-white/60"
                    )}
                  >
                    <span>{t.label}</span>
                    <span className="font-mono opacity-40">{t.icon}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[11px] text-white/45 leading-relaxed">{horizonHint}</p>
                {!locationConfirmed && (
                  <p className="text-[11px] text-amber-300/70 mt-2 leading-relaxed">
                    {uiText.horizonConfirmHint}
                  </p>
                )}
              </div>
            </div>

            {/* Analytical Layers */}
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-4 text-white/40">
                <Layers className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {uiText.spectralLayers}
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { id: 'ndvi', label: 'Plant Health (NDVI)', icon: <Leaf className="w-4 h-4" /> },
                  { id: 'sar', label: 'Soil Moisture (SAR)', icon: <Droplets className="w-4 h-4" /> },
                  { id: 'degradation', label: 'Degradation Risk', icon: <AlertTriangle className="w-4 h-4" /> },
                ].map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLayer(l.id as SpectralLayer)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all border border-transparent",
                      selectedLayer === l.id 
                        ? "bg-blue-500/20 border-blue-500/30 text-blue-400" 
                        : "hover:bg-white/5 text-white/60"
                    )}
                  >
                    {l.icon}
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                {sidebarLayerSnapshot ? (
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-white/45">NDVI</span>
                      <span className="font-mono text-emerald-400">{sidebarLayerSnapshot.ndvi}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/45">SAR Moisture</span>
                      <span className="font-mono text-blue-400">{sidebarLayerSnapshot.sar}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/45">Degradation</span>
                      <span className="font-mono text-red-400">{sidebarLayerSnapshot.degradation}</span>
                    </div>
                    <p className="text-[10px] text-white/30 leading-relaxed mt-2">
                      Эти значения пересчитываются при смене горизонта времени и подтверждённой локации.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Подтверди точку на карте, чтобы открыть показатели по слоям.
                  </p>
                )}
              </div>
            </div>

            {/* Carbon Engine */}
            <div className="glass-panel p-5 bg-gradient-to-br from-emerald-500/10 to-transparent">
              <div className="flex items-center gap-2 mb-4 text-white/40">
                <Calculator className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  {uiText.carbonEngine}
                </span>
              </div>
              <p className="text-xs text-white/50 mb-4">{uiText.carbonText}</p>
              <button 
                onClick={calculateCarbon}
                disabled={!selectedLocation || !locationConfirmed}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
              >
                {uiText.carbonButton}
              </button>
              {(!selectedLocation || !locationConfirmed) && (
                <p className="text-[11px] text-white/35 mt-3 leading-relaxed">
                  {uiText.carbonConfirmHint}
                </p>
              )}
              
              <AnimatePresence>
                {carbonCredits && carbonDetails && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-white/10"
                  >
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase text-white/40">Estimated Bonus</p>
                        <p className="text-2xl font-bold text-emerald-400 font-display">${carbonCredits.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-white/40">CO2 Tons</p>
                        <p className="text-lg font-semibold">{carbonDetails.totalCo2Tons.toFixed(1)}</p>
                      </div>
                    </div>
                    <div className="mt-3 text-[10px] text-white/35 leading-relaxed">
                      Area: {carbonDetails.areaHa} ha • Rate: {carbonDetails.co2TonsPerYear.toFixed(0)} tCO₂/yr • Price: ${carbonDetails.priceUsdPerTon.toFixed(0)}/t • Confidence: {carbonDetails.confidencePct}%
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>

          {/* Main Viewport */}
          <div className="lg:col-span-6 space-y-8">
            <div className="h-[600px] relative">
              <MapView 
                onLocationSelect={(lat, lng) => {
                  setSelectedLocation({ lat, lng });
                  setLocationConfirmed(false);
                }}
                selectedLayer={selectedLayer}
                timeHorizon={timeHorizon}
              />
              
              {/* Location Confirmation Overlay */}
              <AnimatePresence>
                {selectedLocation && !locationConfirmed && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute top-6 left-1/2 -translate-x-1/2 z-[500] glass-panel p-4 flex items-center gap-6 shadow-2xl border-emerald-500/50"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Confirm Location</span>
                      <span className="text-sm font-mono">{selectedLocation.lat.toFixed(4)}°, {selectedLocation.lng.toFixed(4)}°</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedLocation(null)}
                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      >
                        <XCircle className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => setLocationConfirmed(true)}
                        className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stats & Charts */}
            <div id="analytics">
              <StatsPanel 
                location={locationConfirmed ? selectedLocation : null} 
                timeHorizon={timeHorizon}
                selectedLayer={selectedLayer}
              />
            </div>
          </div>

          {/* Right Panel: AI & History */}
          <aside className="lg:col-span-3 space-y-6">
            <AIAssistant
              context={{
                location: locationConfirmed ? selectedLocation : null,
                layer: selectedLayer,
                horizon: timeHorizon,
                isConfirmed: locationConfirmed,
              }}
              uiLanguage={language}
              authToken={user?.token}
              onSessionCreated={refreshSessions}
            />
            
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-4 text-white/40">
                <Search className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {uiText.recentAnalysis}
                </span>
              </div>
              <div className="space-y-3">
                {!user && (
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    {uiText.recentNeedAuth}
                  </p>
                )}
                {user && sessions.length === 0 && (
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    {uiText.recentEmpty}
                  </p>
                )}
                {user && sessions.length > 0 && (
                  <>
                    {sessions.map((s, i) => {
                      const d = s.parsedData || {};
                      const title =
                        (d.prompt as string | undefined)?.slice(0, 60) ||
                        (typeof s.location === 'string' ? s.location : 'Saved analysis');
                      const ts = d.createdAt || s.timestamp;
                      const dateLabel = ts ? new Date(ts).toLocaleString() : '';
                      const status =
                        d.layer === 'degradation'
                          ? 'Degradation'
                          : d.layer === 'sar'
                            ? 'Moisture'
                            : 'NDVI';

                      return (
                        <div
                          key={s.id ?? i}
                          onClick={() => handleSessionClick(s)}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {title}
                              {title.length >= 60 && '…'}
                            </p>
                            <p className="text-[10px] text-white/40">{dateLabel}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                d.layer === 'degradation'
                                  ? 'bg-red-500/10 text-red-400'
                                  : d.layer === 'sar'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-emerald-500/10 text-emerald-400',
                              )}
                            >
                              {status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </aside>
          </div>

          {!user && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm">
              <div className="glass-panel max-w-md w-full mx-4 p-6 text-center">
                <p className="text-sm text-white/70 mb-3">
                  {uiText.overlayTitle}
                </p>
                <p className="text-xs text-white/40 mb-4">
                  {uiText.overlaySubtitle}
                </p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="btn-primary w-full py-2 text-sm"
                >
                  {uiText.overlayButton}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="text-emerald-500 w-8 h-8" />
              <h3 className="text-2xl font-bold font-display">AgroSphere AI</h3>
            </div>
            <p className="text-white/40 max-w-sm mb-8">
              Empowering the next generation of farmers with satellite-driven intelligence and AI-powered decision making.
            </p>
            <div className="flex items-center gap-6">
              <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a694445.svg" alt="Google Gemini" className="h-6 opacity-50 hover:opacity-100 transition-opacity" />
              <div className="h-4 w-px bg-white/10"></div>
              <span className="text-[10px] font-bold tracking-widest text-white/30 uppercase">Sentinel Hub Partner</span>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-6">Resources</h4>
            <ul className="space-y-4 text-sm text-white/40">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Satellite Specs</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">API Reference</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-6">Connect</h4>
            <div className="flex gap-4">
              <a href="https://github.com" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
                <MessageSquare className="w-5 h-5" />
              </a>
            </div>
            <p className="text-[10px] text-white/20 mt-8">© 2026 AgroSphere AI. AEROO Space AI Competition Entry.</p>
          </div>
        </div>
      </footer>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
