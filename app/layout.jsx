import './globals.css';
import { ProgressProvider } from '../components/Progress';
import Shell from '../components/Shell';
import { loadContent } from '../lib/content.mjs';

export const metadata = {
  title: 'System Design Manual — SDE 2',
  description: 'A day-by-day system design companion for SDE-2 interviews: lessons, case studies, LLD, flashcards and curated resources.',
};

// Set the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('sdm_theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  const { items } = loadContent();
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ProgressProvider>
          <Shell planIds={items.map(i => i.id)}>{children}</Shell>
        </ProgressProvider>
      </body>
    </html>
  );
}
