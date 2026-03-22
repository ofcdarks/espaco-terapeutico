import { Link } from "react-router-dom";
import { Home } from "lucide-react";
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" role="main">
      <div className="text-center">
        <p className="text-7xl font-bold text-brand-600/20" aria-hidden="true">404</p>
        <h1 className="text-2xl font-semibold mt-4">Página não encontrada</h1>
        <p className="text-surface-500 mt-2 text-sm">A página que você procura não existe.</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2 mt-6"><Home size={16} aria-hidden="true" /> Voltar ao início</Link>
      </div>
    </div>
  );
}
