import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'Bot de Gestão WhatsApp | Instituto Sentidos & ISP Preparatórios',
  description: 'Painel administrativo centralizado para envio de boas-vindas, agendamento de arquivos e automação de mídias.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="antialiased flex min-h-screen bg-[#0b1329] text-slate-100">
        <AuthProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Navbar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
