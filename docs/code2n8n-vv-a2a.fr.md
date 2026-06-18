# Code2n8n V&V — Directive A2A (les consommateurs IA lisent ceci en premier)

> 🌐 **Langues** : [English](code2n8n-vv-a2a.md) · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · **Français** · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> La version anglaise est la source faisant foi ; les traductions sont des copies de commodité synchronisées à chaque release.

> 🤖 **Audience** : ce document s'adresse aux **agents IA** (Claude Code / Codex / Antigravity / tout LLM) exécutant des flux Code2n8n. Les relecteurs humains liront [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) à la place.
>
> Traiter les règles ci-dessous comme des directives obligatoires, pas des conseils.

---

## Quand la directive s'active

Vous **DEVEZ** appliquer cette directive dès que l'un des cas suivants est vrai dans le flux Code2n8n en cours :

- Vous êtes sur le point d'écrire les mots « validé » / « vérifié » / « testé » / « prêt pour la production » / « production-ready » / « X/X ok » / « tout passe » / « validated » / « tested » dans toute sortie (commit message, notes de release, README, sticky note, CHANGELOG, réponse à l'utilisateur).
- Vous êtes sur le point de recommander qu'un cas d'étude soit publié, mergé, déployé, activé, ou importé en n8n de production.
- Une instruction utilisateur présuppose implicitement la validation (ex. « lance le workflow », « déploie ça », « mets en prod »).

Si l'un est vrai → la directive est active. Aucun contournement.

---

## La gate (deux couches)

Chaque cas d'étude possède **deux** couches de validation. Les deux doivent passer avant de pouvoir utiliser un vocabulaire de validation.

### Couche 1 — Structurel / import-time

Trois commandes. Toutes à exécuter. Capturer chaque sortie verbatim.

