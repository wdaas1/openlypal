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
  user: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  createdAt: string;
}
