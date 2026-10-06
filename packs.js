// Fiches de révision prêtes à l'emploi (niveau 3ème). Chargé seulement quand l'étudiant ouvre « Cours de 3ème ».
// Pour ajouter une fiche : copier un bloc L(...) en gardant un identifiant unique.
const L = (id, title, tags, content) => ({ id, title, tags, content: content.trim() });

export const PACKS = [
  {
    id: 'pack3e-maths', name: 'Mathématiques 3ème', color: '#2B5CD6',
    lessons: [
      L('pack3e-maths-01', 'Le théorème de Pythagore', ['géométrie', 'triangle rectangle'], `
# Le théorème de Pythagore
Dans un triangle rectangle, le carré de l’hypoténuse est égal à la somme des carrés des deux autres côtés.
L’hypoténuse est le côté opposé à l’angle droit : c’est le plus long côté.
## Énoncé
Si ABC est rectangle en A, alors BC² = AB² + AC².
## Réciproque
Si BC² = AB² + AC², alors le triangle ABC est rectangle en A.
Pour montrer qu’un triangle n’est pas rectangle, on calcule les deux quantités et on montre qu’elles sont différentes.
## Exemple
AB = 3 cm et AC = 4 cm : BC² = 3² + 4² = 9 + 16 = 25, donc BC = 5 cm.
## À retenir
- L’hypoténuse se calcule avec une somme, un côté de l’angle droit avec une différence : AB² = BC² − AC².
- On écrit toujours d’abord l’égalité de Pythagore, puis on calcule.`),
      L('pack3e-maths-02', 'Le théorème de Thalès', ['géométrie', 'proportions'], `
# Le théorème de Thalès
Il permet de calculer des longueurs quand deux droites parallèles coupent deux droites sécantes.
## Énoncé
Soient (BC) et (MN) parallèles, avec M sur (AB) et N sur (AC). Alors AM/AB = AN/AC = MN/BC.
## Réciproque
Si les rapports AM/AB et AN/AC sont égaux (points alignés dans le même ordre), alors les droites (MN) et (BC) sont parallèles.
## Si les rapports sont différents
Alors les droites ne sont pas parallèles.
## Exemple
AB = 6, AM = 2 et AC = 9. On a AM/AB = AN/AC, donc AN = 9 × 2 / 6 = 3.
## À retenir
- Les longueurs du petit triangle sont au numérateur, celles du grand triangle au dénominateur.
- On écrit l’hypothèse « les droites sont parallèles » avant d’appliquer le théorème.`),
      L('pack3e-maths-03', 'Développer et factoriser', ['calcul littéral', 'identités remarquables'], `
# Développer et factoriser
## Distributivité
k(a + b) = ka + kb
(a + b)(c + d) = ac + ad + bc + bd
## Identités remarquables
- (a + b)² = a² + 2ab + b²
- (a − b)² = a² − 2ab + b²
- (a + b)(a − b) = a² − b²
## Factoriser
Factoriser, c’est transformer une somme en produit.
- Avec un facteur commun : 6x + 9 = 3(2x + 3)
- Avec une identité remarquable : x² − 25 = (x + 5)(x − 5)
## Exemple
(x + 3)² = x² + 6x + 9
## À retenir
- N’oubliez pas le double produit 2ab dans (a ± b)².
- Un produit de facteurs est nul si et seulement si l’un des facteurs est nul.`),
      L('pack3e-maths-04', 'Équations et inéquations du premier degré', ['équations', 'algèbre'], `
# Équations et inéquations du premier degré
## Résoudre une équation
On garde l’égalité en faisant la même opération des deux côtés.
Exemple : 3x + 5 = 20, donc 3x = 15, donc x = 5.
## Équation produit
(x − 2)(x + 4) = 0 donne x − 2 = 0 ou x + 4 = 0, donc x = 2 ou x = −4.
## Inéquations
On résout comme une équation, mais **si on multiplie ou divise par un nombre négatif, on change le sens de l’inégalité**.
Exemple : −2x + 6 > 0 donne −2x > −6, donc x < 3.
## Mettre un problème en équation
1. Choisir l’inconnue.
2. Écrire l’équation avec les données de l’énoncé.
3. Résoudre l’équation.
4. Vérifier, puis répondre par une phrase.`),
      L('pack3e-maths-05', 'Fonctions linéaires et affines', ['fonctions', 'droites'], `
# Fonctions linéaires et affines
## Fonction linéaire
f(x) = ax. Sa représentation graphique est une droite qui passe par l’origine. Le nombre a est le coefficient directeur.
Exemple : f(x) = 3x donne f(2) = 6.
## Fonction affine
f(x) = ax + b. Sa représentation est une droite. Le nombre b est l’ordonnée à l’origine : c’est la valeur de f(0).
## Calculer a
Avec deux points A(x₁ ; y₁) et B(x₂ ; y₂), on a a = (y₂ − y₁) / (x₂ − x₁).
## Exemple
f(1) = 5 et f(3) = 9 : a = (9 − 5) / (3 − 1) = 2. Puis 5 = 2 × 1 + b donne b = 3, donc f(x) = 2x + 3.
## À retenir
- Une situation de proportionnalité correspond à une fonction linéaire.
- Pour tracer une droite, deux points suffisent.`),
      L('pack3e-maths-06', 'Trigonométrie dans le triangle rectangle', ['géométrie', 'cosinus', 'sinus'], `
# Trigonométrie dans le triangle rectangle
Pour un angle aigu, on distingue l’hypoténuse, le côté adjacent à l’angle et le côté opposé à l’angle.
## Formules
- cos = côté adjacent / hypoténuse
- sin = côté opposé / hypoténuse
- tan = côté opposé / côté adjacent
Pour s’en souvenir : **CAH SOH TOA**.
## Utilisation
- Pour calculer une longueur : on écrit le rapport adapté, puis on isole l’inconnue.
- Pour calculer un angle : on utilise les touches cos⁻¹, sin⁻¹ ou tan⁻¹ de la calculatrice.
## Exemple
Avec une hypoténuse de 10 cm et un angle de 30°, le côté opposé vaut 10 × sin 30° = 5 cm.
## À retenir
- La calculatrice doit être en mode degrés.
- Pour un même angle : cos² + sin² = 1.`),
    ],
  },
  {
    id: 'pack3e-pc', name: 'Physique-chimie 3ème', color: '#0E9F8E',
    lessons: [
      L('pack3e-pc-01', 'Tension, intensité et loi d’Ohm', ['électricité', 'formules'], `
# Tension, intensité et loi d’Ohm
## Les grandeurs
- La tension U se mesure en volts (V) avec un voltmètre branché en dérivation.
- L’intensité I se mesure en ampères (A) avec un ampèremètre branché en série.
- La résistance R se mesure en ohms (Ω).
## Loi d’Ohm
Pour un conducteur ohmique : U = R × I.
On en déduit R = U / I et I = U / R.
## Exemple
Une résistance de 20 Ω traversée par un courant de 0,5 A a une tension U = 20 × 0,5 = 10 V.
## Lois des circuits
- En série, l’intensité est la même partout et les tensions s’additionnent.
- En dérivation, la tension est la même aux bornes de chaque branche et les intensités s’additionnent.
## À retenir
La caractéristique tension-intensité d’un conducteur ohmique est une droite qui passe par l’origine.`),
      L('pack3e-pc-02', 'Puissance et énergie électriques', ['électricité', 'énergie'], `
# Puissance et énergie électriques
## Puissance
La puissance P d’un appareil se mesure en watts (W) : P = U × I.
Exemple : un appareil sous 220 V traversé par 2 A a une puissance de 440 W.
## Énergie
L’énergie E consommée dépend de la puissance et de la durée : E = P × t.
- Avec P en watts et t en secondes, E est en joules (J).
- Avec P en kilowatts et t en heures, E est en kilowattheures (kWh).
Exemple : une lampe de 60 W allumée pendant 5 h consomme 0,06 kW × 5 h = 0,3 kWh.
## Sécurité
Un fusible ou un disjoncteur coupe le circuit en cas de surintensité, pour éviter l’échauffement des fils.
## À retenir
- 1 kW = 1 000 W et 1 kWh = 3 600 000 J.
- À durée égale, plus un appareil est puissant, plus il consomme d’énergie.`),
      L('pack3e-pc-03', 'Les atomes et les ions', ['chimie', 'atome', 'ion'], `
# Les atomes et les ions
## L’atome
Un atome est formé d’un noyau chargé positivement et d’électrons chargés négativement qui l’entourent.
Le noyau contient des protons (charge positive) et des neutrons (sans charge).
Un atome est électriquement neutre : il a autant d’électrons que de protons.
## Les ions
Un ion est un atome (ou un groupe d’atomes) qui a gagné ou perdu des électrons.
- Un atome qui perd des électrons devient un ion positif : Na → Na⁺.
- Un atome qui gagne des électrons devient un ion négatif : Cl → Cl⁻.
## Solutions ioniques
Une solution ionique est électriquement neutre. Elle conduit le courant grâce au déplacement des ions.
## Tests d’identification
- Les ions chlorure Cl⁻ donnent un précipité blanc avec le nitrate d’argent.
- Les ions cuivre Cu²⁺ donnent un précipité bleu avec la soude.
- Les ions fer III Fe³⁺ donnent un précipité rouille avec la soude.
## À retenir
Le nombre de protons définit l’élément chimique.`),
      L('pack3e-pc-04', 'Acides, bases et pH', ['chimie', 'pH'], `
# Acides, bases et pH
## Le pH
Le pH mesure l’acidité d’une solution aqueuse. On le mesure avec du papier pH ou un pH-mètre.
- pH inférieur à 7 : solution acide
- pH égal à 7 : solution neutre
- pH supérieur à 7 : solution basique
Exemples : le jus de citron est acide, l’eau pure est neutre, l’eau de Javel est basique.
## Dilution
Diluer une solution acide fait remonter son pH vers 7.
## Les ions
Une solution acide contient des ions hydrogène H⁺. Une solution basique contient des ions hydroxyde HO⁻.
## Acide et métal
Un acide attaque certains métaux (fer, zinc, aluminium) : il se forme du dihydrogène et des ions métalliques.
## Sécurité
Les acides et les bases concentrés sont corrosifs : lunettes, gants et blouse sont obligatoires.`),
      L('pack3e-pc-05', 'Vitesse et mouvement', ['mécanique', 'vitesse'], `
# Vitesse et mouvement
## Vitesse moyenne
v = d / t, avec d la distance parcourue et t la durée.
Exemple : 120 km parcourus en 2 h donnent v = 60 km/h.
## Unités
- La vitesse s’exprime en m/s ou en km/h.
- Pour passer de m/s à km/h, on multiplie par 3,6. Pour passer de km/h à m/s, on divise par 3,6.
Exemple : 36 km/h = 10 m/s.
## Types de mouvement
- Mouvement uniforme : la vitesse reste constante.
- Mouvement accéléré : la vitesse augmente.
- Mouvement ralenti : la vitesse diminue.
## Relativité du mouvement
Un mouvement dépend du référentiel choisi. Un passager assis dans un taxi-brousse est immobile par rapport au véhicule, mais en mouvement par rapport à la route.
## À retenir
t = d / v et d = v × t`),
    ],
  },
  {
    id: 'pack3e-svt', name: 'SVT 3ème', color: '#3E9B4F',
    lessons: [
      L('pack3e-svt-01', 'L’ADN, les gènes et les chromosomes', ['génétique', 'hérédité'], `
# L’ADN, les gènes et les chromosomes
## Où se trouve l’information génétique ?
Dans le noyau de chaque cellule, sous forme de chromosomes. Ils sont constitués d’une très longue molécule : l’ADN.
## Les chromosomes
Chez l’être humain, les cellules du corps contiennent 46 chromosomes, soit 23 paires. Dans chaque paire, un chromosome vient du père et l’autre de la mère.
## Les gènes
Un gène est une portion d’ADN qui détermine un caractère héréditaire, par exemple la couleur des yeux. Les différentes versions d’un gène sont les allèles.
## Le caryotype
C’est la photographie classée des chromosomes d’une cellule. Il permet de déterminer le sexe (XX pour une femme, XY pour un homme) et de repérer certaines anomalies.
## À retenir
- Les cellules du corps (hors gamètes) d’un individu possèdent toutes la même information génétique.
- Les gamètes (ovule et spermatozoïde) n’ont que 23 chromosomes.`),
      L('pack3e-svt-02', 'Mitose, méiose et fécondation', ['génétique', 'reproduction'], `
# Mitose, méiose et fécondation
## La mitose
La mitose est la division d’une cellule en deux cellules filles identiques. Elle permet la croissance et le renouvellement des cellules. Avant la division, l’ADN est copié : c’est la réplication.
## La méiose
La méiose produit les gamètes (ovules et spermatozoïdes). Chaque gamète ne contient que 23 chromosomes, un de chaque paire.
## La fécondation
L’union d’un ovule et d’un spermatozoïde forme une cellule-œuf à 46 chromosomes (23 paires).
## Variabilité génétique
Le hasard de la méiose et celui de la fécondation expliquent que deux frères et sœurs ne sont pas identiques (sauf vrais jumeaux).
## À retenir
- Mitose : 46 → 46 chromosomes, cellules identiques.
- Méiose : 46 → 23 chromosomes, cellules différentes.`),
      L('pack3e-svt-03', 'L’évolution des êtres vivants', ['évolution', 'sélection naturelle'], `
# L’évolution des êtres vivants
## Les espèces changent au cours du temps
Les fossiles montrent que des espèces ont disparu et que d’autres sont apparues.
## La sélection naturelle
Dans une population, les individus présentent des variations héréditaires. Ceux dont les caractères sont mieux adaptés au milieu survivent et se reproduisent davantage : leurs caractères deviennent plus fréquents.
## Les mutations
Une mutation est une modification de l’ADN. Elle apparaît au hasard et peut être sans effet, défavorable ou favorable. Si elle touche un gamète, elle peut être transmise.
## Parenté entre espèces
Des espèces qui partagent des caractères hérités d’un ancêtre commun sont apparentées. L’être humain et le chimpanzé ont un ancêtre commun.
## À retenir
L’évolution résulte de la variation, de la sélection naturelle et de la transmission des caractères.`),
      L('pack3e-svt-04', 'Immunité et vaccination', ['santé', 'immunité'], `
# Immunité et vaccination
## Les microbes
Les bactéries, les virus et certains champignons peuvent provoquer des maladies. La peau et les muqueuses forment une première barrière.
## La réponse immunitaire
Quand un microbe pénètre dans le corps :
- les globules blancs (phagocytes) englobent et détruisent les microbes ;
- les lymphocytes fabriquent des anticorps spécifiques de l’antigène du microbe ;
- des lymphocytes « mémoire » gardent le souvenir de cet antigène.
## La vaccination
Un vaccin contient un microbe inactivé ou une partie de microbe. Il déclenche la fabrication d’anticorps et de cellules mémoire sans provoquer la maladie. Lors d’un vrai contact, la réponse est plus rapide et plus forte.
## Sérum et antibiotiques
- Le sérum apporte des anticorps déjà prêts : action rapide mais temporaire.
- Les antibiotiques tuent les bactéries, mais sont inefficaces contre les virus.
## À retenir
Se faire vacciner protège durablement sa santé et celle des autres.`),
      L('pack3e-svt-05', 'La biodiversité de Madagascar', ['environnement', 'Madagascar'], `
# La biodiversité de Madagascar
## Une île à part
Madagascar est une île isolée depuis des dizaines de millions d’années. Ses espèces ont évolué séparément de celles du continent africain.
## L’endémisme
Une espèce endémique ne vit qu’à un endroit précis du monde. À Madagascar, la grande majorité des espèces de plantes et d’animaux sont endémiques.
- Tous les lémuriens sont endémiques de Madagascar.
- Six espèces de baobabs sur huit dans le monde ne poussent qu’à Madagascar.
## Les menaces
- la déforestation et les feux de brousse (culture sur brûlis, ou tavy) ;
- la chasse et le trafic d’espèces ;
- le changement climatique.
## La protection
Parcs nationaux, réserves, reboisement et gestion des forêts par les communautés locales.
## À retenir
Protéger la biodiversité, c’est protéger les ressources dont dépend la population : eau, sols, bois et tourisme.`),
    ],
  },
  {
    id: 'pack3e-hg', name: 'Histoire-géo 3ème', color: '#F08A24',
    lessons: [
      L('pack3e-hg-01', 'La Première Guerre mondiale (1914-1918)', ['histoire', 'XXe siècle'], `
# La Première Guerre mondiale (1914-1918)
## Les causes
Rivalités entre grandes puissances, course aux armements, système d’alliances (Triple-Entente contre Triple-Alliance) et nationalismes. L’étincelle : l’assassinat de l’archiduc François-Ferdinand à Sarajevo, le 28 juin 1914.
## Une guerre totale
Toute la société est mobilisée : armée, usines, population civile. Les combats sont meurtriers : guerre de tranchées, mitrailleuses, artillerie, gaz de combat, chars.
Des dizaines de milliers de soldats venus des colonies, dont des tirailleurs malgaches, ont combattu en Europe.
## La fin de la guerre
L’armistice est signé le 11 novembre 1918. Le traité de Versailles (28 juin 1919) rend l’Allemagne responsable de la guerre et lui impose des réparations.
## Bilan
Environ 9 à 10 millions de morts parmi les militaires. Quatre empires disparaissent : allemand, austro-hongrois, ottoman et russe.
## Dates à retenir
- 1914 : début de la guerre
- 1917 : révolution russe et entrée en guerre des États-Unis
- 1918 : armistice`),
      L('pack3e-hg-02', 'La Seconde Guerre mondiale (1939-1945)', ['histoire', 'XXe siècle'], `
# La Seconde Guerre mondiale (1939-1945)
## Les origines
La crise économique de 1929, la montée des régimes totalitaires (nazisme en Allemagne, fascisme en Italie) et la politique d’expansion d’Hitler.
## Le déroulement
- 1er septembre 1939 : l’Allemagne envahit la Pologne ; la France et le Royaume-Uni lui déclarent la guerre.
- 1940 : défaite de la France, régime de Vichy, appel du général de Gaulle le 18 juin.
- 1941 : l’Allemagne attaque l’URSS ; le Japon attaque Pearl Harbor et les États-Unis entrent en guerre.
- 6 juin 1944 : débarquement allié en Normandie.
- 8 mai 1945 : capitulation de l’Allemagne.
- Août 1945 : bombes atomiques sur Hiroshima (6 août) et Nagasaki (9 août) ; le Japon capitule le 2 septembre.
## Une guerre d’extermination
Le génocide des Juifs d’Europe (la Shoah) fait environ 6 millions de victimes. D’autres groupes sont aussi persécutés : Tsiganes, opposants politiques.
## Bilan
Plus de 50 millions de morts. L’ONU est créée en 1945.
## Madagascar
En 1942, l’île passe sous contrôle britannique après des combats contre les forces de Vichy, puis elle est remise à la France libre.`),
      L('pack3e-hg-03', 'La guerre froide (1947-1991)', ['histoire', 'monde bipolaire'], `
# La guerre froide (1947-1991)
## Deux blocs
Après 1945, le monde est dominé par deux superpuissances :
- les États-Unis, à la tête du bloc de l’Ouest (capitalisme, démocratie) ;
- l’URSS, à la tête du bloc de l’Est (communisme, parti unique).
La guerre est « froide » parce que les deux puissances ne s’affrontent pas directement : elles se menacent et s’opposent par pays interposés.
## Les grands épisodes
- 1948-1949 : blocus de Berlin
- 1949 : création de l’OTAN ; 1955 : Pacte de Varsovie
- 1950-1953 : guerre de Corée
- 1961 : construction du mur de Berlin
- 1962 : crise des missiles de Cuba
- 1989 : chute du mur de Berlin
- 1991 : disparition de l’URSS
## La course aux armements
Armes nucléaires et course à l’espace : Spoutnik en 1957, premier homme sur la Lune en 1969.
## Le tiers-monde
Les pays qui deviennent indépendants sont courtisés par les deux blocs. En 1955, la conférence de Bandung rassemble des pays d’Asie et d’Afrique qui cherchent une voie indépendante.`),
      L('pack3e-hg-04', 'La décolonisation et l’indépendance de Madagascar', ['histoire', 'décolonisation', 'Madagascar'], `
# La décolonisation
## Définition
La décolonisation est le processus par lequel les colonies deviennent des États indépendants, surtout entre 1945 et 1975.
## Les causes
- l’affaiblissement des puissances européennes après la Seconde Guerre mondiale ;
- le désir de liberté des peuples colonisés et les mouvements nationalistes ;
- la pression de l’ONU, des États-Unis et de l’URSS.
## Deux voies
- La voie pacifique : des négociations, comme pour la plupart des colonies françaises d’Afrique en 1960.
- La voie violente : des guerres d’indépendance, comme en Indochine (1946-1954) et en Algérie (1954-1962).
## Quelques dates
- 1947 : indépendance de l’Inde
- 1955 : conférence de Bandung
- 1960 : « année de l’Afrique », 17 pays africains deviennent indépendants
- 1962 : indépendance de l’Algérie
## Et Madagascar ?
- 29 mars 1947 : début de l’insurrection malgache, durement réprimée.
- 1958 : Madagascar devient une république autonome au sein de la Communauté française.
- 26 juin 1960 : indépendance. Philibert Tsiranana est le premier président.`),
      L('pack3e-hg-05', 'Madagascar au XIXe siècle : du royaume à la colonie', ['histoire', 'Madagascar', 'colonisation'], `
# Madagascar au XIXe siècle
## Le royaume de Madagascar
Au XIXe siècle, le royaume de l’Imerina, dont la capitale est Antananarivo, étend son autorité sur une grande partie de l’île.
- Andrianampoinimerina (vers 1787-1810) réunifie l’Imerina.
- Radama Ier (1810-1828) ouvre le royaume aux influences européennes : traité avec les Britanniques en 1817, arrivée de missionnaires.
- Ranavalona Ire (1828-1861) mène une politique de fermeture aux étrangers.
- Ranavalona II (1868-1883) se convertit au protestantisme en 1869 ; le christianisme devient religion du royaume.
- Ranavalona III (1883-1897) est la dernière reine.
## Vers la colonisation
La France veut contrôler l’île. Une première guerre franco-malgache a lieu en 1883-1885. En 1895, une nouvelle expédition prend Antananarivo (30 septembre).
Le 6 août 1896, Madagascar est déclarée colonie française. Gallieni devient gouverneur général. La monarchie est abolie en 1897 et la reine est exilée.
## La résistance
Des révoltes éclatent contre la présence française, comme celle des Menalamba (1895-1897).
## À retenir
- 1895 : prise d’Antananarivo
- 1896 : Madagascar devient une colonie française
- 1897 : fin de la monarchie`),
    ],
  },
];
