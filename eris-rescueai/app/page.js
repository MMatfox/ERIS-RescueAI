export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
      <main className="flex flex-col items-center justify-center w-full max-w-4xl px-6 py-32 gap-8 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
            ERIS RescueAI
          </h1>
          <p className="text-2xl text-gray-600 dark:text-gray-300">
            Emergency Response Intelligence System
          </p>
        </div>

        <p className="max-w-2xl text-lg text-gray-700 dark:text-gray-400 leading-relaxed">
          Plateforme intelligente de gestion d'appels d'urgence SOS en temps réel.
          Coordonnez les interventions d'urgence avec précision et efficacité.
        </p>

        <div className="flex flex-col gap-3 mt-8 sm:flex-row justify-center">
          <a
            href="/dashboard"
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Tableau de Bord
          </a>
          <a
            href="/docs"
            className="px-8 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Documentation
          </a>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="text-3xl mb-2"></div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Géolocalisation</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Localisation en temps réel des appels SOS
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="text-3xl mb-2"></div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Temps Réel</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Traitement instantané des urgences
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="text-3xl mb-2"></div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Intelligence</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Aide à la décision assistée par IA
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
