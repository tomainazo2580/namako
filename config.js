// Réglages de Namako. Pour les modifier : sur GitHub, ouvrez ce fichier, touchez le crayon,
// changez les valeurs puis « Commit changes ». Ne changez que ce qui est entre guillemets ou chiffres.

export const APP_BUILD = 4;     // numéro de cette version de l'app (voir version.json)
export const TRIAL_DAYS = 0;    // durée de l'essai gratuit. Mettre 0 pour tester l'écran de verrouillage.

// Clé publique de vérification des codes. Elle vient de la page admin.html (« Créer mes clés »).
// Tant qu'elle vaut null, Namako reste ouvert à tous, sans essai ni verrouillage.
export const PUBLIC_KEY = {"crv":"P-256","ext":true,"key_ops":["verify"],"kty":"EC","x":"wSGh2-TsAeNoVLFP236lgS4yE8y8i5LFFGsVyVeUlC0","y":"0R4b4FhmM1gdZwAY1X8QwpcLT02hvBRqGE9Tro40CcU"};;

// À REMPLACER par vos vrais numéros avant de partager l'app :
export const PRICE_LABEL = 'Prix : à définir (paiement unique, accès à vie)';
export const ADMIN_WHATSAPP = '261343994907';   // votre numéro WhatsApp, format international, sans + ni espaces
export const ADMIN_PHONE = '+261343994907';     // votre numéro pour les SMS
export const PAYMENTS = [
  { name: 'Mvola', number: '034 39 949 07', holder: 'Tiana Stephan' },
  { name: 'Orange Money', number: '032 24 159 98', holder: 'Tiana Stephan' },
  { name: 'Airtel Money', number: '033 16 443 49', holder: 'Tiana Stephan' },
];

// Fichiers rafraîchis lors d'une mise à jour forcée (ne pas modifier)
export const APP_FILES = ['./', 'index.html', 'style.css', 'app.js', 'db.js', 'backup.js', 'review.js', 'config.js', 'codec.js', 'license.js', 'manifest.webmanifest'];
