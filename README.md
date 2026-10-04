

0. INSTRUCTIONS ABSOLUES POUR L'IA - LIS ÇA EN PREMIER
Tu dois implémenter exactement ce fichier. Si tu triches, le projet est raté.

INTERDICTIONS V3 - CE QUI DOIT DISPARAÎTRE DÉFINITIVEMENT
COMPTES DE DÉMO INTERDITS : Supprime TOUT : bouton "Se connecter en tant qu'Admin démo", "Compte Élève test", liste demoUsers, demoCredentials, DEMO_ACCOUNTS, MOCK_USERS. Page Login/Register doit être 100% vide, juste 2 inputs email/password + code école. Aucune donnée pré-remplie.
POURCENTAGES FAKE INTERDITS : Dans TOUS les tableaux de bord (Admin, Prof, Élève, Parent), il est INTERDIT d'afficher des petits pourcentages sous les vrais chiffres du genre +5%, -2%, (5%), ↑ 12% vs mois dernier. Les cartes stats affichent UNIQUEMENT : Icône + Titre + VRAI CHIFFRE venant de /api/stats. Rien d'autre.
BOUTONS MORTS INTERDITS : Les boutons Publier Maintenant (Bibliothèque) et Publier Leçon (Professeur) doivent être 100% fonctionnels avec upload réel vers Supabase, validation Zod, toast et invalidation. Pas de console.log.
RÈGLE D'OR BOUTON
Chaque bouton = useMutation + loading spinner + toast success/error + queryClient.invalidateQueries(). Pas d'exception.

1. CORRECTIONS MAJEURES V3 DEMANDÉES PAR LE CLIENT
A. Suppression Totale Démo
Fichiers à supprimer/vérifier: src/components/demo-accounts.tsx, src/lib/demo-data.ts, toute constante DEMO_
Login: email, password, bouton Se connecter. C'est tout.
Register: nom, email, password, code d'invitation école, rôle. Pas de bouton "Remplir avec compte test".
B. Formulaires d'Inscription Enrichis (OBLIGATOIRE)
Tout élève qui rejoint l'école (par code ou créé par Admin) DOIT avoir ces champs obligatoires. Si un seul manque, c'est un bug.

Champs User communs (tous rôles):

name: string, min 3
email: email unique
password: min 8
gender: enum M | F - OBLIGATOIRE - Select Radio avec M / F, pas de Autre par défaut
dateOfBirth: date, obligatoire pour Élève/Prof
phone: string, optionnel mais présent dans le form
address: string, optionnel
Champs spécifiques Élève (STUDENT):

classId: select des classes de l'école - OBLIGATOIRE
gender: M/F - OBLIGATOIRE
matricule: auto-généré MAT-{YEAR}-{RANDOM 4 chiffres} côté serveur, affiché en lecture seule
dateOfBirth: OBLIGATOIRE
parentPhone: téléphone parent
Champs spécifiques Professeur (TEACHER):

gender: M/F - OBLIGATOIRE
specialty: ex: "Mathématiques", "Français" - OBLIGATOIRE
qualification: ex: "Licence", "Master" - optionnel
phone: OBLIGATOIRE
Où ça doit être:

