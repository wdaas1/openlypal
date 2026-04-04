# Openly — App Overview

**Openly** is a dark-themed social media platform for creators, built with Expo React Native (mobile) and Hono + Bun (backend). It blends feed-based content discovery, direct messaging, live moments, and deep profile customization.

---

## Table of Contents

1. [What the App Does](#what-the-app-does)
2. [Screens & Features](#screens--features)
3. [Backend API](#backend-api)
4. [Data Models](#data-models)
5. [Key Interactions](#key-interactions)
6. [Design System](#design-system)
7. [Current Capabilities](#current-capabilities)
8. [Known Gaps & Suggested Improvements](#known-gaps--suggested-improvements)

---

## What the App Does

Openly is a social platform where users can:
- Post photos, videos, text, quotes, and links
- Follow other creators and build a personalized feed
- Go live with expiring "Live Moments"
- Message each other directly
- Discover trending content and hashtags
- Customize their profile with bio, modules (projects, goals, moods), and a header image
- React to posts with likes, reblogs, and threaded comments
- Report and moderate harmful content

---

## Screens & Features

### Authentication

| Screen | File | Description |
|--------|------|-------------|
| Sign In | `sign-in.tsx` | Email + password login. Checks for banned accounts before granting access. |
| Sign Up | `sign-up.tsx` | Name, auto-generated username (e.g. `johndoe4821`), email, password. Username is editable before submitting and saved immediately after account creation. |
| Onboarding | `onboarding.tsx` | Shown once to new users. Phase 1: 3 swipeable intro slides (Welcome / Share Everything / Find Your People). Phase 2: 16-category interest picker that personalizes the feed. Skippable at any point. Completion stored in AsyncStorage. |

---

### Main Tabs (floating nav bar)

#### Home Feed (`index.tsx`)
Three sub-tabs:
- **For You** — Algorithmic blend: 50% followed users, 30% matching interests, 20% trending.
- **Following** — Chronological posts from followed users only.
- **Unfiltered 🔥** — Raw chronological feed from all users.

Features:
- Pull-to-refresh on all tabs
- Ads inserted every 5 posts
- Skeleton loading states
- Collapsible header with search, admin access, and notification bell

---

#### Explore (`explore.tsx`)
- **Search bar** — Autocompletes after 3 characters, searches users and posts by tag.
- **Trending tabs** — Trending / Rising / Controversial.
- **Category filters** — All, Art, Music, Tech, Gaming, Fashion, Food, Travel.
- **Trending hashtags** — 2-column grid showing rank, trend direction (↑↓→), and post count.
- **Recommended users** — Horizontal scroll with follow buttons.

---

#### Create Post (`create.tsx`)
Five post types:
- **Text** — Title (optional) + body.
- **Photo** — Pick from library or take with camera. Preview shown with full aspect ratio (no crop).
- **Video** — Pick from library or record.
- **Quote** — Text formatted as a pull quote.
- **Link** — URL + description.

All post types support:
- Comma-separated tags (shown as chips)
- Category selection (16 options)
- Explicit content toggle (adds blur + warning to the post in feed)

---

#### Live Moments (`live-moments/`)
- List of active live streams with creator info, viewer count, and expiration countdown.
- Expiration options: 30 min, 1 hr, 6 hrs, 24 hrs.
- Invite specific users or open to all.
- In-moment chat (text, image, reaction messages).

---

#### Profile (`profile.tsx`)
Own profile view:
- **Header**: Banner image, avatar, follower/following/post counts.
- **Bio section**: Display name, @username, pronouns, bio, location, website, custom links.
- **Profile Modules**: Pinned cards for Projects, Goals, Moods, Learning, and Availability.
- **Pinned post**: One highlighted post.
- **Gallery tabs**: Posts (3-column grid) / Media (images & videos only) / Liked posts.

---

### Secondary Screens

| Screen | Description |
|--------|-------------|
| Post Detail (`post/[id].tsx`) | Full post view with threaded comments (nested replies), upvote/downvote on comments, comment sorting (Top/New/Hot), share sheet (copy, native share, X, Facebook, WhatsApp, Telegram, Instagram). |
| User Profile (`user/[id].tsx`) | Public view of any user's profile with Follow/Unfollow button. |
| Edit Profile (`edit-profile.tsx`) | Change name, @username, bio, website, location. Upload avatar or header image. Username conflict detection. |
| Activity (`activity.tsx`) | Notification feed for likes, reblogs, and comments on your posts. Includes a Relationship Map banner. |
| Messenger (`messenger/`) | Conversation list (online status, unread badge, last message preview) and full chat view. |
| Relationships (`relationships.tsx`) | Friendship strength map — composite score from messages (×3), likes (×2), comments (×2). Flags "drifting" contacts with no interaction for 14+ days. |
| Interests (`interests.tsx`) | Change content categories to re-personalize the feed. |
| Profile Modules (`profile-modules/`) | Add/edit/remove pinned profile cards (Projects, Goals, Moods, Learning, Availability). |
| Settings (`settings.tsx`) | Content sensitivity (Safe / Mature / Unfiltered), privacy options. |
| Admin (`admin.tsx`) | Moderator dashboard — review reports, ban users. |
| Legal / Support | Static terms, privacy policy, and help pages. |

---

### Components

| Component | Description |
|-----------|-------------|
| `PostCard` | Full post renderer. Handles explicit blur/reveal, double-tap to like (card or image), video auto-play/pause, reblog, bookmark, share, report modal, and swipe-to-DM. |
| `UserAvatar` | Circular avatar with initial-letter fallback. |
| `MediaViewer` | Full-screen image/video viewer with pinch-to-zoom and swipe-to-close. |
| `AdCard` | Placeholder sponsored card, 5 visual themes, dismissible. |
| `Logo` | App logo (animated O + green dot). |

---

## Backend API

All app routes return `{ data: T }`. The API client unwraps this automatically.

### Endpoint Groups

| Group | Prefix | Key Endpoints |
|-------|--------|---------------|
| Posts | `/api/posts` | CRUD posts, like/unlike, reblog, feed variants |
| Users | `/api/users` | Profile CRUD, follow/unfollow, search |
| Comments | `/api/comments` | Vote (upvote/downvote with toggle) |
| Messages | `/api/conversations` | List conversations, send/read messages |
| Activity | `/api/activity` | Notification feed |
| Explore | `/api/explore` | Trending posts, recommended users |
| Live Moments | `/api/live-moments` | CRUD moments, join, chat messages |
| Relationships | `/api/relationships` | Friendship strength scores |
| Profile Modules | `/api/profile-modules` | CRUD profile cards |
| Reports | `/api/reports` | File reports; auto-hides post after 5 reports |
| Tag Follows | `/api/tag-follows` | Follow/unfollow hashtags |
| Admin | `/api/admin` | Moderation actions (role-gated) |

### Content Sensitivity Filter
Posts are filtered server-side by `contentSensitivity` user setting:
- **Safe** — hides explicit posts and posts with `contentScore > 0.3`
- **Mature** — allows explicit, hides `contentScore > 0.8`
- **Unfiltered** — shows everything except flagged-illegal content

---

## Data Models

```
User          id, name, email, username, bio, image, headerImage,
              categories, contentSensitivity, followerCount, role, status

Post          id, type (text|photo|video|quote|link), title, content,
              imageUrl, videoUrl, linkUrl, tags, category, isExplicit,
              contentScore, userId, likeCount, reblogCount, commentCount

Comment       id, content, userId, postId, parentId (nested replies),
              upvotes, downvotes, createdAt

Follow        followerId + followingId (unique pair)
Like          userId + postId (unique pair)
Reblog        userId + postId + optional comment
Bookmark      userId + postId (unique pair)
CommentVote   userId + commentId + value (1 or -1)

Message       senderId, receiverId, content, read, encrypted
LiveMoment    id, title, creatorId, status, expiresAt, viewerIds (JSON)
ProfileModule userId, type, content (JSON blob)
Report        userId, postId, category, reason
```

---

## Key Interactions

### Double-Tap to Like
Anywhere on a post card → like with animated heart burst.
On the post image specifically → same heart animation over the image.

### Explicit Content
Posts marked explicit show a blurred placeholder with a "Tap to reveal" button.
Users with "mature" or "unfiltered" sensitivity see them unblurred automatically.

### Engagement Loop
Like → Reblog → Comment (threaded, votable) → Share (6 platforms).
Swipe left on any post card → DM that creator directly.

### Auto-Report Hiding
A post is automatically hidden from feeds after receiving 5 reports.

### Onboarding Flow
Sign up → Onboarding slides → Pick interests → Home feed.
Each step is skippable. The `onboarding_done` flag in AsyncStorage prevents repeat showings.

### Username Auto-Assignment
On sign-up, a username is generated from the display name + a stable 4-digit suffix (e.g. `janedoe2391`). It is editable in the sign-up form and changeable anytime in Edit Profile.

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#001935` | All screens |
| Card/elevated | `#0a2d50` | Input fields, cards |
| Border | `#1a3a5c` | Dividers, input borders |
| Accent green | `#00CF35` | CTAs, active states, likes |
| Accent red | `#FF4E6A` | Likes (filled), delete, errors |
| Text primary | `#FFFFFF` | Headings, body |
| Text secondary | `#4a6fa5` | Placeholders, timestamps |
| Text muted | `#a0b4c8` | Subtitles, help text |

Animations use React Native Reanimated v3 with spring easing. Haptics fire on most interactions.

---

## Current Capabilities

- ✅ Full auth flow (sign up, sign in, sign out, ban detection)
- ✅ Onboarding with interest selection
- ✅ Auto-generated editable username on sign-up
- ✅ 5 post types with file upload (image + video)
- ✅ 3 feed variants (For You, Following, Unfiltered)
- ✅ Explore with trending hashtags, categories, recommended users
- ✅ Double-tap to like (card and image)
- ✅ Threaded comments with voting
- ✅ Explicit content system (blur + sensitivity settings)
- ✅ Direct messaging
- ✅ Live Moments with expiration and in-moment chat
- ✅ Relationship strength map
- ✅ Profile modules (Projects, Goals, Moods, etc.)
- ✅ Full-screen media viewer (pinch zoom, swipe close)
- ✅ Swipe-to-DM on post cards
- ✅ Share sheet (6 platforms)
- ✅ User reporting + auto-hide after 5 reports
- ✅ Admin moderation dashboard
- ✅ Tag following system

---

## Known Gaps & Suggested Improvements

### High Priority

| Area | Issue / Improvement |
|------|---------------------|
| **Real-time** | Messages and Live Moments are polled, not pushed. Adding WebSockets or Server-Sent Events would make chat feel live. |
| **Notifications** | No push notifications. Adding Expo Push Notifications for likes, mentions, new messages would significantly increase retention. |
| **Search** | Hashtag search works but full-text post search doesn't exist. A search endpoint on post content would help discovery. |
| **Rate limiting** | Backend has no rate limiting. High-volume or abusive API calls could degrade service. Add per-IP or per-user rate limiting. |
| **Image compression** | Images are uploaded at full resolution. Client-side resize before upload would reduce storage costs and load times. |

### Medium Priority

| Area | Issue / Improvement |
|------|---------------------|
| **Offline support** | No offline mode. Caching posts locally (e.g. with MMKV + React Query `persist`) would let users browse cached content without a connection. |
| **Pagination cursor** | Feed endpoints likely use offset pagination. Switching to cursor-based pagination would be more stable under concurrent inserts. |
| **Video thumbnails** | Videos show no preview thumbnail in feeds — just a play icon placeholder. Generating thumbnails on upload would improve the feed experience. |
| **Comment pagination** | Long comment threads load all at once. Adding pagination or a "load more" pattern would prevent UI slowdowns on popular posts. |
| **Blocked users** | There's a relationships screen but no block functionality visible in the UI. A block list would improve safety. |
| **Post editing** | Posts can be deleted but not edited. Adding an edit flow with an "edited" indicator would be useful for creators. |

### Lower Priority / Future Features

| Feature | Description |
|---------|-------------|
| **Polls** | The Post type enum and feed card reference polls but the creation UI doesn't expose them. Enabling poll creation would add engagement. |
| **Collections / Albums** | Group related posts into a collection — useful for photographers and series creators. |
| **Analytics** | View counts exist on posts but creators have no dashboard to see trends over time. |
| **Scheduled posts** | Allow creators to write a post now and publish it at a future time. |
| **Embeds / link previews** | Link posts show only the URL. Fetching Open Graph metadata to show a rich preview card would improve the link post type. |
| **Mentions (`@username`)** | The comment input has a mention hint but no actual mention resolution — clicking `@name` doesn't navigate to the profile. Wiring this up would improve social graph discoverability. |
| **Hashtag following in feed** | Users can follow tags (`/api/tag-follows`) but the For You feed doesn't appear to use followed tags as a feed signal alongside followed users. |
| **Two-factor authentication** | Better Auth supports 2FA but it isn't exposed in the settings UI. |
| **Account deletion** | There's no self-service account deletion flow. |
| **Dark/light mode toggle** | App is dark-mode only. A light mode option would broaden accessibility. |
