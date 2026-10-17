import './globals.css';
import Script from 'next/script';
export const metadata = { title: 'Discharge Compass: clear, verified recovery plans', description: 'Plain-language, source-verified post-hospital recovery plans.', manifest: '/manifest.webmanifest' };
export const viewport = { themeColor: '#0d9488' };
export default function L({ children }) {
  return (<html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet" />
  </head><body><a className="skip" href="#demo">Skip to the live demo</a>{children}<Script id="pwa-register" strategy="afterInteractive">{"if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});"}</Script></body></html>);
}
