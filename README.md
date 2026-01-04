# WatchMarks - Your Personal Watchlist Manager

A Netflix-style watchlist manager built with React, TypeScript, Supabase, and shadcn/ui. Organize movies, series, videos, and content with powerful scheduling, social features, and metadata enrichment.

## 🚀 Features Implemented

### ✅ Phase 1: Core Infrastructure
- **Complete Supabase Database Schema** with 13+ tables
- **Row Level Security (RLS)** policies for all tables
- **Storage buckets** configuration (attachments, avatars, posters)
- **Type-safe database layer** with generated TypeScript types
- **Service layer architecture** for all major features
- **React Query** integration for data fetching and caching

### ✅ Phase 2: Authentication & User Management
- **Supabase Auth** integration (email/password)
- **Protected routes** with automatic redirects
- **Session persistence** across page reloads
- **Auth context** providing user state throughout the app
- **Sign in, sign up, and sign out** flows
- **User profiles** with automatic creation on signup

### ✅ Phase 3: Bookmark Management (Partial)
- **Dashboard** fetching real data from Supabase
- **Create bookmarks** with full metadata
- **Bookmark grouping** by status (Backlog, Watching, Done)
- **Mood-based organization** with mood tags
- **Loading and error states** for better UX
- **React Query mutations** for optimistic updates

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
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
│   ├── supabase.ts    # Supabase client setup
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
    ├── database.ts    # Application types
    └── supabase.ts    # Generated Supabase types
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- A Supabase account (free tier works)

### 1. Clone and Install
```bash
git clone <repository-url>
cd watchlist-wonders
npm install
```

### 2. Set Up Supabase
Follow the detailed guide in `supabase/README.md`:
1. Create a Supabase project
2. Run the migration: `supabase/migrations/001_initial_schema.sql`
3. Create storage buckets (attachments, avatars, posters)
4. Configure storage policies

### 3. Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` and create an account!

## 📊 Database Schema

The database includes the following main tables:
- **bookmarks** - Core content storage
- **attachments** - File attachments for bookmarks
- **schedules** - One-time and recurring schedules
- **schedule_occurrences** - Generated schedule instances
- **notifications** - User notifications
- **watch_plans** - Watch planning and organization
- **watch_plan_bookmarks** - Junction table for plans
- **public_profiles** - User profile information
- **user_follows** - Social graph
- **sharing_links** - Public sharing functionality
- **enrich_cache** - URL metadata cache
- **bookmark_events** - Audit trail

See `supabase/migrations/001_initial_schema.sql` for the complete schema.

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

- **Row Level Security (RLS)** enabled on all tables
- **User isolation** - users can only access their own data
- **Secure authentication** via Supabase Auth
- **Storage policies** - files scoped to user folders
- **Type-safe queries** with TypeScript

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🤝 Contributing

This is a demonstration project showcasing Supabase integration. Feel free to fork and customize!

## 📄 License

MIT License - feel free to use this project as a starting point for your own applications.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) - Backend as a Service
- [shadcn/ui](https://ui.shadcn.com/) - UI Component Library
- [React Query](https://tanstack.com/query) - Data Fetching & Caching
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

**Note**: This project requires a configured Supabase backend to function. See `supabase/README.md` for setup instructions.
