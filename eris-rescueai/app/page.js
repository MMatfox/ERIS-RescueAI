'use client';
 
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { translations } from '../lib/translations';

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

  const [lang, setLang] = useState('fr');
  const t = translations[lang];

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

  // Récupère les derniers événements SOS depuis l'API backend
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
        console.error(t.error, json.error);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiKey]);

  // Interroge l'API toutes les 6 secondes pour afficher les nouvelles alertes
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

  // Envoie un signal SOS simulé vers l'endpoint d'ingestion
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
        setSimResult({ success: true, message: t.successIngest });
        await fetchEvents(true);
      } else {
        setSimResult({ success: false, message: `${t.error} ${json.error}` });
      }
    } catch (err) {
      setSimResult({ success: false, message: `${t.networkError} ${err.message}` });
    } finally {
      setSimulating(false);
    }
  };

  // Met à jour le statut d'une alerte dans la base de données
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
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.js file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
