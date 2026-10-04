import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { generateGLMResponse } from '@/lib/ai/glm-provider';
import { generateOpenRouterResponse } from '@/lib/ai/openrouter-provider';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const maxDuration = 55; // Vercel Pro : 60s max, on laisse 5s de marge

const AI_MODELS: Record<string, string> = {
  glm: 'GLM 4.5 Flash (Zhipu AI)',
  deepseek: 'DeepSeek Chat V3 (OpenRouter)',
  gemma: 'Gemma 3 12B (OpenRouter)',
  llama: 'Llama 3.1 8B (OpenRouter)',
};

// ─── Helpers préférences (stockées en DB, pas en filesystem) ─────────────────

async function loadUserPreferences(userId: string): Promise<Record<string, string>> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { aiPreferences: true },
    });
    if (!user?.aiPreferences) return {};
    return JSON.parse(user.aiPreferences) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveUserPreferences(userId: string, prefs: Record<string, string>): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { aiPreferences: JSON.stringify(prefs) },
    });
  } catch (err) {
    console.error('[AI] Erreur sauvegarde préférences:', err);
  }
}

// ─── Mémoire long terme ────────────────────────────────────────────────────────

async function loadMemories(userId: string): Promise<string[]> {
  try {
    const memories = await db.aiMemory.findMany({
      where: { userId },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
    });
    return memories.map((m) => {
      const tagStr = m.tags ? ` [${m.tags}]` : '';
      return `- ${m.content}${tagStr}`;
    });
  } catch {
    return [];
  }
}

