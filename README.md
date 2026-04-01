# Tumblr Clone

A full-featured Tumblr clone built with React Native (Expo) and a Hono backend.

## Features

- **Authentication**: Email OTP sign-in via Better Auth
- **Feed**: Scrollable dashboard of posts from followed users
- **Post Types**: Text, photo, quote, and link posts
- **Social**: Like, reblog, comment on posts
- **Explore**: Discover trending posts, popular tags, and recommended users
- **Profiles**: Customizable profiles with header images, bios, and post/like tabs
- **Follow System**: Follow/unfollow users to curate your feed
- **Search**: Find users by name or username

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
