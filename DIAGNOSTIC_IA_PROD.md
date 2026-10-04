# 🔍 Diagnostic IA en Production - Guide Rapide

## ✅ Phases Complétées

### Phase 1 : Instrumentation
- ✅ **Endpoint debug créé** : `/api/debug/env` (GET/POST)
  - Affiche l'état de `DEEPSEEK_API_KEY` en production
  - Logs détaillés dans Vercel Function Logs
  
- ✅ **Logs ajoutés dans `/api/ai`** :
  - Vérifie si la clé existe au démarrage
  - Logue le statut des appels DeepSeek
  - Capture les erreurs réseau et réponses non-200

## 📋 Prochaines Étapes (À faire maintenant)

### Phase 2 : Redeploy + Vérification (⏭️ MAINTENANT)

1. **Forcer un redeploy dans Vercel** :
   - Allez sur : https://vercel.com/dashboard → [votre projet]
   - Onglet **Deployments**
   - Cliquez sur le déploiement récent > bouton **Redeploy** (3 points)
   - Choisir : "Redeploy" (sans "Use existing build cache")
   - Attendez que le statut passe à "Ready" (vert)

2. **Vérifier la clé API en prod** :
   ```
   GET https://gradeup-trho.vercel.app/api/debug/env
   ```
   Vous devriez voir :
   ```json
   {
     "deepseek": {
       "hasKey": true,           // ← doit être true
       "keyPrefix": "sk-...xxx",
       "isValid": true
     },
     "health": {
       "allCriticalVarsPresent": true,
       "readyToOperate": true
     }
   }
   ```

3. **Vérifier les logs Vercel** :
   - Onglet **Deployments** > cliquez sur "Logs"
   - Cherchez les logs `[AI API] Diagnostic:` 
   - Vérifiez `hasDeepseekKey: true`

### Phase 3 : Tester le Chat (Si Phase 2 OK)

1. **Tester un message IA en production** :
   - Ouvrez l'app en production
   - Allez dans le chat avec l'IA
   - Envoyez un message simple : "Bonjour"
   - Vérifiez que vous recevez une réponse (pas "erreur inconnue")

2. **Vérifier les logs de la réponse** :
   - Vercel > Logs
   - Cherchez `[AI API] Appel DeepSeek API...`
   - Vérifiez le status HTTP (doit être 200)

### Phase 4 : Validation Finale

Si tout fonctionne :
- ✅ Chat IA répond correctement en production
- ✅ Les logs montrent `hasDeepseekKey: true`
- ✅ Status DeepSeek est 200

## 🗑️ Cleanup (Après Validation)

Une fois le chat IA qui fonctionne en production, supprimez :

1. **Endpoint debug temporaire** :
   ```bash
   rm c:/FullAZ/src/app/api/debug/env/route.ts
   ```

2. **Logs diagnostique dans `/api/ai/route.ts`** :
   - Gardez le check `if (!DEEPSEEK_API_KEY)` mais supprimez les `console.log('[AI API] Diagnostic...')`
   - Gardez les logs d'erreur `console.error()` pour debugging futur

3. **Redeploy final** après cleanup

## 🔗 Ressources Rapides

- **Vercel Dashboard** : https://vercel.com/dashboard
- **Logs Vercel** : [Deployments] > [Latest] > Logs
- **Endpoint Test** : `/api/debug/env` (GET)
- **Clé API DeepSeek** : Vérifiez qu'elle commence par `sk-`

## 💡 Diagnostic Rapide : Cas Courants

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `hasKey: false` | Variable non chargée | Redeploy Vercel |
| Status 500 (Clé non configurée) | Variable undefined au runtime | Vérifier env vars Vercel + Redeploy |
| Status 503 (DeepSeek indisponible) | Erreur appel DeepSeek ou clé invalide | Vérifier la clé + tester curl |
| Chat dit "erreur inconnue" | Frontend n'a pas vu la réponse | Vérifier logs Vercel + test `/api/ai` |

## 📝 Notes Importantes

- **Redeploy ≠ git push** : git push déclenche un deploy automatique, mais les env vars Vercel ne sont pas toujours immédiatement syncées. **Redeploy forcé** garantit que les var sont chargées.
- **Les logs disparaissent** : Les logs Vercel sont gardés ~24-48h. Notez les résultats.
- **Pas d'erreur visible** : L'app peut être "prête" sans que la clé soit chargée. C'est un problème silencieux → d'où l'importance des logs.

---

**Statut** : 🟡 En diagnostique - Étapes 1-2 complétées, prêt pour Phase 2 (Redeploy)
