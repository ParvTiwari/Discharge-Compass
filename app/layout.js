import './globals.css';
export const metadata = { title: 'Discharge Compass', description: 'Every instruction, traced to its source.' };
export default function L({ children }) {
  return (<html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>);
}
