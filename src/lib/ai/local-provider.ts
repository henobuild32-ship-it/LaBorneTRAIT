interface LocalProviderInput {
  message: string;
  schoolContext: string;
  userName: string;
  userRole: string;
  historyMessages: { role: string; content: string }[];
}

function extractData(context: string) {
  const r: Record<string, string> = {};
  const g = (re: RegExp) => { const m = context.match(re); return m ? m[1].trim() : ''; };

  r.average = g(/Moyenne\s*:\s*([\d.]+)/);
  const ns = context.match(/Notes?\s*:[\s\S]*?(?=\n(?:Présences|Paiements|Professeur|Administrateur|Documents|Total|$))/i);
  if (ns) r.gradesSection = ns[0].slice(0, 500);
  const abs = context.match(/(\d+)\s*absents?/i);
  if (abs) r.absences = abs[1];
  const pres = context.match(/(\d+)\s*présents?/i);
  if (pres) r.presents = pres[1];
  r.paidAmount = g(/([\d\s,.]+)\s*(?:payés|payé)/i);
  r.pendingAmount = g(/([\d\s,.]+)\s*(?:en attente|impayé)/i);
  r.students = g(/Élèves?\s*:\s*(\d+)/i);
  r.teachers = g(/Professeurs?\s*:\s*(\d+)/i);
  r.parents = g(/Parents?\s*:\s*(\d+)/i);
  r.classes = g(/Classes?\s*:\s*(\d+)/i);
  r.courses = g(/Cours?\s*:\s*(\d+)/i);
  r.pendingUsers = g(/en attente d'activation\s*:\s*(\d+)/i);

  const rev = context.match(/(?:Revenus?\s*totaux?\s*:\s*|CA\s*:\s*|Revenu\s*:)\s*([\d\s,.]+)/i);
  if (rev) r.revenue = rev[1].trim();

  const grLines = context.match(/\s*-\s*.+:\s*\d+\/\d+.*/g);
  if (grLines) r.gradeLines = grLines.slice(0, 5).join('\n');

  return r;
}

function generateResponse(input: LocalProviderInput): string {
  const { message, schoolContext, userName, userRole } = input;
  const msg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const data = extractData(schoolContext);
  const name = userName?.split(' ')[0] || '';

  if (/bonjour|salut|hello|hey|coucou|cc/.test(msg)) {
    const extras = [
      ' Que souhaitez-vous savoir ?',
      ' Comment puis-je vous aider aujourd\'hui ?',
      ' Je suis là pour vous assister. Posez-moi une question sur les notes, absences, paiements...',
    ];
    return `Bonjour ${name} ! 👋 Je suis Teno, votre assistante scolaire.${extras[Math.floor(Math.random() * extras.length)]}`;
  }

  if (/merci|thanks|merci bcp/.test(msg)) {
    const remerciements = [
      `De rien ${name} ! 😊 N'hésitez pas si vous avez d'autres questions.`,
      `Avec plaisir ${name} ! Je reste à votre disposition.`,
      `Je vous en prie ${name} ! C'est un plaisir de vous aider.`,
    ];
    return remerciements[Math.floor(Math.random() * remerciements.length)];
  }

  if (/au revoir|bye|a plus|a bientot/.test(msg)) {
    return `Au revoir ${name} ! 👋 Passez une excellente journée. Revenez quand vous voulez.`;
  }

  if (/moyenne|note|notes|bullet|classement|evaluation|evaluation|resultat|resultat|tresstre|trimestre|semestre/.test(msg)) {
    if (data.average) {
      const avg = parseFloat(data.average);
      const appreciation = avg >= 16 ? '💪 Excellent' : avg >= 14 ? '🌟 Très bien' : avg >= 12 ? '👍 Bien' : avg >= 10 ? '📝 Assez bien' : '⚠️ Insuffisant';
      let resp = `**Moyenne : ${data.average}/20** (${appreciation})\n\n`;
      if (data.gradeLines) resp += `Dernières notes :\n${data.gradeLines}\n\n`;
      resp += `👉 Consultez la section "Suivi scolaire" pour le détail complet.`;
      return resp;
    }
    if (data.gradeLines) {
      return `Voici vos dernières évaluations :\n${data.gradeLines}\n\n👉 Rendez-vous dans "Notes" pour tout voir.`;
    }
    return `Je n'ai pas de notes à afficher. Vérifiez que vous êtes connecté avec le bon compte ou consultez la rubrique "Suivi scolaire".`;
  }

  if (/absence|present|retard|assiduite|assiduite|presence|presence|rate|manque/.test(msg)) {
    const parts: string[] = [];
    if (data.presents) parts.push(`${data.presents} présences`);
    if (data.absences) parts.push(`${data.absences} absences`);
    if (parts.length > 0) {
      let resp = `📅 **Assiduité :** ${parts.join(', ')}.`;
      if (data.absences && parseInt(data.absences) > 2) {
        resp += '\n\n⚠️ Le nombre d\'absences est élevé. Contactez l\'administration si besoin.';
      }
      return resp;
    }
    return `Consultez la rubrique "Assiduité" dans votre tableau de bord pour voir les détails de présence.`;
  }

  if (/paiement|payer|paye|paye|facture|frais|scolarite|scolarite|ecolage|dette|tranche|versement|montant/.test(msg)) {
    if (data.paidAmount && data.pendingAmount) {
      return `💰 **Paiements :**\n- Payé : **${data.paidAmount} FCFA**\n- En attente : **${data.pendingAmount} FCFA**\n\n👉 Effectuez vos paiements dans la section "Paiements".`;
    }
    if (data.paidAmount) {
      return `💰 Montant total payé : **${data.paidAmount} FCFA**. Voir le détail dans "Paiements".`;
    }
    return `Je n'ai pas d'information sur les paiements ici. Vérifiez la rubrique "Paiements".`;
  }

  if (/parent|code.*parrain|ajouter.*enfant|lier|mes enfants|mon enfant|suivi.*enfant|code.*parent/.test(msg)) {
    return `👨‍👩‍👧‍👦 **Fonctionnalités Parents :**
      
Depuis votre tableau de bord parent, vous pouvez :
• **Ajouter un enfant** avec son code de parrainage unique (format: P-XXXXXX) en cliquant sur "Ajouter un enfant"
• **Basculer** entre vos enfants pour voir notes, absences et paiements
• **Contrôler** chaque enfant individuellement
• Voir les **notifications** de l'école

🔑 Le code de parrainage est disponible dans le tableau de bord de votre enfant, section "Code Parent".

Si vous avez déjà le code, cliquez sur "Ajouter un enfant" et saisissez-le !`;
  }

  if (/admin|ecole|classe|cours|prof|enseignant|enseignant|effectif|revenu|chiffre|statistique|tableau.*bord|dashboard/i.test(msg) && /ecole|classe|cours|prof|enseignant|effectif|revenu|statistique|admin/i.test(msg)) {
    const parts: string[] = [];
    if (data.students) parts.push(`👨‍🎓 **${data.students} élèves**`);
    if (data.teachers) parts.push(`👨‍🏫 **${data.teachers} professeurs**`);
    if (data.parents) parts.push(`👪 **${data.parents} parents**`);
    if (data.classes) parts.push(`🏫 **${data.classes} classes**`);
    if (data.courses) parts.push(`📚 **${data.courses} cours**`);
    if (data.revenue) parts.push(`💰 Revenus : **${data.revenue} FCFA**`);
    if (data.pendingUsers) parts.push(`⏳ **${data.pendingUsers} utilisateur(s) en attente**`);
    if (parts.length > 0) {
      return `📊 **Vue d'ensemble :**\n\n${parts.join('\n')}\n\n👉 Utilisez le tableau de bord administrateur pour des analyses détaillées.`;
    }
    return `Je n'ai pas assez de données sur l'école dans ce contexte.`;
  }

  if (/notification|notif|message|messagerie|chat|discussion/.test(msg)) {
    return `🔔 **Notifications et Messages :**

• **Notifications :** Vous recevez des alertes pour les notes, absences, paiements et communications de l'école
• **Messagerie :** Échangez directement avec les professeurs et l'administration
• **Notifications push :** Activez-les pour être informé en temps réel

👉 Accédez-y depuis la barre latérale ou le tableau de bord.`;
  }

  if (/profil|photo|avatar|mot de passe|mdp|compte|modifier.*profil/.test(msg)) {
    return `👤 **Votre profil :**

Vous pouvez modifier vos informations personnelles, votre photo et votre mot de passe depuis la section "Profil" dans le menu latéral.

Les administrateurs peuvent aussi gérer les profils depuis le panneau d'administration.`;
  }

  if (/calendrier|calendar|emploi.*temps|evenement|evenement|conference|reunion/.test(msg)) {
    return `📅 **Calendrier scolaire :**

Consultez le calendrier pour voir :
• Les événements à venir
• Les conférences et réunions
• Les vacances et jours fériés
• L'emploi du temps

👉 Rendez-vous dans la section "Calendrier".`;
  }

  if (/devoir|homework|exercice|a faire|travail.*rendre|dm|devoir.*maison/.test(msg)) {
    return `📚 **Devoirs :**

Pour voir les devoirs à rendre et les exercices, consultez la rubrique "Devoirs" dans votre tableau de bord.

Vous y trouverez les dates de remise et les détails de chaque travail.`;
  }

  if (/cours|lesson|lecon|cours.*suivre|matiere|matiere|programme/.test(msg)) {
    const courseCount = data.courses || 'plusieurs';
    return `📖 **Cours :**

Vous avez accès à ${courseCount} cours. Chaque cours contient des leçons, des devoirs et des évaluations.

👉 Consultez la section "Cours" pour voir le programme détaillé.`;
  }

  if (/fonctionnalite|fonctionnalite|peux-tu|que peut|capacite|ce que tu|que faire|aide|help|comment utiliser/.test(msg)) {
    return `🤖 **Ce que je peux faire :**

✅ Consulter les **notes** et moyennes
✅ Suivre les **absences** et présences
✅ Voir les **paiements** et factures
✅ Gérer les **enfants** via codes de parrainage (parents)
✅ Vue d'ensemble de l'**école** (administrateurs)
✅ Vous guider dans les **fonctionnalités**

Posez-moi une question précise !`;
  }

  if (/qui.*tu|presente|present.*toi|cree|developpe/.test(msg)) {
    return `🤖 Je suis **Teno**, l'assistante IA de **LaBorneTRAIT**, la plateforme de gestion scolaire moderne.

J'ai été créée par **TRAIT Fintech**.

Mon rôle est de vous aider à suivre la scolarité, consulter les notes, gérer les absences, les paiements et bien plus encore. Je parle français et je suis là pour vous accompagner !`;
  }

  const defaultResponses = [
    `Je n'ai pas bien compris. Voici ce que je peux faire :\n\n📊 **Notes** | 📅 **Absences** | 💰 **Paiements**\n👨‍👩‍👧‍👦 **Enfants** (parents) | 🏫 **École** (admin)\n🔔 **Notifications** | 📚 **Cours** | 📖 **Devoirs**\n\nSur quel sujet portait votre question ?`,
    `Pouvez-vous reformuler ? Je peux vous aider sur les notes, absences, paiements, enfants, cours et plus.`,
    `Désolé, je n'ai pas saisi. Essayez de demander : "Quelles sont mes notes ?", "Mes absences", "Mes paiements" ou "Aide".`,
  ];

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

export async function generateLocalResponse(input: LocalProviderInput): Promise<string> {
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
  return generateResponse(input);
}
