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
  _count?: {
    followers: number;
    following: number;
    posts: number;
  };
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isFollowing?: boolean;
}

export interface Post {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
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
