import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tangence Audit Tool - UI/UX Website Audit Platform',
  description: 'Automated professional UI/UX, responsive, navigation, forms, and visual design website audits.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 min-w-0 overflow-x-hidden">
          {children}
        </main>
        <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
          Tangence Audit Tool &copy; {new Date().getFullYear()} &bull; Professional UI/UX Checklist Audit Engine
        </footer>
      </body>
    </html>
  );
}