Formulaire Admin + Nouvel Élève / + Nouveau Prof : doit contenir TOUS ces champs
Formulaire Inscription par code école (quand un user s'inscrit lui-même avec inviteCode) : après avoir validé le code, le formulaire doit demander gender, dateOfBirth, classId si STUDENT, specialty si TEACHER. Pas juste email/password.
C. Tableaux de Bord Sans Pourcentages Fake
AVANT (INTERDIT):

Total Élèves
124
+5% vs mois dernier
MAINTENANT (OBLIGATOIRE V3):

Total Élèves
124 élèves inscrits
[icône Users]
Données viennent de GET /api/stats uniquement. Aucun calcul fake de croissance.

2. MODÈLE DE DONNÉES PRISMA V3 - AVEC SEXE ET BULLETIN
prisma
enum Gender { M F }
enum Role { ADMIN TEACHER STUDENT PARENT }
enum BulletinStatus { DRAFT PENDING_TITULAIRE VALIDATED_TITULAIRE PENDING_ADMIN VALIDATED_ADMIN PUBLISHED }

model School {
  id String @id @default(cuid())
  name String
  email String
  inviteCode String @unique
  currency String @default("USD")
  users User[]
  classes SchoolClass[]
  years SchoolYear[]
  bulletins Bulletin[]
}

model User {
  id String @id @default(cuid())
  email String @unique
  password String
  name String
  role Role
  gender Gender // <-- NOUVEAU OBLIGATOIRE
  dateOfBirth DateTime? // obligatoire pour STUDENT/TEACHER
  phone String?
  address String?
  schoolId String
  school School @relation(fields: [schoolId], references: [id])
  isActive Boolean @default(true)
  avatarUrl String?
  
  // STUDENT
  matricule String? @unique // MAT-2024-XXXX
  classId String?
  class SchoolClass? @relation(fields: [classId], references: [id])
  parentCode String? @unique
  parentPhone String?
  parentId String?
  parent User? @relation("ParentChildren", fields: [parentId], references: [id])
  children User[] @relation("ParentChildren")
  
  // TEACHER
  specialty String? // ex: Math
  qualification String?
  // titulaire de classes
  titulaireClasses SchoolClass[] @relation("Titulaire")

  grades Grade[]
  attendances Attendance[]
  payments Payment[]
  bulletins Bulletin[] // bulletins de l'élève
  validatedBulletinsAsTitulaire Bulletin[] @relation("TitulaireValidator")
  validatedBulletinsAsAdmin Bulletin[] @relation("AdminValidator")
  createdAt DateTime @default(now())
}

model SchoolClass {
  id String @id @default(cuid())
  name String
  level Level
  fees Float
  schoolId String
  school School @relation(fields: [schoolId], references: [id])
  students User[]
  courses Course[]
  titulaireId String? // <-- PROF TITULAIRE
  titulaire User? @relation("Titulaire", fields: [titulaireId], references: [id])
  bulletins Bulletin[]
}

model Bulletin {
  id String @id @default(cuid())
  studentId String
  student User @relation(fields: [studentId], references: [id])
  classId String
  class SchoolClass @relation(fields: [classId], references: [id])
  schoolId String
  school School @relation(fields: [schoolId], references: [id])
  term Int // 1,2,3
  academicYear String // "2024-2025"
  average Float // moyenne générale calculée
  rank Int? // rang dans classe
  mention String? // Passable, Assez Bien...
  appreciation String? @db.Text // appréciation générale
  gradesSnapshot Json // snapshot de toutes les notes du trimestre [{course, score, max, comment}]
  attendanceSummary Json // {present: 45, absent: 2, late: 1}
  status BulletinStatus @default(DRAFT)
  validatedByTitulaireId String?
  validatedByTitulaire User? @relation("TitulaireValidator", fields: [validatedByTitulaireId], references: [id])
  validatedByAdminId String?
  validatedByAdmin User? @relation("AdminValidator", fields: [validatedByAdminId], references: [id])
  validatedAt DateTime?
  publishedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([studentId, term, academicYear])
}

// ... Garde tous les autres modèles Course, Lesson, Grade, etc. de la V2
model Course { id String @id @default(cuid()) title String description String classId String class SchoolClass @relation(fields: [classId], references: [id]) teacherId String teacher User @relation(fields: [teacherId], references: [id]) lessons Lesson[] grades Grade[] }
model Lesson { id String @id @default(cuid()) title String contentMdx String @db.Text courseId String course Course @relation(fields: [courseId], references: [id]) files String[] isPublished Boolean @default(false) publishedAt DateTime? createdAt DateTime @default(now()) }
model Grade { id String @id @default(cuid()) studentId String student User @relation(fields: [studentId], references: [id]) courseId String course Course @relation(fields: [courseId], references: [id]) term Int score Float maxScore Float @default(20) comment String? createdAt DateTime @default(now()) @@unique([studentId, courseId, term]) }
model Ressource { id String @id @default(cuid()) title String description String? fileUrl String? externalLink String? subject String level String category String visibility String authorId String classId String? isPublished Boolean @default(false) createdAt DateTime @default(now()) }
3. SYSTÈME BULLETIN - WORKFLOW COMPLET DOUBLE VALIDATION (PRIORITAIRE)
C'est la fonctionnalité la plus importante de la V3. Elle doit être parfaite, sans erreur.

Logique Métier:

Génération DRAFT: Quand le prof titulaire clique Générer Bulletins T1 dans sa classe.
POST /api/bulletins/generate { classId, term }
Pour chaque élève de la classe, calcule moyenne via AverageService, rang, mention, snapshot notes, résumé présence.
Crée Bulletin avec status=DRAFT
Validation Titulaire: Interface Prof Titulaire (seul le titulaireId de la classe peut).
Page Mes Classes > [Classe] > Bulletins T1
Tableau avec liste bulletins DRAFT. Bouton Valider comme Titulaire par bulletin ou Valider Tout
PUT /api/bulletins/[id]/validate-titulaire -> vérifie session.user.id == class.titulaireId, sinon 403. Passe status à VALIDATED_TITULAIRE
Validation Admin: Interface Admin Bulletins à Valider
GET /api/bulletins?status=VALIDATED_TITULAIRE
Admin voit bulletin complet avec notes, appréciation. Peut modifier appreciation. Bouton Valider comme Admin
PUT /api/bulletins/[id]/validate-admin -> status VALIDATED_ADMIN
Publication: Admin uniquement. Bouton Publier Bulletin ou Publier Tous les Bulletins Validés
PUT /api/bulletins/[id]/publish -> status PUBLISHED, publishedAt=now()
Effet immédiat:
Crée Notification pour élève et ses parents: "Votre bulletin T1 est disponible"
Broadcast Supabase Realtime bulletin-published-{schoolId}
Bulletin devient visible instantanément pour Élève et Parent
Consultation Élève/Parent:
Élève: Dashboard a une carte Bulletin T1 - Publié - Moy: 14.2 - Rang: 3. Clic -> page bulletin complète avec tableau matières, moyennes, appréciations, rang, mention, graphique.
Parent: Même chose, sélecteur enfant si plusieurs. Bouton Télécharger PDF -> génère PDF avec jspdf (en-tête école, infos élève avec sexe M/F, tableau notes, moyenne, rang, appréciations, signatures "Titulaire" et "Admin", cachet).
Si bulletin pas encore PUBLISHED, message clair: "Bulletin en cours de validation par le titulaire" ou "par l'administration". Pas de 404.
Permissions strictes:

Générer: ADMIN ou titulaire de la classe
Valider titulaire: uniquement class.titulaireId
Valider admin: uniquement ADMIN
Publier: uniquement ADMIN
Voir: élève propriétaire + ses parents + ADMIN + titulaire de sa classe
4. CORRECTION BOUTONS PUBLIER - DOIVENT ÊTRE PARFAITS
A. Bibliothèque Numérique - Bouton Publier Maintenant
Où: library-page.tsx -> Dialog Nouvelle Ressource
Champs obligatoires Zod:

title (min 3)
description (min 10) - si vide, appelle GLM pour auto-générer
subject (Math, Français...)
level (Maternelle, Primaire...)
category (Cours, Exercice, Exam, Vidéo...)
type: file ou link - radio
Si file: upload vers /api/resources/upload -> Supabase Storage, retourne fileUrl
Si link: externalLink URL valide
visibility: PUBLIC/SCHOOL/CLASS/PRIVATE
Si CLASS: classId obligatoire
Action bouton Publier Maintenant:

tsx
POST /api/resources { title, description, fileUrl, externalLink, subject, level, category, visibility, classId, isPublished: true }
Loading spinner
Success: toast "Ressource publiée", invalidateQueries(['resources']), dialog se ferme, ressource apparaît immédiatement dans catalogue
Error: toast avec message Zod
B. Professeur - Bouton Publier Leçon
Où: teacher-lessons.tsx -> Nouvelle Leçon
Champs:

title, courseId (select cours du prof), contentMdx (MDX Editor obligatoire, pas textarea), files[] (upload multiple vers Supabase)
Bouton Publier:

POST /api/lessons { title, contentMdx, courseId, files, isPublished: true }
Après publish, leçon visible immédiatement côté élève dans Mes Leçons. Si isPublished=false, brouillon uniquement prof.
Bouton Publier Notes (si existe): Quand prof saisit notes, bouton Publier les notes du T1 -> rend notes visibles pour élèves/parents + déclenche possibilité génération bulletin.

5. TABLEAUX DE BORD CORRIGÉS - SANS POURCENTAGES
Composant StatCard V3 OBLIGATOIRE:

tsx
// INTERDIT: { trend: "+5%" } { subtext: "(5%)" }
// OBLIGATOIRE:
<Card>
  <CardHeader><Users className="text-blue-600" /><CardTitle>Total Élèves</CardTitle></CardHeader>
  <CardContent><div className="text-3xl font-bold">{data.totalStudents}</div><p className="text-sm text-muted-foreground">{data.totalStudents} inscrits</p></CardContent>
</Card>
Admin: 4 cartes: Élèves, Profs, Classes, Paiements en attente - chiffres réels
Teacher: Mes Cours, Mes Élèves, Leçons publiées, Devoirs à corriger
Student: Ma Moyenne Générale (anneau SVG), Matières, Absences, Prochain devoir
Parent: Moyenne enfant, Rang, Absences, Statut paiement
6. FORMULAIRES INSCRIPTION V3 - DÉTAIL TECHNIQUE
Validation Zod V3:

ts
const studentSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  gender: z.enum(["M", "F"], { required_error: "Sexe obligatoire" }),
  dateOfBirth: z.coerce.date(),
  classId: z.string().cuid(),
  phone: z.string().optional(),
  parentPhone: z.string().optional(),
  inviteCode: z.string().min(6)
})

const teacherSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  gender: z.enum(["M", "F"]),
  dateOfBirth: z.coerce.date(),
  specialty: z.string().min(2, "Spécialité obligatoire"),
  phone: z.string().min(8),
  inviteCode: z.string().min(6)
})
UI: Pour gender, utiliser RadioGroup shadcn:

tsx
<RadioGroup><RadioGroupItem value="M" /> Masculin <RadioGroupItem value="F" /> Féminin</RadioGroup>
Backend: Dans POST /api/auth/register et POST /api/users, vérifier gender existe, sinon 400. Générer matricule automatiquement pour STUDENT.

7. API ROUTES V3 MISES À JOUR
Ajoute ces routes au contrat V2:

POST /api/bulletins/generate - body { classId, term } - ADMIN ou titulaire
GET /api/bulletins?classId=&term=&status=&studentId= - filtré par permission
GET /api/bulletins/[id] - détail complet avec gradesSnapshot
PUT /api/bulletins/[id]/validate-titulaire - titulaire only
PUT /api/bulletins/[id]/validate-admin - admin only + peut edit appreciation
PUT /api/bulletins/[id]/publish - admin only
GET /api/bulletins/[id]/pdf - génère PDF avec jspdf
GET /api/classes/[id]/titulaire - pour assigner titulaire
Modifie:

