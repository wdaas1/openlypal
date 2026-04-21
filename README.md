# Openly

A full-featured social media platform built with React Native (Expo) and a Hono backend.

## Features

### Feed & Discovery
- **Smart Feed**: [Following] [For You] [Unfiltered 🔥] tabs
  - "For You": AI-ranked mix — 50% followed, 30% interest-based, 20% trending
  - "Following": Posts from people you follow + reblogs
  - "Unfiltered": Raw chronological global feed — no algorithm
- **Explore Page**: Search users and posts, trending hashtags with trend indicators, recommended users
- **Trending Page**: Trending / Rising / Controversial tabs with hashtag rankings
- **All Hashtags**: Full ranked list with post counts and trend direction
- **Tag Feed**: Tap any hashtag to browse all posts with that tag
- **Interest-based ranking**: Feed trained by selected categories (Art, Music, Tech, Gaming, etc.)

### Content & Posts
- **Post Types**: Text, photo (multi-image), quote, link, video
- **Hashtag Tags**: Chip-based tag input (type + space/comma to add, tap to remove); tappable on posts
- **@Mentions**: Type `@name` in post or comment for autocomplete — mentioned users get push notifications
- **Content Sensitivity Layer**: Safe / Mature / Unfiltered per-user setting
  - Explicit thumbnails blurred by default (tap to reveal)
  - 18+ badge on sensitive posts
  - `contentScore` (0–1) AI-scored per post
- **Double-tap to Like**: Tap anywhere on a post card twice to like with heart animation
- **Repost / Reblog**: Share posts with or without a comment
- **Bookmarks**: Save posts for later
- **Video Feed**: Inline video with mute-by-default, horizontal scrub gesture to seek, fullscreen mode
- **Link Previews**: Auto-fetched Open Graph previews for link posts
- **Polls**: Create polls with multiple options and live vote percentages

### Social & Interactions
- **Threaded Comments**: Nested replies with upvote/downvote
  - Sort: Top / New / Controversial
  - "Creator replied" badge
  - @mention support with autocomplete
- **Community Moderation**: Report posts (Spam / Abuse / Illegal / Explicit) — auto-hides at 5+ reports
- **Follow System**: Follow/unfollow users; followers/following lists
- **Tag Follows**: Subscribe to hashtags for personalized feed content
- **Relationships**: Social status system

### Profiles
- **Profile 2.0**: Banner image, bio, links, follower/following/post counts
- **Grid tabs**: Posts / Media / Liked
- **Creator links**: Website + social links as chips
- **Profile Modules**: Customizable sections — project, goal, mood, what you're learning, availability
- **Edit Profile**: Name, username, bio, avatar, banner, pronouns, location, website, gender, relationship status

### Live Moments
- **Go Live**: Start a live video session (WebRTC via LiveKit)
- **Live Feed**: Browse active and recent live moments from followed users
- **Live Chat**: Real-time messages during a live session
- **Recap**: Watch a playback after a moment ends
- **Rooms Live**: Host a live moment inside a room

### Rooms (Communities)
- **Create Rooms**: Private or public group spaces
- **Room Feed**: Posts scoped to the room
- **Room Media Gallery**: Browse all media shared in a room
- **Room Live Moments**: Room-specific live sessions
- **Member Management**: Add/remove members

### Messaging
- **Direct Messages**: End-to-end encrypted 1-on-1 conversations
- **Conversation List**: Unread count badges, sorted by recency

### Notifications & Activity
- **Push Notifications**: Likes, comments, follows, reblogs, @mentions
- **Activity Feed**: Incoming and outgoing activity history
- **Notification Preferences**: Per-type toggles in settings

### UI / UX
- **Floating Glass Nav Bar**: Pill-shaped blur nav, spring animations, neon green active glow
- **Dark / Light themes**: System-aware with consistent design tokens
- **Skeleton loaders**: Animated pulse placeholders while content loads
- **Haptic feedback**: Impact on likes, follows, navigations
- **Pull-to-refresh**: All feed screens

