import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ | LaBorneTRAIT',
  description: 'Réponses aux questions fréquentes sur LaBorneTRAIT, le mode hors ligne et les notifications.',
};

const questions = [
  ['LaBorneTRAIT fonctionne-t-il hors connexion ?', 'Oui, les données déjà chargées et certaines saisies sont disponibles hors connexion. Elles sont synchronisées au retour du réseau.'],
  ['Les notes sont-elles synchronisées avec les bulletins ?', 'Oui. Les notes du cahier et les notes saisies par les enseignants alimentent la même chaîne de calcul.'],
  ['Pourquoi certaines actions nécessitent-elles Internet ?', 'Les paiements, la première connexion et les validations administratives doivent être confirmés par le serveur.'],
  ['Comment recevoir les notifications ?', 'Autorisez les notifications dans votre navigateur ou votre appareil, puis installez LaBorneTRAIT comme application.'],
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <nav aria-label="Fil d’Ariane" className="text-sm text-muted-foreground">Accueil / FAQ</nav>
      <h1 className="text-3xl font-bold">Questions fréquentes</h1>
      <div className="space-y-4">
        {questions.map(([question, answer]) => (
          <details key={question} className="rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold">{question}</summary>
            <p className="mt-3 text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
