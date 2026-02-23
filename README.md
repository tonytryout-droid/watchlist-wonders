# WatchMarks - Your Personal Watchlist Manager

A Netflix-style watchlist manager built with React, TypeScript, Firebase, and shadcn/ui. Organize movies, series, videos, and content with powerful scheduling, social features, and metadata enrichment.

## 🚀 Features Implemented

### ✅ Phase 1: Core Infrastructure
- **Complete Firebase Database Schema** with Firestore collections
- **Security Rules** for all Firestore collections
- **Firebase Storage** buckets configuration (attachments, avatars, posters)
- **Type-safe database layer** with TypeScript types
- **Service layer architecture** for all major features
- **React Query** integration for data fetching and caching

### ✅ Phase 2: Authentication & User Management
- **Firebase Auth** integration (email/password)
- **Protected routes** with automatic redirects
- **Session persistence** across page reloads
- **Auth context** providing user state throughout the app
- **Sign in, sign up, and sign out** flows
- **User profiles** with automatic creation on signup

### ✅ Phase 3: Bookmark Management (Partial)
- **Dashboard** fetching real data from Firestore
- **Create bookmarks** with full metadata
- **Bookmark grouping** by status (Backlog, Watching, Done)
- **Mood-based organization** with mood tags
- **Loading and error states** for better UX
- **React Query mutations** for optimistic updates

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS
- **Backend**: Firebase (Firestore + Auth + Storage + Hosting + Cloud Functions)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6

### Project Structure
```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── bookmarks/      # Bookmark-specific components
│   ├── layout/         # Layout components (TopNav, HeroBanner)
│   └── search/         # Search components
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state management
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
│   ├── firebase.ts    # Firebase client setup
│   └── utils.ts       # Helper functions
├── pages/              # Page components
│   ├── Auth.tsx       # Authentication page
│   ├── Dashboard.tsx  # Main dashboard
│   ├── NewBookmark.tsx # Create bookmark page
│   └── ...
├── services/           # API service layer
│   ├── auth.ts        # Authentication services
│   ├── bookmarks.ts   # Bookmark CRUD operations
│   ├── schedules.ts   # Schedule management
│   ├── notifications.ts # Notification services
│   └── watchPlans.ts  # Watch plan services
└── types/              # TypeScript type definitions
    └── database.ts    # Application types
    
functions/             # Firebase Cloud Functions
├── src/
│   ├── enrich.ts      # Metadata enrichment function
│   └── index.ts       # Function exports
├── package.json
└── README.md          # Functions documentation
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- A Firebase account (free tier works)
- Google Cloud account (for API keys)

### 1. Clone and Install
```bash
git clone <repository-url>
cd watchlist-wonders
npm install
```

### 2. Set Up Firebase
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Enable Authentication (Email/Password)
4. Set up Storage buckets
5. Deploy Cloud Functions for metadata enrichment

For detailed instructions, see `functions/README.md`

### 3. Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and add your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_ENRICH_URL=https://us-central1-your-project-id.cloudfunctions.net/enrich
VITE_YOUTUBE_API_KEY=optional-for-local-fallback
VITE_TMDB_API_KEY=optional-for-local-fallback
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` and create an account!

## 📊 Database Schema

The Firestore database includes the following main collections:
- **bookmarks** - Core content storage
- **attachments** - File attachments for bookmarks
- **schedules** - One-time and recurring schedules
- **schedule_occurrences** - Generated schedule instances
- **notifications** - User notifications
- **watch_plans** - Watch planning and organization
- **watch_plan_bookmarks** - Junction collection for plans
- **public_profiles** - User profile information
- **user_follows** - Social graph
- **sharing_links** - Public sharing functionality
- **enrich_cache** - URL metadata cache

See service Layer in `src/services/` for collection structure details.

## 🎯 Roadmap

### Phase 3: Complete Bookmark Management
- [ ] Bookmark status transitions (Backlog → Watching → Done)
- [ ] Search and filtering by multiple criteria
- [ ] Attachment upload functionality
- [ ] Bulk actions

### Phase 4: Scheduling System
- [ ] One-time scheduling
- [ ] Recurring schedules (daily, weekly, monthly)
- [ ] Calendar views (month, week, day)
- [ ] Reminder notifications

### Phase 5: Notifications
- [ ] Real-time notification system
- [ ] Notification preferences
- [ ] Push notifications (later)

### Phase 6: Watch Plans
- [ ] Create and manage watch plans
- [ ] Plan suggestions based on mood/time
- [ ] Auto-scheduling from plans

### Phase 7: Metadata Enrichment
- [ ] YouTube Data API integration
- [ ] TMDB API integration
- [ ] Open Graph fallback
- [ ] Enrichment caching

### Phase 8: Social Features
- [ ] Public profiles
- [ ] Follow/unfollow users
- [ ] Share bookmarks and plans
- [ ] Activity feed

### Phase 9: Polish & Performance
- [ ] Error boundaries
- [ ] Optimistic updates
- [ ] Loading skeletons
- [ ] Accessibility improvements
- [ ] Code splitting and lazy loading

## 🔐 Security

- **Firestore Security Rules** enforced on all collections
- **User isolation** - users can only access their own data
- **Secure authentication** via Firebase Auth
- **Storage policies** - files scoped to user folders
- **Type-safe queries** with TypeScript
- **Cloud Functions** with proper CORS and validation

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🤝 Contributing

This is a demonstration project showcasing Firebase integration. Feel free to fork and customize!

## 📄 License

MIT License - feel free to use this project as a starting point for your own applications.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) - Backend as a Service
- [shadcn/ui](https://ui.shadcn.com/) - UI Component Library
- [React Query](https://tanstack.com/query) - Data Fetching & Caching
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

**Note**: This project requires a configured Supabase backend to function. See `supabase/README.md` for setup instructions.