### Admin
- **Admin Dashboard**: User management, content moderation, ban/unban
- **Ad Management**: Create, budget, and track sponsored ads

### Ads
- **Sponsored Posts**: Native ads injected into feeds with impression tracking
- **Ad Dismissal**: Users can dismiss ads; frequency capped per user

---

## Tech Stack

### Mobile (`/mobile`)
| Package | Version | Purpose |
|---|---|---|
| Expo SDK | 53 | App framework |
| React Native | 0.79.6 | UI framework |
| NativeWind | 4 | Tailwind CSS styling |
| React Query | 5 | Server state & caching |
| Better Auth | 1.5 | Authentication (Email OTP) |
| React Native Reanimated | 3 | Animations |
| React Native Gesture Handler | – | Gestures |
| Lucide React Native | – | Icons |
| Expo Video | – | Video playback |
| Expo Image | – | Optimized images |
| Expo Blur | – | Glass blur effects |
| Expo Haptics | – | Haptic feedback |
| Zeego | 3 | Native context menus |
| LiveKit Client | 2 | Live streaming |

### Backend (`/backend`)
| Package | Version | Purpose |
|---|---|---|
| Hono | 4.6 | Web framework (Bun) |
| Prisma | 6 | ORM + SQLite |
| Better Auth | 1.5 | Authentication |
| Zod | 4 | Request validation |
| OpenAI SDK | 6 | AI content moderation |
| LiveKit Server SDK | 2 | Live streaming tokens |
| Resend | 6 | Transactional email |
| Supabase | 2 | File storage |

---

## API Endpoints

### Auth (`/api/auth/*`)
- `POST /api/auth/email-otp/send-verification-otp` — Send OTP
- `POST /api/auth/sign-in/email-otp` — Verify OTP and sign in
- `POST /api/auth/sign-out` — Sign out

### Posts
| Method | Path | Description |
|---|---|---|
| GET | `/api/posts` | Feed (`?userId=`, `?tag=`, `?liked=`, `?limit=`) |
| GET | `/api/posts/feed/following` | Posts from followed users + reblogs |
| GET | `/api/posts/feed/unfiltered` | Chronological global feed |
| GET | `/api/posts/:id` | Single post |
| POST | `/api/posts` | Create post |
| PUT | `/api/posts/:id` | Edit post |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/posts/:id/like` | Toggle like |
| POST | `/api/posts/:id/reblog` | Reblog post |
| POST | `/api/posts/:id/bookmark` | Toggle bookmark |
| POST | `/api/posts/:id/report` | Report post |
| GET | `/api/posts/:id/comments` | Get comments (`?sort=top|new|controversial`) |
| POST | `/api/posts/:id/comments` | Add comment (supports `parentId` for replies) |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/api/users/me` | Current user profile |
| PATCH | `/api/users/me` | Update profile |
| GET | `/api/users/search?q=` | Search users by name/username |
| GET | `/api/users/by-username/:username` | Get user by exact username |
| GET | `/api/users/:id` | User profile |
| GET | `/api/users/:id/posts` | User's posts |
| GET | `/api/users/:id/followers` | Followers list |
| GET | `/api/users/:id/following` | Following list |
| POST | `/api/users/:id/follow` | Toggle follow |

### Explore
| Method | Path | Description |
|---|---|---|
| GET | `/api/explore/trending` | Trending posts (`?type=trending|rising|controversial`) |
| GET | `/api/explore/tags` | Popular hashtags with trend direction |
| GET | `/api/explore/recommended` | Recommended users |

### Comments
| Method | Path | Description |
|---|---|---|
| POST | `/api/comments/:id/vote` | Upvote or downvote a comment |
| DELETE | `/api/comments/:id` | Delete own comment |