POST /api/auth/register - doit accepter gender, dateOfBirth, classId, specialty, phone
POST /api/users - idem + génération matricule
8. CHECKLIST VALIDATION FINALE V3 - À COCHER PAR L'IA
Avant de dire "c'est fini", l'IA doit vérifier:

 Page Login: aucun compte démo visible, juste email/password
 Page Register: formulaire demande gender M/F, date naissance, classe si élève, spécialité si prof
 Admin crée élève: formulaire contient gender M/F, date naissance, classe, matricule auto-généré, tout enregistré en DB
 Admin crée prof: formulaire contient gender M/F, spécialité, téléphone, enregistré
 Élève s'inscrit avec code école: on lui demande gender + classe + date naissance, pas juste email
 Dashboards: aucune carte n'affiche "(5%)" ou "+5%". Juste vrai chiffre
 Bibliothèque: bouton Publier Maintenant upload un vrai fichier vers Supabase et la ressource apparaît dans le catalogue pour tous
 Prof publie leçon: leçon avec MDX + fichier, visible immédiatement côté élève
 Bulletin: titulaire génère DRAFT -> valide -> admin valide -> publie. Élève voit bulletin instantanément, parent aussi. PDF téléchargeable sans erreur, avec sexe M/F affiché, moyenne, rang, mention.
 npm run build passe sans erreur
Si un seul point fail, corrige.

Fin Cahier V3 FINAL. Code maintenant. Pas d'excuse. Pas de démo. Pas de pourcentage fake. Bulletin parfait.

