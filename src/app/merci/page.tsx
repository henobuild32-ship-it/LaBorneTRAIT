import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Merci | LaBorneTRAIT',
  description: 'Merci pour votre confiance envers LaBorneTRAIT.',
};

export default function MerciPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">LaBorneTRAIT</p>
      <h1 className="text-4xl font-bold">Merci pour votre confiance</h1>
      <p className="mt-4 text-muted-foreground">Votre demande a bien été prise en compte. Vous pouvez retourner à votre espace scolaire.</p>
      <a className="mt-8 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground" href="/">Accéder à LaBorneTRAIT</a>
    </main>
  );
}