```
# 1. Parse JSON
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Scanner de sécurité déterministe
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. Round-trip REST n8n (nécessite N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Critères de passage Couche 1** (les trois requis) :
- Chaque workflow JSON parse sans exception.
- `security-scan.mjs` rapporte `0 error`. Les warnings ne sont permis que si chacun a un paragraphe explicatif dans le `README.md` du cas ET dans `SECURITY-REVIEW.md` justifiant son non-traitement.
- `live-roundtrip.mjs` rapporte `X/X ok` (X = nombre de fichiers scannés).

**Couche 1 est nécessaire, pas suffisante.** Vous ne **POUVEZ PAS** utiliser un vocabulaire de validation après seulement Couche 1.

### Couche 2 — Compilation / runtime / cohérence cross-document

Couche 2 obligatoire si le cas inclut l'un de :
- Wrapper service / SDK / dépendance externe (tout `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`)
- Un nœud workflow dont le comportement runtime n'est pas visible depuis le JSON seul (HTTP avec branchement sur status, Wait + resume, Schedule avec sémantique timezone, Email avec pièce jointe binaire)
- Une affirmation dans le README du cas qui promet un comportement observable (notifications, écritures d'audit log, exécution planifiée, handover inter-systèmes)

#### Couche 2.A — Réalité des dépendances

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**Critères** :
- `npm install` exit 0 (pas d'`ETARGET`, pas de `--force`).
- `npm audit` rapporte `0 vulnerabilities` au niveau high+.
- `tsc --noEmit` exit 0.

Si l'un échoue, vous **DEVEZ** le corriger avant d'aller plus loin. Vous **NE DEVEZ PAS** revendiquer la validation tant qu'un de ces points est rouge.

#### Couche 2.B — Frontière de confiance runtime

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**Critères** :
- `/healthz` retourne 200 avec le corps JSON attendu.
- Requête non authentifiée vers endpoint protégé → 401 (pas 200, pas 500).
- Requête authentifiée vers le même endpoint → 200 ou le statut documenté spécifique (400 / 502 pour erreurs amont).

Plus au moins **trois tests négatifs** :
- Corps trop grand → 413 attendu.
- Payload prototype-pollution (ex. `op: "__proto__"`) → 400 attendu.
- Valeur d'enum inconnue (ex. `provider: "fake-provider"`) → 400 attendu, sans détail interne dans le corps.

#### Couche 2.C — Contrat runtime du workflow

Pour chaque workflow JSON, inspecter la **configuration de nœud réelle** (pas seulement la sticky note) :

| Motif | Configuration requise |
| --- | --- |
| Nœud HTTP suivi d'un IF basé sur status | `options.response.response.fullResponse = true` ET `neverError = true` |
| Nœud Wait avec resume webhook | La sticky / Code node utilise `$execution.resumeUrl` (PAS `$resumeUrl`) |
| Trigger Schedule | `settings.timezone` défini sur une tz non-UTC (ex. `Europe/Paris`) ET arithmétique de dates en Code node via `new Intl.DateTimeFormat('en-CA', { timeZone })` (PAS `new Date().toISOString().slice(0,10)`) |
| Entrée Webhook | `responseMode = "responseNode"` ET un nœud `respondToWebhook` à schéma fixe (PAS `responseMode = "lastNode"`) |
| Nœud Email avec pièce jointe | Un nœud `n8n-nodes-base.convertToFile` juste avant, ET les `attachments` du nœud Email référencent la propriété binaire produite (par défaut `data`) |
| Nœud dead-letter / notification | Le nœud a au moins une arête entrante dans `connections{}`. Ouvrir le JSON ; ne pas se fier à la sticky note. |

Toute violation est un bloqueur de release.

#### Couche 2.D — Parité cross-document

Pour chaque affirmation du `README.md` du cas, localiser le fichier:ligne qui l'implémente. Si l'implémentation n'existe pas, l'affirmation est un bug de doc — corriger la doc ou l'implémentation avant de revendiquer la validation. Exemples :

- « dead-letter Slack » → chercher le nœud Slack, confirmer une arête entrante depuis la branche `Exhausted? = true`.
- « porte d'approbation humaine » → confirmer Wait + resume + IF Approved? + écritures d'audit pour les deux branches.
- « audit row » → confirmer l'existence du nœud d'écriture Sheet / DB, le mapping de colonnes complet, et la présence dans le graphe de connexions.
- « email résumé finance » → confirmer l'existence du nœud Email, sa connexion, le placeholder de destinataire dans le tableau de placeholders.

---

## Schéma de sortie OBLIGATOIRE après exécution de la gate

Après Couche 1 + Couche 2, votre sortie (vers utilisateur, commit, release notes, ou autre IA) DOIT inclure une section au format exact suivant :

```
## V&V evidence — gate v1 (this AI ran the gate)

### Layer 1 (structural)
- JSON parse: PASS / FAIL (N files)
- security-scan.mjs: <count> error / <count> warning  (warnings explained: yes / no)
- live-roundtrip.mjs: <X>/<Y> ok  (tag: <tag>)

