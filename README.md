# AuvergneTech - Application de Gestion Intégrée

Application web complète pour la gestion des techniciens ascensoristes : feuilles d'heures, travaux, parc ascenseurs, stock, véhicules et plus.

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-cyan)

## 📋 Fonctionnalités

### Feuilles d'heures
- ✅ Saisie des horaires par jour (départ, arrivée, pause, fin, retour)
- ✅ Gestion des tâches avec durée et temps de trajet
- ✅ Calcul automatique des heures travaillées, trajets et RTT
- ✅ Gestion des astreintes (samedi, dimanche, nuits)
- ✅ Validation des semaines par le responsable
- ✅ Export PDF/Excel

### Modules (à venir)
- 📅 Planning techniciens
- 🔧 Gestion des travaux
- 🏢 Parc ascenseurs
- 📦 Stock
- 🚗 Véhicules
- 📄 GED (Gestion documentaire)

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou pnpm
- Compte Supabase (gratuit)

### 1. Cloner le projet

```bash
git clone <repository-url>
cd auvergne-tech-app
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer Supabase

1. Créez un projet sur [Supabase](https://supabase.com)
2. Copiez le fichier `.env.example` en `.env`
3. Remplissez les variables avec vos credentials Supabase

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

### 4. Créer la base de données

Exécutez le script SQL dans l'éditeur SQL de Supabase :

```bash
# Le fichier se trouve dans :
supabase/schema.sql
```

### 5. Lancer l'application

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

## 📁 Structure du projet

```
auvergne-tech-app/
├── src/
│   ├── components/
│   │   ├── ui/                 # Composants UI réutilisables
│   │   ├── feuille-heures/     # Composants feuilles d'heures
│   │   └── Layout.tsx          # Layout principal
│   ├── hooks/
│   │   └── useFeuilleHeures.ts # Hooks React Query
│   ├── services/
│   │   ├── supabase.ts         # Client Supabase
│   │   └── api.ts              # Fonctions API
│   ├── stores/
│   │   └── appStore.ts         # Store Zustand
│   ├── types/
│   │   └── index.ts            # Types TypeScript
│   ├── lib/
│   │   └── utils.ts            # Utilitaires
│   ├── styles/
│   │   └── globals.css         # Styles globaux
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── schema.sql              # Schéma base de données
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🗄️ Base de données

### Tables principales

| Table | Description |
|-------|-------------|
| `techniciens` | Profils utilisateurs |
| `semaines` | Semaines de travail |
| `jours` | Jours avec horaires |
| `taches` | Tâches par jour |
| `astreintes` | Astreintes week-end/nuit |
| `ascenseurs` | Parc équipements |

### Sécurité (RLS)

- Les techniciens voient uniquement leurs données
- Les admins/responsables ont accès à tout
- Validation des semaines par les responsables

## 🛠️ Technologies

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State**: Zustand (local), React Query (serveur)
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Icons**: Lucide React
- **Forms**: React Hook Form
- **Dates**: date-fns

## 📱 Responsive

L'application est optimisée pour :
- Desktop (1280px+)
- Tablet (768px+)
- Mobile (à venir)

## 🔐 Authentification

L'authentification Supabase est pré-configurée. Pour l'activer :

1. Activez l'auth dans Supabase Dashboard
2. Configurez les providers (email, Google, etc.)
3. Décommentez le code d'auth dans l'application

## 📈 Roadmap

- [ ] Module Planning complet
- [ ] Module Travaux
- [ ] Module Stock
- [ ] Application mobile (React Native)
- [ ] Notifications push
- [ ] Export PDF des feuilles
- [ ] Synchronisation hors-ligne

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/ma-feature`)
3. Committez vos changements (`git commit -m 'Ajout de ma feature'`)
4. Push sur la branche (`git push origin feature/ma-feature`)
5. Ouvrez une Pull Request

## 📄 Licence

MIT License - Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

Développé avec ❤️ pour Auvergne Ascenseurs
