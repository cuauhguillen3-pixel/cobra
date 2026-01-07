import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

    setIsIOS(isIOSDevice);
    setIsStandalone(isInStandaloneMode || window.matchMedia('(display-mode: standalone)').matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowInstallBanner(false);
      }
    }
  }, []);

  if (isStandalone) {
    return null;
  }

  if (isIOS && !isStandalone) {
    return showInstallBanner ? (
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg z-50 border-t-2 border-blue-400">
        <div className="max-w-4xl mx-auto flex items-start gap-3">
          <Download className="mt-1 flex-shrink-0" size={24} />
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Instalar App</h3>
            <p className="text-sm text-blue-100">
              Para instalar esta app en tu iPhone/iPad:
            </p>
            <ol className="text-sm text-blue-100 mt-2 space-y-1 list-decimal list-inside">
              <li>Toca el icono de compartir en Safari</li>
              <li>Selecciona "Agregar a pantalla de inicio"</li>
              <li>Toca "Agregar"</li>
            </ol>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:bg-blue-800 p-2 rounded-lg transition flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    ) : null;
  }

  if (deferredPrompt && showInstallBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg z-50 border-t-2 border-blue-400">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Download className="flex-shrink-0" size={24} />
          <div className="flex-1">
            <h3 className="font-bold text-lg">Instalar App</h3>
            <p className="text-sm text-blue-100">
              Instala la aplicación en tu dispositivo para acceso rápido y sin conexión
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition shadow-md"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-white hover:bg-blue-800 rounded-lg transition"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