### Layer 2 (runtime)
- npm install: PASS / FAIL  (`<one-line summary>`)
- npm audit (high+): PASS / FAIL  (<count> vulnerabilities)
- tsc --noEmit: PASS / FAIL  (<count> errors)
- /healthz 200: PASS / FAIL
- Unauthenticated /v1/* → 401: PASS / FAIL
- Negative test 1 (body limit): PASS / FAIL
- Negative test 2 (prototype dispatch): PASS / FAIL
- Negative test 3 (unknown enum): PASS / FAIL
- Workflow runtime contract (per-pattern): PASS / FAIL  (link to row)
- Cross-document parity: PASS / FAIL  (claims checked: N)
- End-to-end runtime smoke: PASS / PENDING / FAIL  (tracked-as: <version>)
```

Toute ligne FAIL ou PENDING → l'expression de validation correspondante est **interdite** dans la suite de la sortie.

---

## Phrases interdites

Vous **NE DEVEZ PAS** émettre les éléments suivants tant que la ligne d'evidence correspondante n'est pas PASS :

| Phrase interdite | Evidence requise |
| --- | --- |
| « validé » / « vérifié » / « validated » | Toutes les lignes Couche 1 + Couche 2 PASS, OU chaque PENDING explicitement nommé dans le même paragraphe |
| « testé » / « tested » | Au moins Couche 2.B PASS |
| « X/X ok » / « tout passe » | Préciser quelle gate (ex. « Couche 1 X/X ok ») — jamais sans qualifier |
| « prêt pour la production » / « production-ready » | Couche 1 + Couche 2 + smoke end-to-end + décision SECURITY-REVIEW = PASS ou CONDITIONAL |
| « ça devrait marcher » / « ça a l'air bon » | Interdit dans tout contexte de validation — remplacer par evidence spécifique |

Substituts obligatoires :

| Substitut | Quand |
| --- | --- |
| « Validation structurelle PASS ; validation runtime PENDING » | Couche 1 faite, Couche 2 non faite |
| « Couche 1 + Couche 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md) » | Les deux couches faites |
| « Import propre ; activation requiert X » | Workflow JSON valide, runtime non testé |
| « Cas de référence ; déploiement production nécessite les contrôles SECURITY-REVIEW §<n> » | Cas livré mais non production-ready |

---

## Comportement quand la gate ne peut être exécutée intégralement

Si l'environnement ne permet pas réellement la Couche 2 (`N8N_API_URL` / `N8N_API_KEY` non définis, pas d'accès réseau au registry npm, pas de service à démarrer), vous **DEVEZ** :

1. Émettre le schéma evidence en marquant les lignes indisponibles `SKIPPED (reason: <reason>)`.
2. Dire explicitement à l'utilisateur / IA appelante : « Couche 2 non exécutée car <reason>. L'affirmation de validation est impossible tant que Couche 2 n'est pas exécutée. »
3. Refuser d'émettre toute phrase interdite.

Exécuter partiellement et silencieusement est le mode d'échec que cette directive empêche. Annoncer haut et fort tout skip.

---

## Hook de relecture adversariale

Pour chaque cas d'étude livré comme le **premier** Code2n8n d'un nouveau SDK / système externe, vous **DEVEZ** inviter au moins une IA indépendante (modèle au choix de l'utilisateur) à effectuer une relecture adversariale **après** votre propre gate. La sortie de cette relecture rejoint le `SECURITY-REVIEW.md` du cas aux côtés de vos propres findings. **La relecture indépendante fait partie de la gate**, pas un commentaire optionnel.

Raison : la gate ci-dessus attrape les échecs structurels et runtime déterministes, mais une IA fraîche sans biais préalable attrape des échecs au niveau design et documentation auxquels l'IA implémentatrice (vous) est statistiquement aveugle. La transition Pack v0.27.0 → v0.28.0 existe parce que ce hook n'était pas forcé.

---

## Pourquoi la directive est écrite ainsi

- **Déclencheurs déterministes** (pas « usez du jugement ») pour qu'une IA ne puisse pas raisonner pour contourner la gate.
- **Invocations d'outils exactes** (pas « vérifier les dépendances ») pour que différentes IA convergent vers la même evidence.
- **Schéma de sortie obligatoire** (pas « résumer ») pour que les IA / humains en aval puissent vérifier mécaniquement que la gate a tourné.
- **Phrases interdites listées** pour qu'une IA ne puisse pas glisser une affirmation de validation par un tour de phrase.
- **Comportement de skip explicite** pour qu'une exécution partielle ne se fasse pas passer pour complète.

Voici à quoi ressemble une interface A2A pour un Pack dont les consommateurs sont des agents IA, pas des humains. Si vous êtes une IA lisant ceci et vous ne pouvez pas ou ne voulez pas suivre la directive, vous **DEVEZ** le déclarer à l'utilisateur avant de continuer le flux Code2n8n.

---

## Artefacts liés

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — version humaine
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — la skill security applique cette directive
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — le cas d'étude qui a fait naître cette directive
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — ce qui s'est passé quand la directive manquait
