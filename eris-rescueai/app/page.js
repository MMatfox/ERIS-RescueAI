'use client';
 
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const AlertsMap = dynamic(() => import('../components/AlertsMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] w-full bg-zinc-900 flex items-center justify-center border border-zinc-800 rounded-xl">
      <div className="text-zinc-400 text-sm animate-pulse flex items-center gap-2">
        <svg className="animate-spin h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Chargement de la carte...
      </div>
    </div>
  )
});


export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || '';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDuplicates, setShowDuplicates] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');

  const [simDevice, setSimDevice] = useState('device-vt-088');
  const [simLat, setSimLat] = useState('16.0544');
  const [simLng, setSimLng] = useState('108.2022');
  const [simBattery, setSimBattery] = useState('85');
  const [simImpact, setSimImpact] = useState('none');
  const [simFall, setSimFall] = useState(false);
  const [simCrash, setSimCrash] = useState(false);
  const [simInactivity, setSimInactivity] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  // Fetch the latest SOS events from backend API
  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const headers = {};
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      const response = await fetch('/api/sos/events', { headers });
      const json = await response.json();
      if (json.success) {
        setEvents(json.data || []);
      } else {
        console.error("Erreur:", json.error);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiKey]);

  // Poll for new events every 6 seconds to show real-time ingestion
  useEffect(() => {
    setTimeout(() => {
      fetchEvents(true);
    }, 0);
    const interval = setInterval(() => {
      fetchEvents(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  useEffect(() => {
    if (selectedEvent) {
      const updated = events.find(e => e.id === selectedEvent.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedEvent)) {
        setTimeout(() => {
          setSelectedEvent(updated);
        }, 0);
      }
    }
  }, [events, selectedEvent]);

  const loadPreset = (presetType) => {
    const randomSuffix = Math.floor(Math.random() * 900) + 100;
    
    switch (presetType) {
      case 'fall':
        setSimDevice(`device-fall-${randomSuffix}`);
        setSimLat('16.0620'); 
        setSimLng('108.2150');
        setSimBattery('18'); 
        setSimImpact('high');
        setSimFall(true);
        setSimCrash(false);
        setSimInactivity(true);
        break;
      case 'crash':
        setSimDevice(`device-crash-${randomSuffix}`);
        setSimLat('21.0285'); 
        setSimLng('105.8542');
        setSimBattery('92');
        setSimImpact('extreme');
        setSimFall(false);
        setSimCrash(true);
        setSimInactivity(false);
        break;
      case 'manual':
        setSimDevice(`device-manual-${randomSuffix}`);
        setSimLat('10.8231'); 
        setSimLng('106.6297');
        setSimBattery('5'); 
        setSimImpact('none');
        setSimFall(false);
        setSimCrash(false);
        setSimInactivity(false);
        break;
      default:
        break;
    }
    setSimResult(null);
  };

  // Simulate sending a telemetry SOS signal to the ingest API
  const submitSimulatedEvent = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setSimResult(null);

    const payload = {
      device_id: simDevice,
      lat: parseFloat(simLat) || 0,
      lng: parseFloat(simLng) || 0,
      sensor_data: {
        battery: parseInt(simBattery) || 100,
        impact: simImpact !== 'none' ? simImpact : undefined,
        fall_detected: simFall,
        crash_detected: simCrash,
        inactivity: simInactivity
      }
    };

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      const response = await fetch('/api/sos/ingest', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (json.success) {
        setSimResult({ success: true, message: "Alerte SOS ingérée avec succès !" });
        await fetchEvents(true);
      } else {
        setSimResult({ success: false, message: `Erreur: ${json.error}` });
      }
    } catch (err) {
      setSimResult({ success: false, message: `Erreur réseau: ${err.message}` });
    } finally {
      setSimulating(false);
    }
  };

  // Update event status or duplicate attribute in database
  const updateEventAttribute = async (eventId, updates) => {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      const response = await fetch('/api/sos/events', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: eventId, ...updates })
      });
      const json = await response.json();
      if (json.success) {
        await fetchEvents(true);
      }
    } catch (err) {
      console.error("Failed to update event:", err);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    
    let matchesDuplicate = true;
    if (showDuplicates === 'no_duplicates') {
      matchesDuplicate = !event.is_duplicate;
    } else if (showDuplicates === 'only_duplicates') {
      matchesDuplicate = event.is_duplicate;
    }

    const matchesSearch = searchQuery === '' || 
      event.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.ai_recommendation && event.ai_recommendation.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesDuplicate && matchesSearch;
  });

  const totalEvents = events.length;
  const activeEvents = events.filter(e => e.status === 'pending' || e.status === 'in_progress').length;
  const criticalEvents = events.filter(e => e.priority_score >= 70 && e.status !== 'resolved' && !e.is_duplicate).length;
  const resolvedEvents = events.filter(e => e.status === 'resolved').length;
  const duplicateEvents = events.filter(e => e.is_duplicate).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col selection:bg-rose-500 selection:text-white">
      { }
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                ERIS <span className="text-rose-500 font-light">RescueAI</span> Hub
              </h1>
              <p className="text-xs text-zinc-400">Plateforme d&apos;ingestion, de filtrage et de priorisation des SOS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {refreshing && (
              <span className="text-xs text-zinc-400 animate-pulse flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1 rounded-md">
                <svg className="animate-spin h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Mise à jour...
              </span>
            )}
            <button
              onClick={() => fetchEvents(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 font-medium border border-zinc-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              Rafraîchir
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        { }
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
            <span className="text-xs text-zinc-400 font-medium">Alertes Actives</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-white">{activeEvents}</span>
              <span className="text-xs text-amber-500 font-medium">Non résolues</span>
            </div>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition relative overflow-hidden">
            <div className="absolute top-0 right-0 h-1 w-full bg-rose-500 animate-pulse"></div>
            <span className="text-xs text-zinc-400 font-medium">Priorités Critiques</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-rose-500">{criticalEvents}</span>
              <span className="text-xs text-rose-400/80 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-900">Score &ge; 70</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
            <span className="text-xs text-zinc-400 font-medium">Doublons Identifiés</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-zinc-400">{duplicateEvents}</span>
              <span className="text-xs text-zinc-500">Filtrés</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
            <span className="text-xs text-zinc-400 font-medium">Alertes Résolues</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-emerald-500">{resolvedEvents}</span>
              <span className="text-xs text-emerald-500/85">Archivées</span>
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
            <span className="text-xs text-zinc-400 font-medium">Total Ingestions</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-white">{totalEvents}</span>
              <span className="text-xs text-zinc-400">Signaux reçus</span>
            </div>
          </div>
        </section>

        { }
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          { }
          <section className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
              <h2 className="text-md font-semibold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-500"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7"/><path d="M15 9l-3 3 3 3"/></svg>
                Simulateur d&apos;API Ingest
              </h2>
              <span className="text-xs bg-rose-950 text-rose-400 px-2 py-0.5 rounded font-mono border border-rose-900/50">
                POST /api/sos/ingest
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Utilisez ce module pour envoyer des alertes simulées de l&apos;application mobile ou des boîtiers d&apos;urgence. Le système RescueAI évaluera automatiquement la priorité, détectera les doublons et générera des recommandations par IA.
            </p>

            { }
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Préréglages d&apos;urgence (Vietnam) :</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => loadPreset('fall')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-2 rounded text-xs transition border border-zinc-700/80 font-medium flex flex-col items-center gap-1 text-center"
                >
                  <span>🤸</span>
                  <span>Chute Grave</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('crash')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-2 rounded text-xs transition border border-zinc-700/80 font-medium flex flex-col items-center gap-1 text-center"
                >
                  <span>🚗</span>
                  <span>Crash Auto</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('manual')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-2 rounded text-xs transition border border-zinc-700/80 font-medium flex flex-col items-center gap-1 text-center"
                >
                  <span>🚨</span>
                  <span>SOS Manuel</span>
                </button>
              </div>
            </div>

            { }
            <form onSubmit={submitSimulatedEvent} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 block font-medium">Device ID</label>
                <input
                  type="text"
                  required
                  value={simDevice}
                  onChange={(e) => setSimDevice(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-rose-500 transition font-mono"
                  placeholder="e.g. device-sos-001"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 block font-medium">Latitude</label>
                  <input
                    type="text"
                    required
                    value={simLat}
                    onChange={(e) => setSimLat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-rose-500 transition font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 block font-medium">Longitude</label>
                  <input
                    type="text"
                    required
                    value={simLng}
                    onChange={(e) => setSimLng(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-rose-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 block font-medium">Force de l&apos;impact</label>
                  <select
                    value={simImpact}
                    onChange={(e) => setSimImpact(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-rose-500 transition"
                  >
                    <option value="none">Aucun (0G)</option>
                    <option value="low">Faible</option>
                    <option value="high">Élevé (Crash/Chute)</option>
                    <option value="extreme">Extrême (&gt;10G)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 block font-medium">Batterie (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={simBattery}
                    onChange={(e) => setSimBattery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-rose-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                <span className="text-xs font-semibold text-zinc-300 block">Signaux de Capteurs</span>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simFall}
                      onChange={(e) => setSimFall(e.target.checked)}
                      className="accent-rose-500 h-4 w-4 rounded"
                    />
                    <span>Chute détectée (Accéléromètre)</span>
                  </label>
                  
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simCrash}
                      onChange={(e) => setSimCrash(e.target.checked)}
                      className="accent-rose-500 h-4 w-4 rounded"
                    />
                    <span>Accident routier (G-Sensor)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simInactivity}
                      onChange={(e) => setSimInactivity(e.target.checked)}
                      className="accent-rose-500 h-4 w-4 rounded"
                    />
                    <span>Absence de mouvement (Inactivité)</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800/50 text-white font-medium py-2 rounded text-sm transition mt-2 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/20"
              >
                {simulating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Transmission en cours...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    Transmettre le signal SOS
                  </>
                )}
              </button>

              {simResult && (
                <div className={`text-xs p-2.5 rounded border ${simResult.success ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400' : 'bg-rose-950/30 border-rose-900 text-rose-400'}`}>
                  {simResult.message}
                </div>
              )}
            </form>
          </section>

          { }
          <section className="lg:col-span-2 space-y-4">
            
            {/* Carte interactive */}
            <div className="h-[380px] w-full">
              <AlertsMap 
                events={events} 
                selectedEvent={selectedEvent} 
                setSelectedEvent={setSelectedEvent} 
                onShowDetails={(event) => {
                  setSelectedEvent(event);
                  setIsModalOpen(true);
                }}
              />
            </div>

            { }
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6" y1="6" y2="6.01"/><line x1="6" x2="6" y1="18" y2="18.01"/></svg>
                  Flux de Données Ingestées ({filteredEvents.length})
                </h3>
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-rose-500 transition"
                    placeholder="Filtrer par Device ID, recommandation..."
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2 border-t border-zinc-800 text-xs">
                { }
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Statut :</span>
                  <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2 py-1 rounded transition ${statusFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Tous
                    </button>
                    <button
                      onClick={() => setStatusFilter('pending')}
                      className={`px-2 py-1 rounded transition ${statusFilter === 'pending' ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      En attente
                    </button>
                    <button
                      onClick={() => setStatusFilter('in_progress')}
                      className={`px-2 py-1 rounded transition ${statusFilter === 'in_progress' ? 'bg-sky-500/10 text-sky-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      En cours
                    </button>
                    <button
                      onClick={() => setStatusFilter('resolved')}
                      className={`px-2 py-1 rounded transition ${statusFilter === 'resolved' ? 'bg-emerald-500/10 text-emerald-500 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Résolu
                    </button>
                  </div>
                </div>

                { }
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Doublons :</span>
                  <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
                    <button
                      onClick={() => setShowDuplicates('all')}
                      className={`px-2 py-1 rounded transition ${showDuplicates === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                    >
                      Afficher tout
                    </button>
                    <button
                      onClick={() => setShowDuplicates('no_duplicates')}
                      className={`px-2 py-1 rounded transition ${showDuplicates === 'no_duplicates' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                    >
                      Masquer doublons
                    </button>
                    <button
                      onClick={() => setShowDuplicates('only_duplicates')}
                      className={`px-2 py-1 rounded transition ${showDuplicates === 'only_duplicates' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                    >
                      Uniquement doublons
                    </button>
                  </div>
                </div>
              </div>
            </div>

            { }
            {loading ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <svg className="animate-spin h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-zinc-400 text-sm">Chargement des alertes depuis Supabase...</span>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-zinc-600"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <p className="text-sm font-semibold">Aucun événement ne correspond à vos filtres.</p>
                <p className="text-xs text-zinc-600 mt-1">Envoyez une alerte d&apos;urgence à l&apos;aide du simulateur pour populer le flux.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredEvents.map(event => {
                  const isCritical = event.priority_score >= 70 && event.status !== 'resolved';
                  
                  let scoreBg = 'bg-zinc-800 text-zinc-400';
                  if (event.priority_score >= 70) scoreBg = 'bg-rose-950/70 text-rose-400 border border-rose-900/60';
                  else if (event.priority_score >= 40) scoreBg = 'bg-amber-950/50 text-amber-500 border border-amber-900/50';
                  else if (event.priority_score > 0) scoreBg = 'bg-emerald-950/30 text-emerald-500 border border-emerald-900/40';

                  let statusStyle = 'bg-zinc-800 text-zinc-300';
                  if (event.status === 'pending') statusStyle = 'bg-amber-500/10 text-amber-500 border border-amber-500/25';
                  else if (event.status === 'in_progress') statusStyle = 'bg-sky-500/15 text-sky-400 border border-sky-500/25';
                  else if (event.status === 'resolved') statusStyle = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';

                  return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`group bg-zinc-900 border ${isCritical ? 'border-rose-900/60 shadow-md shadow-rose-950/10' : 'border-zinc-800'} rounded-xl p-4 hover:border-zinc-700 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-white tracking-tight">{event.device_id}</span>
                          <span className="text-zinc-600 text-[10px]">&bull;</span>
                          <span className="text-xs text-zinc-400">
                            {new Date(event.created_at || event.timestamp).toLocaleString('fr-FR', {
                              hour: '2-digit', minute: '2-digit', second: '2-digit',
                              day: '2-digit', month: '2-digit'
                            })}
                          </span>
                          
                          { }
                          {event.is_duplicate && (
                            <span className="text-[10px] bg-zinc-850 text-zinc-500 px-2 py-0.5 rounded border border-zinc-800 uppercase font-bold tracking-wider">
                              Doublon
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${statusStyle}`}>
                            {event.status === 'pending' ? 'En attente' : event.status === 'in_progress' ? 'En cours' : 'Résolu'}
                          </span>
                        </div>
                        
                        <p className="text-xs text-zinc-300 font-normal line-clamp-1 leading-relaxed">
                          {event.ai_recommendation || 'Aucune recommandation disponible.'}
                        </p>

                        <div className="flex gap-4 text-[11px] text-zinc-500 font-mono">
                          <span>Lat: {Number(event.latitude).toFixed(4)}</span>
                          <span>Lng: {Number(event.longitude).toFixed(4)}</span>
                          {event.raw_payload?.battery !== undefined && (
                            <span>Batterie: {event.raw_payload.battery}%</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-2.5 md:pt-0 border-zinc-800">
                        { }
                        <div className={`flex flex-col items-center justify-center rounded-lg px-3 py-1.5 text-center min-w-[70px] ${scoreBg}`}>
                          <span className="text-[9px] uppercase tracking-widest font-extrabold opacity-75">Priorité</span>
                          <span className="text-lg font-black font-mono leading-tight">{event.priority_score}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-600 hover:text-white border border-zinc-750 text-zinc-400 transition cursor-pointer flex items-center justify-center hover:shadow-md ml-1"
                          title="Voir les détails de l'alerte"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      { }
      <footer className="mt-auto border-t border-zinc-800 bg-zinc-900/30 text-center py-6 text-xs text-zinc-500">
        <p>&copy; {new Date().getFullYear()} - ERIS RescueAI Backend Console &bull; Développé pour la gestion d&apos;urgence en conditions dégradées</p>
      </footer>

      { }
      {selectedEvent && isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            { }
            <div className="border-b border-zinc-800 p-5 flex items-start justify-between bg-zinc-925 sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-white font-mono">{selectedEvent.device_id}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                    selectedEvent.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/25' : 
                    selectedEvent.status === 'in_progress' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25' : 
                    'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {selectedEvent.status === 'pending' ? 'En attente' : selectedEvent.status === 'in_progress' ? 'En cours' : 'Résolu'}
                  </span>
                  {selectedEvent.is_duplicate && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded border border-zinc-700 uppercase font-bold tracking-wider">
                      Doublon
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  ID Unique: {selectedEvent.id} &bull; Reçu le: {new Date(selectedEvent.created_at || selectedEvent.timestamp).toLocaleString('fr-FR')}
                </p>
              </div>
              <button
                onClick={() => { setSelectedEvent(null); setIsModalOpen(false); }}
                className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-lg transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            { }
            <div className="p-6 space-y-5">
              
              { }
              <div className={`p-4 rounded-xl border flex gap-3 ${
                selectedEvent.priority_score >= 70 ? 'bg-rose-950/20 border-rose-900/50 text-rose-300' :
                selectedEvent.priority_score >= 40 ? 'bg-amber-950/25 border-amber-900/40 text-amber-300' :
                'bg-zinc-800/40 border-zinc-700/50 text-zinc-300'
              }`}>
                <span className="text-2xl mt-0.5">💡</span>
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-widest font-black opacity-75">Analyse & Recommandation RescueAI</span>
                  <p className="text-sm leading-relaxed font-medium">
                    {selectedEvent.ai_recommendation || "Aucune analyse disponible."}
                  </p>
                </div>
              </div>

              { }
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3.5">
                <span className="text-xs font-semibold text-zinc-300 block">Actions de Triage</span>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  { }
                  <div className="flex-1 space-y-1">
                    <span className="text-[11px] text-zinc-500 block">Changer le statut :</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => updateEventAttribute(selectedEvent.id, { status: 'pending' })}
                        className={`py-1.5 px-2.5 rounded text-xs transition font-semibold border ${selectedEvent.status === 'pending' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-zinc-900 border-zinc-850 hover:border-zinc-750 text-zinc-400 hover:text-zinc-200'}`}
                      >
                        En attente
                      </button>
                      <button
                        onClick={() => updateEventAttribute(selectedEvent.id, { status: 'in_progress' })}
                        className={`py-1.5 px-2.5 rounded text-xs transition font-semibold border ${selectedEvent.status === 'in_progress' ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-zinc-900 border-zinc-850 hover:border-zinc-750 text-zinc-400 hover:text-zinc-200'}`}
                      >
                        En cours
                      </button>
                      <button
                        onClick={() => updateEventAttribute(selectedEvent.id, { status: 'resolved' })}
                        className={`py-1.5 px-2.5 rounded text-xs transition font-semibold border ${selectedEvent.status === 'resolved' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-850 hover:border-zinc-750 text-zinc-400 hover:text-zinc-200'}`}
                      >
                        Résolu
                      </button>
                    </div>
                  </div>

                  { }
                  <div className="sm:w-[180px] space-y-1">
                    <span className="text-[11px] text-zinc-500 block">Gestion des doublons :</span>
                    <button
                      onClick={() => updateEventAttribute(selectedEvent.id, { is_duplicate: !selectedEvent.is_duplicate })}
                      className={`w-full py-1.5 px-2.5 rounded text-xs transition font-semibold border flex items-center justify-center gap-1.5 ${selectedEvent.is_duplicate ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-zinc-900 border-zinc-850 hover:border-zinc-750 text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M12 11v6"/></svg>
                      {selectedEvent.is_duplicate ? 'Considérer Réelet' : 'Signaler Doublon'}
                    </button>
                  </div>
                </div>
              </div>

              { }
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                { }
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                  <span className="text-xs font-semibold text-zinc-300 block">Coordonnées Géographiques</span>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">Latitude</span>
                      <span className="font-mono text-zinc-300">{selectedEvent.latitude}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">Longitude</span>
                      <span className="font-mono text-zinc-300">{selectedEvent.longitude}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">Altitude</span>
                      <span className="font-mono text-zinc-300">{selectedEvent.raw_payload?.altitude !== undefined ? `${selectedEvent.raw_payload.altitude} m` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500">Lien Google Maps</span>
                      <a 
                        href={`https://maps.google.com/?q=${selectedEvent.latitude},${selectedEvent.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-400 hover:text-rose-300 hover:underline transition font-semibold"
                      >
                        Ouvrir la carte &nearr;
                      </a>
                    </div>
                  </div>
                </div>

                { }
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                  <span className="text-xs font-semibold text-zinc-300 block">Évaluation de Priorité</span>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">Score Tri</span>
                      <span className="font-mono text-white font-bold">{selectedEvent.priority_score} / 100</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">Gravité de l&apos;impact</span>
                      <span className="font-mono text-zinc-300">{selectedEvent.raw_payload?.impact || 'Aucun'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">État de batterie</span>
                      <span className="font-mono text-zinc-300">{selectedEvent.raw_payload?.battery !== undefined ? `${selectedEvent.raw_payload.battery}%` : 'Inconnu'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500">Type de Capteurs</span>
                      <span className="font-mono text-zinc-300">
                        {[
                          selectedEvent.raw_payload?.fall_detected ? 'Chute' : '',
                          selectedEvent.raw_payload?.crash_detected ? 'Crash' : '',
                          selectedEvent.raw_payload?.inactivity ? 'Inactivité' : ''
                        ].filter(Boolean).join(', ') || 'Manuel (Bouton SOS)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              { }
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                <span className="text-xs font-semibold text-zinc-300 block">Dossier Médical de l&apos;Abonné</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850/80">
                    <span className="text-zinc-500 block mb-1 font-medium">Groupe Sanguin</span>
                    <span className="font-mono text-rose-400 font-bold text-sm bg-rose-950/20 px-2 py-0.5 rounded border border-rose-900/40 inline-block">
                      {selectedEvent.raw_payload?.blood_type || 'O+'}
                    </span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850/80">
                    <span className="text-zinc-500 block mb-1 font-medium">Allergies Signalées</span>
                    <span className="text-zinc-300 font-semibold">
                      {selectedEvent.raw_payload?.allergies && selectedEvent.raw_payload.allergies !== 'None' ? selectedEvent.raw_payload.allergies : 'Aucune allergie connue'}
                    </span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850/80">
                    <span className="text-zinc-500 block mb-1 font-medium">Antécédents / Maladies</span>
                    <span className="text-zinc-300 font-semibold">
                      {selectedEvent.raw_payload?.medical_conditions && selectedEvent.raw_payload.medical_conditions !== 'None' ? selectedEvent.raw_payload.medical_conditions : 'Aucun antécédent majeur'}
                    </span>
                  </div>
                </div>
              </div>

              { }
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300 block">Payload JSON Ingesté</span>
                <pre className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 text-xs font-mono text-zinc-400 overflow-x-auto max-h-[160px]">
                  {JSON.stringify(selectedEvent.raw_payload, null, 2)}
                </pre>
              </div>

            </div>

            { }
            <div className="border-t border-zinc-800 p-4 bg-zinc-925 flex justify-end">
              <button
                onClick={() => { setSelectedEvent(null); setIsModalOpen(false); }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm font-semibold transition border border-zinc-750"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
