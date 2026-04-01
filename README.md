# Openly

A full-featured social media platform built with React Native (Expo) and a Hono backend.

## Features

### Feed & Discovery
- **Smart Feed**: [Following] [For You] [Unfiltered 🔥] tabs
  - "For You": AI-ranked mix — 50% followed, 30% interest-based, 20% trending
  - "Following": Posts from people you follow
  - "Unfiltered": Raw chronological global feed — no algorithm
- **Trending Page**: Trending / Rising / Controversial tabs with hashtags and creators
- **Explore**: Search, popular tags, recommended users with follow counts
- **Interest-based ranking**: Feed trained by selected categories

### Content
- **Post Types**: Text, photo, quote, link, video posts
- **Content Sensitivity Layer**: Safe / Mature / Unfiltered per-user setting
  - Explicit thumbnails blurred by default (tap to reveal)
  - 18+ badge on sensitive posts
  - `contentScore` (0–1) on each post
- **Double-tap to Like**: Tap anywhere on a post card twice to like
- **Repost / Reblog**: With or without comment
- **Video Feed**: Inline video with mute-by-default

### Social
- **Threaded Comments**: Reddit-style nested replies
  - Upvote / Downvote with live counts
  - Sort: Top / New / Controversial
  - "Creator replied" badge
- **Community Moderation**: Report posts (Spam / Abuse / Illegal / Explicit)
  - Auto-hide after 5 reports
- **Follow System**: Follow/unfollow users

### Profiles
- **Profile 2.0**: Banner image, bio, links section, follower counts
- **Grid tabs**: [Posts] [Media] [Liked]
- **Creator links**: Display website + social links as chips

### UI/UX
- **Floating Glass Nav Bar**: Pill-shaped blur nav, spring animations, neon green active glow
- **Skeleton loaders**: Animated pulse placeholders while content loads
- **Haptic feedback**: Light impact on likes, follows, navigations
- **Pull-to-refresh**: All feed screens

### Authentication & Settings
- Email OTP sign-in via Better Auth
- Settings: content sensitivity, interests, privacy, support

## Tech Stack

### Mobile (`/mobile`)
- Expo SDK 53 + React Native
- NativeWind (Tailwind CSS)
- React Query for data fetching
- Better Auth (Expo client) for authentication
- React Native Reanimated for animations
- Lucide icons

### Backend (`/backend`)
- Hono web framework on Bun
- Prisma ORM with SQLite
- Better Auth with Email OTP
- Zod validation

## API Endpoints

### Auth
- `POST /api/auth/email-otp/send-verification-otp` - Send OTP
- `POST /api/auth/sign-in/email-otp` - Verify OTP and sign in
- `POST /api/auth/sign-out` - Sign out

### Posts
- `GET /api/posts` - Feed (supports `?tag=` filter)
- `GET /api/posts/:id` - Single post
- `POST /api/posts` - Create post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/like` - Toggle like
- `POST /api/posts/:id/reblog` - Reblog
- `GET /api/posts/:id/comments` - Get comments
- `POST /api/posts/:id/comments` - Add comment

### Users
- `GET /api/users/me` - Current user
- `PATCH /api/users/me` - Update profile
- `GET /api/users/:id` - User profile
- `GET /api/users/:id/posts` - User posts
- `POST /api/users/:id/follow` - Toggle follow
- `GET /api/users/search?q=` - Search users

### Explore
- `GET /api/explore/trending` - Trending posts
- `GET /api/explore/tags` - Popular tags
- `GET /api/explore/recommended` - Recommended users
