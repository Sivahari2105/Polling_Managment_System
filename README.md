# PollFlow - College Poll Management System

A comprehensive poll management system for college students and faculty with real-time analytics, built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## 🚀 Features

- **Multi-role Access**: Student, Faculty, HOD, and CDC dashboards
- **Real-time Polls**: Create and participate in polls with live updates
- **Mobile Responsive**: Optimized for all device sizes
- **Secure Authentication**: Role-based access control
- **Remember Me**: Extended login sessions for convenience
- **Real-time Analytics**: Live poll response tracking
- **Modern UI/UX**: Beautiful, intuitive interface with animations

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL, Real-time, Auth)

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- Supabase account and project

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd the_poll
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file and configure your Supabase credentials:

```bash
cp env.example .env.local
```

Edit `.env.local` with your Supabase details:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=PollFlow
```

### 4. Database Setup

Run the SQL schema in your Supabase SQL editor to create the necessary tables and relationships.

### 5. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Available Scripts

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Lint and fix
npm run lint
npm run lint:fix
```

## 📱 Mobile Optimization

The app is fully optimized for mobile devices with:
- Responsive design that adapts to all screen sizes
- Touch-friendly buttons and inputs (44px minimum)
- Mobile-first CSS utilities
- Optimized typography scaling
- Proper viewport configuration

## 🔒 Security Features

- Input validation and sanitization
- Role-based access control
- Session management with configurable expiry
- Secure authentication flows

## 📊 Performance

- Next.js automatic optimization
- Code splitting and lazy loading
- Optimized bundle sizes
- Mobile-first responsive design

## 🚨 Troubleshooting

### Common Issues

1. **Build Errors**
   - Check Node.js version (18+)
   - Verify all dependencies installed
   - Check TypeScript errors

2. **Environment Variables**
   - Ensure all required env vars are set
   - Check Supabase credentials are correct

3. **Database Connection**
   - Verify Supabase project is active
   - Check RLS policies are configured

4. **Mobile Layout Issues**
   - Clear browser cache
   - Test on different devices
   - Check viewport meta tag

## 🚀 Deployment

To deploy your app:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Choose Hosting Platform**
   - **Vercel** (Recommended): Connect GitHub repo, set env vars, deploy
   - **Netlify**: Connect repo, set build command: `npm run build`, publish dir: `.next`
   - **Railway**: Connect repo, set environment variables
   - **Self-hosted**: Build with `npm run build`, start with `npm start`

3. **Set Environment Variables** in your hosting platform:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   NEXT_PUBLIC_APP_NAME=PollFlow
   ```

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

For internal development team use only.

---

**Your PollFlow app is ready to use and deploy!** 🎉