async function saveMemory(userId: string, schoolId: string, content: string): Promise<void> {
  try {
    // Parse tags from content: [TAG: tag1, tag2] prefix
    let tags = '';
    let cleanContent = content;
    const tagMatch = content.match(/^\[TAG:\s*([^\]]+)\]\s*/i);
    if (tagMatch) {
      tags = tagMatch[1].trim();
      cleanContent = content.slice(tagMatch[0].length).trim();
    }
    await db.aiMemory.create({
      data: { userId, schoolId, content: cleanContent.trim(), category: 'fact', tags },
    });
  } catch (err) {
    console.error('[AI] Erreur sauvegarde mémoire:', err);
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  userName: string,
  userRole: string,
  schoolContext: string,
  isFirstMessage: boolean,
  preferencesStr: string,
): string {
  const roleGuidance: Record<string, string> = {
    STUDENT: `
Tu es le tuteur et compagnon IA d'un élève. Aide-le à :
- Comprendre ses performances scolaires (Moyenne générale, appréciations: ≥16 💪 Excellent, ≥14 🌟 Très bien, ≥12 👍 Bien, ≥10 📝 Assez bien, <10 ⚠️ Insuffisant, et s'il progresse).
- Suivre son assiduité et l'alerter s'il dépasse 3 absences.
- Gérer son budget scolaire et paiements (tranches, frais payés/dus).
- Organiser ses devoirs, révisions et son emploi du temps.
- Explorer ses cours grâce à ton mode Tuteur (Mode Explication simple, Mode Quiz/QCM interactif, Mode Dissertation avec plan de rédaction).
- Analyser et synthétiser des documents partagés (résumer, comparer).
- Coaching scolaire (méthodologie de mémorisation, motivation, gestion du stress).`,

    TEACHER: `
Tu es l'assistant pédagogique et administratif d'un professeur. Aide le professeur à :
- Piloter ses classes et créer des groupes de niveau (ex: élèves avec moyenne < 12).
- Gérer les présences (appel intelligent, taux d'absentéisme, élèves en retard).
- Publier des leçons, planifier des devoirs et gérer les notes (appréciations, coefficients, barèmes).
- Préparer ses cours et activités avec différenciation pédagogique.
- Détecter les élèves en difficulté grâce au radar de difficulté (moyenne globale < 12 ou baisse de 3 points) et proposer des plans de rattrapage.
- Analyser les copies d'élèves, rédiger des appréciations de bulletins et générer des rapports.`,

    PARENT: `
Tu es le coach familial et tuteur IA d'un parent d'élève. Aide le parent à :
- Centraliser le suivi familial (moyennes, devoirs, assiduité et paiements de tous les enfants liés).
- Alerter proactivement en cas de retards ou si un enfant dépasse 2 absences injustifiées.
- Gérer le budget scolaire (frais par enfant, échéancier).
- Lier les profils des enfants avec leur code parent (format P-XXXXXX).
- Communiquer avec l'école (préparation des réunions parents-profs, rédaction de questions).
- Coach parental (conseils rassurants, comment réagir face à une mauvaise note).`,

    ADMIN: `
Tu es le conseiller de direction et l'analyste stratégique de l'administration scolaire. Aide l'administrateur à :
- Analyser l'écosystème global en temps réel (KPIs, effectifs, ratios profs/élèves).
- Réaliser un audit financier complet (revenus, prévisions de trésorerie, créances et balances par classe).
- Cartographier la vie scolaire (profils de classes, professeurs absents, derniers inscrits).
- Gérer la conformité et les droits.
- Simuler des scénarios décisionnels.
- Superviser les processus de fin de cycle.

ACTIONNALITÉ — Tu peux EXÉCUTER des actions directement sur la base de données. Quand l'administrateur te demande de créer/modifier/supprimer quelque chose, tu dois RÉPONDRE avec l'action ET le résultat sera exécuté automatiquement.

FORMAT D'ACTION (à inclure dans ta réponse quand tu dois effectuer une action) :
[ACTION: action_name]
[PARAMS: { json des paramètres }]
[/ACTION]

ACTIONS DISPONIBLES :

1. CREATE_CLASSES — Créer une ou plusieurs classes
   [ACTION: create_classes]
   [PARAMS: {"classes": [{"name": "6ème A", "level": "6ème", "fees": 0}, {"name": "5ème A", "level": "5ème", "fees": 0}]}]
   [/ACTION]

2. LIST_CLASSES — Lister les classes existantes
   [ACTION: list_classes]
   [PARAMS: {}]
   [/ACTION]

3. DELETE_CLASS — Supprimer une classe
   [ACTION: delete_class]
   [PARAMS: {"classId": "xxx"}]
   [/ACTION]

4. LIST_COURSES — Lister les cours
   [ACTION: list_courses]
   [PARAMS: {"classId": "xxx"}]
   [/ACTION]

5. CREATE_SCHEDULE — Créer un créneau d'emploi du temps
   [ACTION: create_schedule]
   [PARAMS: {"courseId": "xxx", "dayOfWeek": 1, "startTime": "08:00", "endTime": "09:00", "room": "Salle 1"}]
   [/ACTION]

6. BULK_CREATE_SCHEDULE — Créer plusieurs créneaux
   [ACTION: bulk_create_schedule]
   [PARAMS: {"slots": [{"courseId": "xxx", "dayOfWeek": 1, "startTime": "08:00", "endTime": "09:00", "room": "Salle 1"}]}]
   [/ACTION]

7. UPDATE_SCHEDULE — Modifier un créneau
   [ACTION: update_schedule]
   [PARAMS: {"scheduleId": "xxx", "startTime": "09:00", "endTime": "10:00"}]
   [/ACTION]

8. DELETE_SCHEDULE — Supprimer un créneau
   [ACTION: delete_schedule]
   [PARAMS: {"scheduleId": "xxx"}]
   [/ACTION]

IMPORTANT : Tu peux combiner texte ET action dans ta réponse. L'utilisateur voit d'abord ton texte, puis le résultat de l'action est ajouté automatiquement.
Quand l'administrateur te donne un emploi du temps en image/PDF, analyse-le et crée les créneaux correspondants avec BULK_CREATE_SCHEDULE.
Quand l'administrateur dit "crée X classes de niveau Y", utilise CREATE_CLASSES avec la liste générée.`
  };

  const guidance = roleGuidance[userRole] || roleGuidance.STUDENT;

  let systemPrompt = `Tu es Teno, une intelligence artificielle d'excellence spécialisée en gestion scolaire et pédagogie, créée par TRAIT Fintech. Tu es intégrée à LaBorneTRAIT, une plateforme scolaire premium.

IDENTITÉ :
- Nom : Teno
- Créateur : TRAIT Fintech
- Plateforme : LaBorneTRAIT
- Langue : Français (naturel, professionnel, élégant)

CONTEXTE DE L'UTILISATEUR :
- Nom : ${userName || 'utilisateur'}
- Rôle : ${userRole}
`;

  if (isFirstMessage) {
    systemPrompt += `\nC'est la première interaction. Commence par accueillir chaleureusement ${userName || 'l\'utilisateur'}.\n`;
  }

  if (preferencesStr) {
    systemPrompt += `\nPRÉFÉRENCES DE L'UTILISATEUR À RESPECTER :
${preferencesStr}
(Adapte ton ton selon ces préférences, ex: tutoiement ou vouvoiement.)\n`;
  }

  systemPrompt += `
DIRECTIVES ABSOLUES :
1. Réponds TOUJOURS en français correct, châtié et professionnel. Zéro faute d'orthographe, de grammaire ou de conjugaison.
2. Si l'utilisateur exprime de nouvelles préférences (ex: "Appelle-moi Prof. Diop", "Tutoie-moi"), confirme poliment et ajoute en fin de réponse la balise : \`[PREF: clef=valeur]\`
3. Utilise le contexte scolaire ci-dessous pour fournir des analyses précises. Si une information est manquante, dis-le sans inventer de données.
4. Reste professionnel, proactif et bienveillant.
5. FORMATAGE MATHÉMATIQUE : Pour toutes les formules et expressions mathématiques, utilise UNIQUEMENT des caractères Unicode et du texte courant. N'utilise JAMAIS de syntaxe LaTeX (\\frac, \\sqrt, $...$, etc.) ni de blocs de code. Exemples :
   - Fraction : « a/b » ou « (numérateur)/(dénominateur) »
   - Puissance : x² , x³ , xⁿ
   - Racine : √x, ³√x
   - Opérateurs : × , ÷ , ± , ≠ , ≤ , ≥ , ∑ , π , θ , ∞
   - Équation : « 2x + 3 = 7 » (en texte simple)
6. N'inclus jamais de blocs de code (\`\`\`) pour des explications non-techniques.

TA MISSION POUR LE RÔLE ${userRole} :
${guidance}

CONTEXTE SCOLAIRE EN TEMPS RÉEL :
${schoolContext}

Réponds avec rigueur et bienveillance.`;

  return systemPrompt;
}


