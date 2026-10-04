import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité | LaBorneTRAIT',
  description: 'Découvrez comment LaBorneTRAIT protège les données des écoles, élèves, parents et enseignants.',
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <nav aria-label="Fil d’Ariane" className="text-sm text-muted-foreground">Accueil / Confidentialité</nav>
      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p>LaBorneTRAIT utilise les données nécessaires à la gestion scolaire, aux notes, aux présences, aux bulletins et aux notifications.</p>
      <h2 className="text-xl font-semibold">Vos droits</h2>
      <p>Vous pouvez demander l’accès, la correction ou la suppression de vos données auprès de l’administration de votre établissement.</p>
      <h2 className="text-xl font-semibold">Sécurité</h2>
      <p>Les sessions sont protégées par des cookies HTTP-only et les accès sont contrôlés selon le rôle de l’utilisateur.</p>
    </main>
  );
}
