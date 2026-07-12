'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Hack pour corriger les icônes de marqueurs Leaflet cassées par Next.js/Webpack
const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

export default function AlertsMap({ events, selectedEvent, setSelectedEvent, onShowDetails }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markersMapRef = useRef(new Map());
  const hasFitRef = useRef(false);

  // Filtres actifs
  const [filterTypes, setFilterTypes] = useState({
    fall: true,
    crash: true,
    inactivity: true,
    manual: true,
  });

  const [filterPriorities, setFilterPriorities] = useState({
    critical: true,
    medium: true,
    low: true,
  });

  const [filterStatuses, setFilterStatuses] = useState({
    pending: true,
    in_progress: true,
    resolved: true,
  });

  const [showDuplicates, setShowDuplicates] = useState(true);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Init de la carte Leaflet
  useEffect(() => {
    fixLeafletIcons();

    if (!mapContainerRef.current || mapRef.current) return;

    // Centré par défaut sur Da Nang au Vietnam
    const map = L.map(mapContainerRef.current, {
      center: [16.0544, 108.2022],
      zoom: 6,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Fond de carte sombre (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Déterminer la catégorie de l'événement pour les filtres
  const getEventClassifications = (event) => {
    let type = 'manual';
    if (event.raw_payload?.fall_detected) type = 'fall';
    else if (event.raw_payload?.crash_detected) type = 'crash';
    else if (event.raw_payload?.inactivity) type = 'inactivity';

    let priority = 'low';
    if (event.priority_score >= 70) priority = 'critical';
    else if (event.priority_score >= 40) priority = 'medium';

    return { type, priority };
  };

  // Filtrage des alertes selon les critères choisis
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const { type, priority } = getEventClassifications(event);

      if (!filterTypes[type]) return false;
      if (!filterPriorities[priority]) return false;

      const status = event.status || 'pending';
      if (!filterStatuses[status]) return false;

      if (!showDuplicates && event.is_duplicate) return false;

      return true;
    });
  }, [events, filterTypes, filterPriorities, filterStatuses, showDuplicates]);

  // Rendu des marqueurs sur la carte
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    markersMapRef.current.clear();

    if (filteredEvents.length === 0) return;

    filteredEvents.forEach((event) => {
      const lat = parseFloat(event.latitude);
      const lng = parseFloat(event.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const isDuplicate = event.is_duplicate;
      const status = event.status || 'pending';

      // Code HTML du marqueur selon l'état (avec animation pulse CSS pour attirer l'attention)
      let htmlContent = '';
      if (isDuplicate) {
        htmlContent = `<div class="relative flex items-center justify-center w-6 h-6">
          <div class="h-3.5 w-3.5 rounded-full bg-zinc-500 border-2 border-zinc-950 shadow-lg"></div>
        </div>`;
      } else if (status === 'resolved') {
        htmlContent = `<div class="relative flex items-center justify-center w-6 h-6">
          <div class="h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950 shadow-lg"></div>
        </div>`;
      } else if (status === 'in_progress') {
        htmlContent = `<div class="relative flex items-center justify-center w-6 h-6">
          <span class="ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-60"></span>
          <div class="relative h-3.5 w-3.5 rounded-full bg-sky-400 border-2 border-zinc-950 shadow-lg"></div>
        </div>`;
      } else {
        htmlContent = `<div class="relative flex items-center justify-center w-6 h-6">
          <span class="ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60"></span>
          <div class="relative h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-zinc-950 shadow-lg"></div>
        </div>`;
      }

      const customIcon = L.divIcon({
        className: `custom-marker-pin ${status}`,
        html: htmlContent,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -10],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Contenu du popup
      const typeLabel =
        event.raw_payload?.fall_detected ? '🤸 Chute Grave' :
        event.raw_payload?.crash_detected ? '🚗 Crash Routier' :
        event.raw_payload?.inactivity ? '🕒 Inactivité' : '🚨 SOS Manuel';

      const statusText =
        status === 'pending' ? 'En attente' :
        status === 'in_progress' ? 'En cours' : 'Résolu';

      const popupContent = document.createElement('div');
      popupContent.className = 'p-1.5 space-y-1 text-xs';
      popupContent.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1 mb-1">
          <strong class="font-mono text-zinc-100">${event.device_id}</strong>
          <span class="px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
            status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
            status === 'in_progress' ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'
          }">${statusText}</span>
        </div>
        <div class="text-zinc-300 font-medium">${typeLabel}</div>
        <div class="text-[10px] text-zinc-400 font-semibold">Priorité: <span class="${event.priority_score >= 70 ? 'text-rose-400 font-bold' : 'text-zinc-300'}">${event.priority_score}/100</span></div>
        <div class="text-[10px] text-zinc-500 font-mono mt-1">${new Date(event.created_at || event.timestamp).toLocaleTimeString('fr-FR')}</div>
        <button class="mt-2 w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-1 px-2 rounded text-[10px] transition text-center cursor-pointer">
          Voir les détails
        </button>
      `;

      popupContent.querySelector('button').onclick = () => {
        onShowDetails(event);
      };

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        mapRef.current.panTo([lat, lng]);
      });

      marker.addTo(markersLayerRef.current);
      markersMapRef.current.set(event.id, marker);
    });

    // Ajuster le zoom pour englober tous les marqueurs au chargement initial uniquement
    if (filteredEvents.length > 0 && !hasFitRef.current) {
      const bounds = L.latLngBounds(filteredEvents.map(e => [parseFloat(e.latitude), parseFloat(e.longitude)]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      hasFitRef.current = true;
    }
  }, [filteredEvents, setSelectedEvent]);

  // Recentrer la carte quand l'utilisateur sélectionne une alerte dans la liste
  useEffect(() => {
    if (!mapRef.current || !selectedEvent) return;

    const lat = parseFloat(selectedEvent.latitude);
    const lng = parseFloat(selectedEvent.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    mapRef.current.setView([lat, lng], 13, { animate: true });

    const marker = markersMapRef.current.get(selectedEvent.id);
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 300);
    }
  }, [selectedEvent]);

  // Stats pour afficher les compteurs dans le panneau de filtres
  const stats = useMemo(() => {
    const counts = {
      fall: 0,
      crash: 0,
      inactivity: 0,
      manual: 0,
      critical: 0,
      medium: 0,
      low: 0,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      duplicates: 0,
    };

    events.forEach((event) => {
      const { type, priority } = getEventClassifications(event);
      const status = event.status || 'pending';

      counts[type]++;
      counts[priority]++;
      counts[status]++;
      if (event.is_duplicate) counts.duplicates++;
    });

    return counts;
  }, [events]);

  const handleRecenter = () => {
    if (mapRef.current && filteredEvents.length > 0) {
      const bounds = L.latLngBounds(filteredEvents.map(e => [parseFloat(e.latitude), parseFloat(e.longitude)]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[350px] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-inner group">
      <style>{`
        .custom-marker-pin .ping {
          animation: pin-ping-pulse 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes pin-ping-pulse {
          75%, 100% {
            transform: scale(2.6);
            opacity: 0;
          }
        }
        .leaflet-popup-content-wrapper {
          background-color: #18181b !important;
          color: #f4f4f5 !important;
          border: 1px solid #27272a !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.5) !important;
        }
        .leaflet-popup-tip {
          background-color: #18181b !important;
          border-left: 1px solid #27272a !important;
          border-bottom: 1px solid #27272a !important;
        }
        .leaflet-control-attribution {
          background: rgba(24, 24, 27, 0.75) !important;
          color: #71717a !important;
          font-size: 9px !important;
          backdrop-blur: 4px;
        }
        .leaflet-bar {
          border: 1px solid #27272a !important;
          box-shadow: none !important;
          border-radius: 0.5rem !important;
          overflow: hidden;
        }
        .leaflet-bar a {
          background-color: #18181b !important;
          color: #a1a1aa !important;
          border-bottom: 1px solid #27272a !important;
          transition: all 0.2s;
        }
        .leaflet-bar a:hover {
          background-color: #27272a !important;
          color: #ffffff !important;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>

      {/* Conteneur de la map */}
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-10" />

      {/* Panneau de filtres et Recentrer */}
      <div className="absolute top-3 right-3 z-[1001] flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition shadow-lg backdrop-blur-md ${
              showFiltersPanel
                ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                : 'bg-zinc-900/90 border-zinc-850 hover:border-zinc-700 text-zinc-300'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtres de Carte
            <span className={`rounded px-1.5 py-0.2 text-[9px] font-black border transition ${
              events.length > filteredEvents.length 
                ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' 
                : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-400'
            }`}>
              {events.length > filteredEvents.length ? `${filteredEvents.length}/${events.length}` : events.length}
            </span>
          </button>
          
          <button
            onClick={handleRecenter}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border bg-zinc-900/90 border-zinc-850 hover:border-zinc-700 text-zinc-300 transition shadow-lg backdrop-blur-md cursor-pointer animate-fadeIn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            Recentrer
          </button>
        </div>

        {/* Panneau de contrôle des filtres */}
        {showFiltersPanel && (
          <div className="w-[245px] max-h-[calc(100%-16px)] overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-2.5 shadow-2xl flex flex-col gap-2 animate-fadeIn text-zinc-200 scrollbar-thin scrollbar-thumb-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Options d&apos;Affichage</span>
              <button
                onClick={() => {
                  setFilterTypes({ fall: true, crash: true, inactivity: true, manual: true });
                  setFilterPriorities({ critical: true, medium: true, low: true });
                  setFilterStatuses({ pending: true, in_progress: true, resolved: true });
                  setShowDuplicates(true);
                }}
                className="text-[9px] text-zinc-500 hover:text-rose-400 font-semibold transition"
              >
                Réinitialiser
              </button>
            </div>

            {/* Catégories d'incidents */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Type d&apos;Incident</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setFilterTypes(prev => ({ ...prev, fall: !prev.fall }))}
                  className={`px-1.5 py-0.5 rounded text-[9px] text-left border flex items-center justify-between transition ${
                    filterTypes.fall ? 'bg-zinc-800/80 border-zinc-700 text-white font-medium' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                  }`}
                >
                  <span>🤸 Chute</span>
                  <span className="font-mono opacity-70">({stats.fall})</span>
                </button>
                <button
                  onClick={() => setFilterTypes(prev => ({ ...prev, crash: !prev.crash }))}
                  className={`px-1.5 py-0.5 rounded text-[9px] text-left border flex items-center justify-between transition ${
                    filterTypes.crash ? 'bg-zinc-800/80 border-zinc-700 text-white font-medium' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                  }`}
                >
                  <span>🚗 Crash</span>
                  <span className="font-mono opacity-70">({stats.crash})</span>
                </button>
                <button
                  onClick={() => setFilterTypes(prev => ({ ...prev, inactivity: !prev.inactivity }))}
                  className={`px-1.5 py-0.5 rounded text-[9px] text-left border flex items-center justify-between transition ${
                    filterTypes.inactivity ? 'bg-zinc-800/80 border-zinc-700 text-white font-medium' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                  }`}
                >
                  <span>🕒 Inac.</span>
                  <span className="font-mono opacity-70">({stats.inactivity})</span>
                </button>
                <button
                  onClick={() => setFilterTypes(prev => ({ ...prev, manual: !prev.manual }))}
                  className={`px-1.5 py-0.5 rounded text-[9px] text-left border flex items-center justify-between transition ${
                    filterTypes.manual ? 'bg-zinc-800/80 border-zinc-700 text-white font-medium' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                  }`}
                >
                  <span>🚨 Man.</span>
                  <span className="font-mono opacity-70">({stats.manual})</span>
                </button>
              </div>
            </div>

            {/* Niveau de Priorité */}
            <div className="space-y-1 border-t border-zinc-850 pt-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Niveau de Priorité</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilterPriorities(prev => ({ ...prev, critical: !prev.critical }))}
                  className={`flex-1 px-1 py-1 rounded text-[9px] border flex flex-col items-center gap-0.5 transition ${
                    filterPriorities.critical ? 'bg-rose-950/30 border-rose-900/60 text-rose-300 font-bold' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                  }`}
                >
                  <span>Critique</span>
                  <span className="font-mono text-[8px] opacity-75">({stats.critical})</span>
                </button>
                <button
                  onClick={() => setFilterPriorities(prev => ({ ...prev, medium: !prev.medium }))}
                  className={`flex-1 px-1 py-1 rounded text-[9px] border flex flex-col items-center gap-0.5 transition ${
                    filterPriorities.medium ? 'bg-amber-950/30 border-amber-900/60 text-amber-300 font-bold' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                  }`}
                >
                  <span>Moyen</span>
                  <span className="font-mono text-[8px] opacity-75">({stats.medium})</span>
                </button>
                <button
                  onClick={() => setFilterPriorities(prev => ({ ...prev, low: !prev.low }))}
                  className={`flex-1 px-1 py-1 rounded text-[9px] border flex flex-col items-center gap-0.5 transition ${
                    filterPriorities.low ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400 font-bold' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                  }`}
                >
                  <span>Faible</span>
                  <span className="font-mono text-[8px] opacity-75">({stats.low})</span>
                </button>
              </div>
            </div>

            {/* Statuts & Doublons */}
            <div className="space-y-1.5 border-t border-zinc-850 pt-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Statut & Doublons</span>
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  <button
                    onClick={() => setFilterStatuses(prev => ({ ...prev, pending: !prev.pending }))}
                    className={`flex-1 px-1 py-0.5 rounded text-[9px] border transition ${
                      filterStatuses.pending ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                    }`}
                  >
                    Attente ({stats.pending})
                  </button>
                  <button
                    onClick={() => setFilterStatuses(prev => ({ ...prev, in_progress: !prev.in_progress }))}
                    className={`flex-1 px-1 py-0.5 rounded text-[9px] border transition ${
                      filterStatuses.in_progress ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-semibold' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                    }`}
                  >
                    Cours ({stats.in_progress})
                  </button>
                  <button
                    onClick={() => setFilterStatuses(prev => ({ ...prev, resolved: !prev.resolved }))}
                    className={`flex-1 px-1 py-0.5 rounded text-[9px] border transition ${
                      filterStatuses.resolved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
                    }`}
                  >
                    Résolu ({stats.resolved})
                  </button>
                </div>

                <div className="flex gap-1 pt-0.5">
                  <button
                    onClick={() => setShowDuplicates(true)}
                    className={`flex-1 py-0.5 rounded text-[9px] border transition font-semibold ${
                      showDuplicates ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    Avec Doublons ({stats.duplicates})
                  </button>
                  <button
                    onClick={() => setShowDuplicates(false)}
                    className={`flex-1 py-0.5 rounded text-[9px] border transition font-semibold ${
                      !showDuplicates ? 'bg-rose-950/20 border-rose-900/50 text-rose-400' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    Sans Doublons
                  </button>
                </div>
                <div className="text-[8px] text-zinc-500 text-center font-medium pt-1.5 border-t border-zinc-850/30 select-none">
                  ℹ️ Statuts (Délivrées, Annulées) harmonisés auto.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Petit récapitulatif en bas à gauche de la carte */}
      <div className="absolute bottom-3 left-3 z-[999] bg-zinc-900/80 backdrop-blur-md border border-zinc-855 rounded-lg py-1.5 px-2.5 text-[10px] text-zinc-400 flex gap-3 shadow-md pointer-events-none select-none font-mono">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500"></span>
          <span>En attente ({filteredEvents.filter(e => !e.is_duplicate && (e.status || 'pending') === 'pending').length})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500"></span>
          <span>En cours ({filteredEvents.filter(e => !e.is_duplicate && e.status === 'in_progress').length})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span>Résolues ({filteredEvents.filter(e => !e.is_duplicate && e.status === 'resolved').length})</span>
        </div>
      </div>
    </div>
  );
}
