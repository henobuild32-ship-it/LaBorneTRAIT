# Moteur académique GradeUp

`src/lib/academic-grading-engine.ts` est la source unique des primitives de calcul. Les données persistées doivent toujours conserver la valeur originale et son maximum; un pourcentage est une valeur dérivée.

## Règles

- Pourcentage: `points obtenus / points maximum * 100`.
- Moyenne pondérée: `somme(valeur * coefficient) / somme(coefficients)`.
- Les maxima et coefficients sont des paramètres de l'établissement, jamais des constantes universelles.
- Une note absente (`MISSING`, `ABSENT`, `EXCUSED`) n'est pas transformée en zéro. Elle est exclue du résultat tant qu'aucune valeur n'est saisie.
- `PRESENT` exige une valeur comprise entre zéro et le maximum. Un maximum nul, `NaN` ou infini est rejeté.
- `EXEMPTED` et `CANCELLED` sont exclus des agrégations.
- Les égalités de classement reçoivent le même rang; l'identifiant est seulement un départage stable pour l'ordre d'affichage.

Les périodes, profils (`PRIMARY`, `HUMANITIES`, etc.), types d'évaluation et règles de décision doivent rester configurables dans les données de l'école. Le moteur ne déduit aucune règle officielle universelle pour la RDC.

## Intégration

Les API serveur doivent valider les entrées avec `validateGrade`, calculer avec `calculateSubjectResult` puis `calculatePeriodResult`/`calculateAnnualResult`, et transmettre les résultats à l'UI et aux bulletins sans recalcul local.
