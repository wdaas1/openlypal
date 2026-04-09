export interface User {
  id: string;
  name: string;
  email: string;
  username: string | null;
  bio: string | null;
  image: string | null;
  headerImage: string | null;
  createdAt: string;
  categories: string | null;
  showExplicit: boolean;
  contentSensitivity?: string | null; // "safe" | "mature" | "unfiltered"
  links?: string | null; // JSON string of [{label, url}]
  pinnedPostIds?: string | null;
  role?: string;
  status?: string;
  _count?: {
    followers: number;
    following: number;
    posts: number;
  };
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isFollowing?: boolean;
  verified?: boolean;
  pronouns?: string | null;
  location?: string | null;
  website?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  relationshipStatus?: string | null;
  pinnedPost?: Post | null;
}

export interface Post {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  linkUrl: string | null;
  tags: string[];
  userId: string;
  user: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  likeCount: number;
  commentCount: number;
  reblogCount: number;
  isLiked: boolean;
  isExplicit: boolean;
  category: string | null;
  createdAt: string;
  repostCount?: number;
  bookmarkCount?: number;
  isReposted?: boolean;
  isBookmarked?: boolean;
  viewCount?: number;
  readTime?: number;
  poll?: {
    question: string;
    options: { text: string; votes: number }[];
    endsAt: string;
  } | null;
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  postId: string;
  parentId: string | null;
  upvotes: number;
  downvotes: number;
  myVote: number; // 1, -1, or 0
  user: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  replies?: Comment[];
  createdAt: string;
  replyCount?: number;
  isDeleted?: boolean;
  editedAt?: string | null;
}

export type Conversation = {
  userId: string;
  user: { id: string; name: string; username: string; image: string | null };
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
};

export type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
  sender: { id: string; name: string; username: string; image: string | null };
};

export type NotificationType = 'like' | 'comment' | 'follow' | 'reblog' | 'mention' | 'reply';

export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  post?: {
    id: string;
    title: string | null;
    content: string | null;
  } | null;
  comment?: {
    id: string;
    content: string;
  } | null;
}

export interface LiveMoment {
  id: string
  title: string
  creatorId: string
  creator: User
  status: 'active' | 'ended'
  isLive: boolean
  expiresAt: string
  expiresAfter: number
  invitedUserIds: string[]
  invitedUsers: User[]
  viewerCount: number
  messageCount: number
  createdAt: string
  roomId?: string | null
}

export interface LiveMomentMessage {
  id: string
  momentId: string
  userId: string
  user: User
  content: string
  type: 'text' | 'image' | 'reaction' | 'video'
  contentUrl?: string
  createdAt: string
}

export interface TrendingHashtag {
  tag: string;
  count: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface SearchResult {
  posts: Post[];
  users: User[];
  tags: TrendingHashtag[];
}