### Rooms
| Method | Path | Description |
|---|---|---|
| GET | `/api/rooms` | List joined rooms |
| POST | `/api/rooms` | Create room |
| GET | `/api/rooms/:id` | Room details + members |
| PUT | `/api/rooms/:id` | Update room |
| DELETE | `/api/rooms/:id` | Delete room |
| POST | `/api/rooms/:id/join` | Join room |
| POST | `/api/rooms/:id/leave` | Leave room |
| GET | `/api/rooms/:id/posts` | Room posts |
| GET | `/api/rooms/:id/media` | Room media gallery |

### Live Moments
| Method | Path | Description |
|---|---|---|
| GET | `/api/live-moments/following` | Live moments from followed users |
| GET | `/api/live-moments/:id` | Single moment |
| POST | `/api/live-moments` | Start a live moment |
| DELETE | `/api/live-moments/:id` | End / delete moment |
| POST | `/api/live-moments/:id/messages` | Send chat message |
| GET | `/api/live-moments/:id/messages` | Get chat messages |

### Streaming
| Method | Path | Description |
|---|---|---|
| POST | `/api/streaming/token` | Get LiveKit token for broadcasting |
| POST | `/api/streaming/viewer-token` | Get LiveKit token for viewing |

### Messages
| Method | Path | Description |
|---|---|---|
| GET | `/api/conversations` | List conversations |
| GET | `/api/messages/:userId` | Messages with a user |
| POST | `/api/messages/:userId` | Send message |

### Activity
| Method | Path | Description |
|---|---|---|
| GET | `/api/activity` | Activity feed (incoming + outgoing) |

### Profile Modules
| Method | Path | Description |
|---|---|---|
| GET | `/api/profile-modules` | Get own modules |
| GET | `/api/profile-modules/:userId` | Get user's modules |
| PUT | `/api/profile-modules` | Update modules |

### Relationships
| Method | Path | Description |
|---|---|---|
| GET | `/api/relationships` | Get all relationship statuses |
| POST | `/api/relationships` | Set relationship status |
| DELETE | `/api/relationships/:id` | Remove relationship |

### Tag Follows
| Method | Path | Description |
|---|---|---|
| GET | `/api/tag-follows` | List followed tags |
| POST | `/api/tag-follows` | Follow a tag |
| DELETE | `/api/tag-follows/:tag` | Unfollow a tag |

### Ads
| Method | Path | Description |
|---|---|---|
| GET | `/api/ads` | Get an ad for the feed |
| POST | `/api/ads/:id/impression` | Record impression |
| POST | `/api/ads/:id/dismiss` | Dismiss ad |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id` | Update user (role, status) |
| GET | `/api/admin/reports` | List reports |
| POST | `/api/admin/ads` | Create ad |
| GET | `/api/admin/ads` | List ads |
| DELETE | `/api/admin/ads/:id` | Delete ad |

---

## Database Models

| Model | Description |
|---|---|
| `User` | Account with profile, preferences, notification settings |
| `Session` | Auth sessions |
| `Account` | Auth provider accounts |
| `Verification` | Email OTP tokens |
| `Post` | Content posts (text/photo/quote/link/video) |
| `Like` | Post likes |
| `Reblog` | Repost with optional comment |
| `Comment` | Threaded comments with votes |
| `CommentVote` | Per-user comment vote |
| `Bookmark` | Saved posts |
| `Follow` | User follow relationships |
| `TagFollow` | Hashtag subscriptions |
| `Message` | Direct messages |
| `Report` | Content reports |
| `LiveMoment` | Live streaming sessions |
| `LiveMomentMessage` | Live chat messages |
| `ProfileModule` | Custom profile sections |
| `Room` | Community group spaces |
| `RoomMember` | Room membership |
| `Ad` | Sponsored ads |
| `AdDismissal` | Per-user ad dismissals |

---

## Project Structure

```
/
├── mobile/          # Expo React Native app (port 8081)
│   └── src/
│       ├── app/         # Expo Router file-based routes (43 screens)
│       ├── components/  # Reusable UI components
│       └── lib/         # API client, theme, utilities
└── backend/         # Hono API server (port 3000)
    └── src/
        ├── routes/  # API route handlers (16 modules)
        └── lib/     # Auth, push notifications, utilities
```
