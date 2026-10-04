
RÈGLE 0 - CE QUI DOIT DISPARAÎTRE
SUPPRIME tout fichier/composant avec demo, Demo, DEMO, mockData, MOCK
Page Login/Register: 0 compte démo. Vérifie src/app/page.tsx et src/components/auth/*
Dashboard StatCard: SUPPRIME prop trend, percentage, growth. Affiche seulement chiffre réel de /api/stats
Si tu vois (5%) ou +5% dans un composant, SUPPRIME-LE immédiatement
RÈGLE 1 - FORMULAIRES ENRICHIS OBLIGATOIRES
Dans POST /api/auth/register et POST /api/users, ajoute validation Zod:

gender: z.enum(["M","F"]) REQUIRED
dateOfBirth: z.coerce.date() REQUIRED pour STUDENT/TEACHER
Pour STUDENT: classId REQUIRED, matricule auto-généré MAT-${new Date().getFullYear()}-${Math.floor(1000+Math.random()*9000)}
Pour TEACHER: specialty REQUIRED, phone REQUIRED
Frontend: RadioGroup M/F obligatoire, pas de valeur par défaut. Si gender manquant, form ne submit pas.

RÈGLE 2 - BULLETIN = PRIORITÉ 1
Modèle Prisma Bulletin existe déjà dans README V3. Tu dois:

Ajouter champ titulaireId dans SchoolClass
Créer model Bulletin avec status enum
Implémenter 5 routes: /generate, /validate-titulaire, /validate-admin, /publish, /[id]/pdf
Workflow: DRAFT -> VALIDATED_TITULAIRE (seul titulaire de la classe peut) -> VALIDATED_ADMIN (seul admin) -> PUBLISHED (admin, notifie élève+parent via notification + realtime)
Page élève: si bulletin PUBLISHED, affiche carte avec moyenne/rang + page détail + bouton PDF
Page parent: même chose
PDF: utilise jspdf, affiche nom, matricule, classe, sexe M/F, tableau notes (matière, note, max, commentaire), moyenne, rang, mention, appréciation, signatures
RÈGLE 3 - BOUTONS PUBLIER PARFAITS
Bibliothèque Publier Maintenant: POST /api/resources avec isPublished:true, file upload Supabase via /api/resources/upload, description auto GLM si vide, invalidateQueries
Prof Publier Leçon: POST /api/lessons avec isPublished:true, contentMdx via @mdxeditor/editor, files upload, visible élève immédiatement
PHASES V3 - ORDRE STRICT
PHASE 1: Fondation + Suppression démo + Prisma V3 avec Gender + Bulletin + titulaireId + npx prisma db push + Auth register enrichi
PHASE 2: Admin - création élève/prof avec gender/specialty/matricule + dashboard sans % + assignation titulaire classe
PHASE 3: Teacher - publier leçon parfaite + saisie notes
PHASE 4: Bulletin - génération + double validation + publication + notif realtime
PHASE 5: Student/Parent - voir bulletin publié + PDF + bibliothèque publier maintenant
PHASE 6: Reste (visio, IA, etc.) + npm run build

Tu commences PHASE 1 maintenant. Tu ne passes à phase suivante que si build OK et checklist V3 cochée.

