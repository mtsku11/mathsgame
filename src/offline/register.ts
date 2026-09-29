export function registerOffline(onStatus: (status: string, update?: () => void) => void): void {
  if (!import.meta.env.PROD) { onStatus('Development preview'); return; }
  if (!('serviceWorker' in navigator)) { onStatus('Offline unavailable in this browser'); return; }
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
    const check = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        onStatus('Update ready between journeys', () => {
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
          registration.waiting?.postMessage({ type: 'ACTIVATE' });
        });
      } else if (navigator.serviceWorker.controller) {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => onStatus(event.data === 'READY' ? 'Ready offline' : 'Offline cache incomplete');
        navigator.serviceWorker.controller.postMessage({ type: 'CHECK' }, [channel.port2]);
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', check);
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', check));
    navigator.serviceWorker.ready.then(check);
    check();
  }).catch(() => onStatus('Offline unavailable — keep this page online'));
}
