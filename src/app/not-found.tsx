import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">LaBorneTRAIT</p>
      <h1 className="mt-3 text-5xl font-bold">Page introuvable</h1>
      <p className="mt-4 max-w-md text-muted-foreground">Cette page n’existe pas ou n’est plus disponible.</p>
      <Link href="/" className="mt-8 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground">Retour à l’accueil</Link>
    </main>
  );
}