// ─── Collecte du contexte scolaire ────────────────────────────────────────────

const schoolContextCache = new Map<string, { expiresAt: number; value: string }>();
const SCHOOL_CONTEXT_TTL_MS = 60_000;

async function buildSchoolContext(
  role: string,
  userId: string,
  schoolId: string,
  userName: string,
  userPreferences: Record<string, string>,
): Promise<string> {
  const key = `${schoolId}:${userId}:${role}`;
  const cached = schoolContextCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await buildSchoolContextUncached(role, userId, schoolId, userName, userPreferences);
  schoolContextCache.set(key, { expiresAt: Date.now() + SCHOOL_CONTEXT_TTL_MS, value });
  return value;
}

async function buildSchoolContextUncached(
  role: string,
  userId: string,
  schoolId: string,
  userName: string,
  userPreferences: Record<string, string>,
): Promise<string> {
  try {
    if (role === 'STUDENT') {
      const [classEnrollment, grades, attendance, payments] = await Promise.all([
        db.enrolledClass.findFirst({ where: { userId }, include: { class: true } }),
        db.grade.findMany({
          where: { schoolId, studentId: userId },
          include: { course: { select: { name: true } }, teacher: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        db.attendance.findMany({ where: { schoolId, studentId: userId }, orderBy: { date: 'desc' } }),
        db.payment.findMany({ where: { schoolId, studentId: userId }, orderBy: { createdAt: 'desc' } }),
      ]);

      const className = classEnrollment?.class?.name || 'Non assignée';
      const classFees = classEnrollment?.class?.fees || 0;
      const average = grades.length > 0 ? grades.reduce((s, g) => s + g.score, 0) / grades.length : null;
      let averageText = 'Pas de note disponible';
      let appreciation = '';
      if (average !== null) {
        averageText = `${average.toFixed(2)}/20`;
        appreciation = average >= 16 ? '💪 Excellent' : average >= 14 ? '🌟 Très bien' : average >= 12 ? '👍 Bien' : average >= 10 ? '📝 Assez bien' : '⚠️ Insuffisant';
        if (grades.length >= 2) {
          const half = Math.ceil(grades.length / 2);
          const avgRecent = grades.slice(0, half).reduce((s, g) => s + g.score, 0) / half;
          const avgOlder = grades.slice(half).reduce((s, g) => s + g.score, 0) / (grades.length - half);
          if (avgRecent > avgOlder) appreciation += ' (En progression 📈)';
        }
      }

      const absences = attendance.filter(a => a.status === 'absent').length;
      const lates = attendance.filter(a => a.status === 'late').length;
      const presents = attendance.filter(a => a.status === 'present').length;
      const presenceRate = attendance.length > 0 ? ((presents / attendance.length) * 100).toFixed(1) : '100';
      const attendanceAlert = absences > 3 ? '⚠️ ALERTE : Plus de 3 absences !' : '';

      const paid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
      const pending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
      const overdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);

      let homeworksText = 'Aucun devoir programmé.';
      if (classEnrollment?.classId) {
        const homeworks = await db.homework.findMany({
          where: { schoolId, course: { classId: classEnrollment.classId } },
          include: { course: true },
          orderBy: { dueDate: 'asc' },
          take: 5,
        });
        if (homeworks.length > 0) {
          homeworksText = homeworks.map(h => `- ${h.title} (${h.course.name}) pour le ${h.dueDate}`).join('\n');
        }
      }

      return `Élève : ${userName} (Classe : ${className})
Performance : Moyenne ${averageText} — ${appreciation}
Notes :
${grades.slice(0, 10).map(g => `  - ${g.course.name} : ${g.score}/${g.maxScore} (T${g.trimester})`).join('\n')}

Assiduité : ${presents} présents, ${absences} absences, ${lates} retards (Taux : ${presenceRate}%). ${attendanceAlert}

Frais de scolarité (${classFees} FCFA/an) :
  - Payé : ${paid} | En attente : ${pending} | En retard : ${overdue}

Devoirs :
${homeworksText}`;

    } else if (role === 'TEACHER') {
      const courses = await db.course.findMany({
        where: { schoolId, teacherId: userId },
        include: { class: true },
      });
      const classIds = [...new Set(courses.map(c => c.classId))];
      const [studentCount, homeworks, teacherGrades] = await Promise.all([
        classIds.length > 0 ? db.enrolledClass.count({ where: { classId: { in: classIds } } }) : Promise.resolve(0),
        db.homework.findMany({ where: { teacherId: userId }, include: { course: true }, orderBy: { dueDate: 'asc' }, take: 5 }),
        db.grade.findMany({ where: { courseId: { in: courses.map(c => c.id) } }, include: { student: true } }),
      ]);

      const studentAverages: Record<string, { name: string; sum: number; count: number; scores: number[] }> = {};
      teacherGrades.forEach(g => {
        if (!studentAverages[g.studentId]) studentAverages[g.studentId] = { name: g.student.fullName, sum: 0, count: 0, scores: [] };
        studentAverages[g.studentId].sum += g.score;
        studentAverages[g.studentId].count += 1;
        studentAverages[g.studentId].scores.push(g.score);
      });

      const difficultyRadar: string[] = [];
      Object.entries(studentAverages).forEach(([, data]) => {
        const avg = data.sum / data.count;
        if (avg < 12) difficultyRadar.push(`- ${data.name} (Moyenne : ${avg.toFixed(2)}/20)`);
      });

      return `Professeur : ${userName}
Classes encadrées :
${courses.map(c => `  - ${c.name} (Classe: ${c.class.name})`).join('\n')}
Total : ${courses.length} cours, ${classIds.length} classes, ${studentCount} élèves.

Devoirs publiés :
${homeworks.map(h => `  - ${h.title} (${h.course.name}) pour le ${h.dueDate}`).join('\n') || 'Aucun'}

Élèves en difficulté (moyenne < 12) :
${difficultyRadar.join('\n') || 'Aucun élève en difficulté.'}`;

    } else if (role === 'PARENT') {
      const children = await db.user.findMany({
        where: { parentId: userId, role: 'STUDENT' },
        include: { classEnrollments: { include: { class: true } } },
      });

      let childrenContext = '';
      for (const child of children) {
        const childClass = child.classEnrollments[0]?.class;
        const className = childClass?.name || 'Non assignée';
        const classFees = childClass?.fees || 0;
        const [childGrades, childAttendance, childPayments] = await Promise.all([
          db.grade.findMany({ where: { studentId: child.id }, orderBy: { createdAt: 'desc' } }),
          db.attendance.findMany({ where: { studentId: child.id } }),
          db.payment.findMany({ where: { studentId: child.id }, orderBy: { createdAt: 'desc' } }),
        ]);
        const avg = childGrades.length > 0
          ? (childGrades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0) / childGrades.length).toFixed(2)
          : 'N/A';
        const absences = childAttendance.filter(a => a.status === 'absent').length;
        const unjustifiedAbsences = childAttendance.filter(a => a.status === 'absent' && (!a.reason || a.reason.length === 0)).length;
        const paidAmount = childPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
        const pendingAmount = childPayments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
        const overdueAmount = childPayments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
        const balance = Math.max(0, classFees - paidAmount);

        childrenContext += `🧒 ${child.fullName} (Classe : ${className})\n`;
        childrenContext += `   Moyenne générale : ${avg}/20\n`;
        childrenContext += `   Absences : ${absences} total (${unjustifiedAbsences} non justifiées)\n`;
        childrenContext += `   Frais annuels : ${classFees} FCFA — Payé : ${paidAmount} FCFA — En attente : ${pendingAmount} FCFA — En retard : ${overdueAmount} FCFA — Solde dû : ${balance} FCFA\n`;
        if (childPayments.length > 0) {
          childrenContext += `   Derniers paiements :\n`;
          childPayments.slice(0, 3).forEach(p => {
            childrenContext += `     - ${p.amount} FCFA (${p.status}) — ${p.month || 'N/A'} — Mode : ${p.method}\n`;
          });
        }
        if (unjustifiedAbsences > 2) childrenContext += `   ⚠️ ALERTE ASSIDUITÉ : ${child.fullName} a ${unjustifiedAbsences} absences non justifiées !\n`;
        if (overdueAmount > 0) childrenContext += `   ⚠️ ALERTE PAIEMENT : ${overdueAmount} FCFA en retard de paiement !\n`;
        childrenContext += '\n';
      }

      return `Parent : ${userName}\nSuivi de la fratrie :\n${childrenContext || 'Aucun enfant lié pour le moment.'}`;



    } else if (role === 'ADMIN') {
      const [studentCount, teacherCount, parentCount, classCount, courseCount, paymentStats, pendingPayments, overduePayments] = await Promise.all([
        db.user.count({ where: { schoolId, role: 'STUDENT' } }),
        db.user.count({ where: { schoolId, role: 'TEACHER' } }),
        db.user.count({ where: { schoolId, role: 'PARENT' } }),
        db.schoolClass.count({ where: { schoolId } }),
        db.course.count({ where: { schoolId } }),
        db.payment.aggregate({ where: { schoolId }, _sum: { amount: true } }),
        db.payment.count({ where: { schoolId, status: 'pending' } }),
        db.payment.count({ where: { schoolId, status: 'overdue' } }),
      ]);

      const totalRevenue = paymentStats._sum?.amount || 0;
      const classes = await db.schoolClass.findMany({
        where: { schoolId },
        include: { _count: { select: { enrollments: true, courses: true } } },
        orderBy: { name: 'asc' },
      });

      const courses = await db.course.findMany({
        where: { schoolId },
        include: {
          class: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
          _count: { select: { lessons: true, grades: true } },
        },
        orderBy: { name: 'asc' },
      });

      const schedules = await db.courseSchedule.findMany({
        where: { schoolId },
        include: {
          course: {
            select: { name: true, class: { select: { name: true } }, teacher: { select: { fullName: true } } },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });

      const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

      return `Administrateur : ${userName}
📊 Écosystème : ${studentCount} élèves | ${teacherCount} profs | ${parentCount} parents | ${classCount} classes | ${courseCount} cours
Ratio : ${(studentCount / (teacherCount || 1)).toFixed(1)} élèves/prof

💰 Trésorerie :
  - Revenus collectés : ${totalRevenue} FCFA
  - Factures en attente : ${pendingPayments}
  - Factures en retard : ${overduePayments}

🏫 Classes (${classes.length}) :
${classes.map(c => `  - ${c.name} (${c.level}) : ${c._count.enrollments} élèves, ${c._count.courses} cours`).join('\n') || '  Aucune classe'}

📚 Cours (${courses.length}) :
${courses.map(c => `  - ${c.name} → ${c.class?.name || '?'} — Prof: ${c.teacher?.fullName || 'Non assigné'}`).join('\n') || '  Aucun cours'}

🗓️ Emploi du temps (${schedules.length} créneaux) :
${schedules.map(s => `  - ${DAYS[s.dayOfWeek] || '?'} ${s.startTime}-${s.endTime} : ${s.course?.name || '?'} (${s.course?.class?.name || '?'}) — ${s.course?.teacher?.fullName || '?'} — Salle: ${s.room || 'N/A'}`).join('\n') || '  Aucun créneau'}`;
    }
  } catch (err) {
    console.error('[AI] Erreur construction contexte DB:', err);
  }
  return 'Contexte scolaire non disponible.';
}

// ─── Route POST principale ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let auth;
  try { auth = authenticateRequest(request); } catch (error) {
    if (error instanceof AuthError) return new Response(JSON.stringify({ error: error.message }), { status: error.status, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'Non authentifié.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  let body: { message?: string; schoolId?: string; userId?: string; context?: string; conversationId?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Corps de requête JSON invalide.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { message, conversationId, model: requestedModel } = body;
  const schoolId = auth.schoolId;
  const userId = auth.userId;

  if (!message || !schoolId || !userId) {
    return new Response(
      JSON.stringify({ error: 'Champs requis manquants : message, schoolId, userId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let aiResponse: Response;
  let conversationIdFinal = '';
  let encoder: TextEncoder;
  let userPreferences: Record<string, string> = {};

  try {
  // ─── Charger ou créer la conversation ───────────────────────────────────────
  let conversation;
  if (conversationId) {
    conversation = await db.aiConversation.findFirst({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 }, documents: true },
    });
  }
  if (!conversation) {
    conversation = await db.aiConversation.create({
      data: { userId, title: 'Nouvelle conversation', salutationDone: false, model: requestedModel || 'glm' },
      include: { messages: true, documents: true },
    });
  }

  // Use conversation's stored model if no new model requested
  const activeModel = requestedModel || conversation.model || 'glm';

  // ─── Charger l'utilisateur et ses préférences (depuis DB, pas filesystem) ───
  const [user, prefs] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { fullName: true, role: true } }),
    loadUserPreferences(userId),
  ]);
  userPreferences = prefs;

  const role = user?.role || 'STUDENT';
  const userName = user?.fullName || 'utilisateur';

  const preferencesStr = Object.entries(userPreferences)
    .map(([k, v]) => `- ${k} : ${v}`)
    .join('\n');

  // ─── Construire le contexte scolaire ────────────────────────────────────────
  const [schoolContext, memories] = await Promise.all([
    buildSchoolContext(role, userId, schoolId, userName, userPreferences),
    loadMemories(userId),
  ]);

  // ─── Ajouter les documents partagés ─────────────────────────────────────────
  let fullContext = schoolContext;
  if (conversation.documents.length > 0) {
    fullContext += `\n\n📎 DOCUMENTS PARTAGÉS :\n`;
    conversation.documents.slice(-3).forEach((doc) => {
    fullContext += `\n[Fichier: ${doc.name}]\n${doc.extractedText?.slice(0, 1500) || ''}\n`;
    });
  }

  const historyMessages = conversation.messages.slice(-6).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content.slice(0, 3000),
  }));

  const isFirstMessage = !conversation.salutationDone;
  let systemPrompt = buildSystemPrompt(userName, role, fullContext, isFirstMessage, preferencesStr);

  // ─── Mémoire long terme de l'utilisateur ─────────────────────────────────────
  if (memories.length > 0) {
    systemPrompt += `\n\nMÉMOIRE À LONG TERME (informations clés à garder en mémoire sur l'utilisateur et son contexte) :
${memories.join('\n')}

Si l'utilisateur partage une information durable et importante à retenir, tu peux la sauvegarder en finissant ta réponse par la balise : \`[MEM: texte à mémoriser]\`.
Tu peux ajouter des tags optionnels : \`[MEM: [TAG: categorie1, categorie2] texte à mémoriser]\`.`;
  }

  // ─── Enregistrer le message utilisateur ─────────────────────────────────────
  await db.aiMessage.create({
    data: { conversationId: conversation.id, role: 'user', content: message },
  });

  if (isFirstMessage) {
    await db.aiConversation.update({
      where: { id: conversation.id },
      data: { salutationDone: true },
    });
  }

  if (conversation.messages.length === 0) {
    const title = message.length > 40 ? message.slice(0, 40) + '…' : message;
    await db.aiConversation.update({ where: { id: conversation.id }, data: { title } });
  }

  conversationIdFinal = conversation.id;
  encoder = new TextEncoder();

  // ─── Appel IA (multi-provider) ─────────────────────────────────────────────
  try {
    const aiInput = {
      message,
      schoolContext: fullContext,
      userName,
      userRole: role,
      historyMessages,
      systemPrompt,
    };

    if (activeModel === 'glm') {
      aiResponse = await generateGLMResponse(aiInput);
    } else {
      // OpenRouter models: deepseek, gemma, llama
      const orModelMap: Record<string, string> = {
        deepseek: 'deepseek/deepseek-chat-v3-0324:free',
        gemma: 'google/gemma-3-12b-it:free',
        llama: 'meta-llama/llama-3.1-8b-instruct:free',
      };
      // Override OpenRouter env model for this request
      const originalModel = process.env.OR_MODEL;
      if (orModelMap[activeModel]) {
        process.env.OR_MODEL = orModelMap[activeModel];
      }
      try {
        aiResponse = await generateOpenRouterResponse(aiInput);
      } finally {
        // Restore original model
        if (originalModel !== undefined) {
          process.env.OR_MODEL = originalModel;
        } else {
          delete process.env.OR_MODEL;
        }
      }
    }
  } catch (err) {
    console.error('[AI] Échec de l\'appel IA:', err);
    const errMsg = err instanceof Error ? err.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: `L'IA est temporairement indisponible (${activeModel}). Détails : ${errMsg}` }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text().catch(() => '');
    console.error('[AI] Réponse erreur IA:', aiResponse.status, errorText.slice(0, 300));
    return new Response(
      JSON.stringify({ error: 'Le service IA est temporairement indisponible. Réessayez dans quelques instants.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  } catch (err) {
    console.error('[AI] Erreur non gérée:', err);
    const errMsg = err instanceof Error ? err.message : 'Erreur inconnue du serveur';
    return new Response(
      JSON.stringify({ error: `L'IA est temporairement indisponible. Détails : ${errMsg}` }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ─── Streaming de la réponse vers le client ──────────────────────────────────
  let fullReply = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let pendingSse = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          pendingSse += decoder.decode(value, { stream: true });
          const lines = pendingSse.split('\n');
          pendingSse = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim().startsWith('data:')) continue;
            const data = line.replace(/^data:\s*/, '').trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                fullReply += token;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token, conversationId: conversationIdFinal })}\n\n`),
                );
              }
            } catch {
              // Chunk SSE invalide, on ignore
            }
          }
        }

        const trailingChunk = decoder.decode();
        if (trailingChunk) pendingSse += trailingChunk;
      } finally {
        reader.releaseLock();

        if (fullReply) {
          // Détecter et sauvegarder les préférences
          const prefRegex = /\[PREF:\s*([^=]+)\s*=\s*([^\]]+)\]/gi;
          let match;
          const newPrefs = { ...userPreferences };
          let prefChanged = false;
          while ((match = prefRegex.exec(fullReply)) !== null) {
            newPrefs[match[1].trim()] = match[2].trim();
            prefChanged = true;
          }
          if (prefChanged) await saveUserPreferences(userId, newPrefs);

          // Détecter et sauvegarder les souvenirs long terme
          const memRegex = /\[MEM:\s*([^\]]+)\]/gi;
          let memMatch;
          const memsToSave: string[] = [];
          while ((memMatch = memRegex.exec(fullReply)) !== null) {
            memsToSave.push(memMatch[1].trim());
          }
          for (const mem of memsToSave) {
            await saveMemory(userId, schoolId, mem);
          }

          // ─── Détecter et exécuter les actions IA ──────────────────────────
          const actionRegex = /\[ACTION:\s*(\w+)\]\s*\[PARAMS:\s*(\{[^}]+\})\]\s*\[\/ACTION\]/gi;
          let actionMatch;
          const actionResults: Array<{ action: string; result: unknown; error?: string }> = [];
          while ((actionMatch = actionRegex.exec(fullReply)) !== null) {
            const actionName = actionMatch[1];
            try {
              const actionParams = JSON.parse(actionMatch[2]);
              try {
                const actionRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/actions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: actionName, params: actionParams, userId, schoolId }),
                });
                const actionData = await actionRes.json();
                actionResults.push({ action: actionName, result: actionData.result, error: actionData.error });
              } catch (err) {
                actionResults.push({ action: actionName, result: null, error: err instanceof Error ? err.message : 'Erreur exécution' });
              }
            } catch {
              actionResults.push({ action: actionName, result: null, error: 'JSON invalide dans les paramètres' });
            }
          }

          // Send action results as SSE events
          if (actionResults.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ actions: actionResults, conversationId: conversationIdFinal })}\n\n`),
            );
          }

          const cleanReply = fullReply
            .replace(/\[PREF:\s*[^\]]+\]/gi, '')
            .replace(/\[MEM:\s*[^\]]+\]/gi, '')
            .replace(/\[ACTION:\s*\w+\]\s*\[PARAMS:\s*\{[^}]*\}\]\s*\[\/ACTION\]/gi, '')
            .trim();
          await db.aiMessage.create({ data: { conversationId: conversationIdFinal, role: 'assistant', content: cleanReply } });
          await db.aiConversation.update({ where: { id: conversationIdFinal }, data: { updatedAt: new Date() } });
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: conversationIdFinal })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Conversation-Id': conversationIdFinal,
    },
  });
}
