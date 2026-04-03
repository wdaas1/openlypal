import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Share as RNShare, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Heart, Repeat2, MessageCircle, Share, Send, ChevronUp, ChevronDown, X, TrendingUp, Copy, Twitter, Facebook, MessageSquare } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api/api';
import type { Post, Comment } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { MediaViewer } from '@/components/MediaViewer';

type CommentSort = 'top' | 'new' | 'controversial';

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 240, borderRadius: 12, marginBottom: 16 }}
      contentFit="contain"
      nativeControls
    />
  );
}

function CommentItem({
  comment,
  postUserId,
  onReply,
  isNested,
}: {
  comment: Comment;
  postUserId: string;
  onReply: (id: string, username: string) => void;
  isNested?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [myVote, setMyVote] = useState<number>(comment.myVote ?? 0);
  const [upvotes, setUpvotes] = useState(comment.upvotes ?? 0);
  const [downvotes, setDownvotes] = useState(comment.downvotes ?? 0);
  const isCreator = comment.userId === postUserId;

  const replyCount = comment.replies?.length ?? 0;
  const defaultCollapsed = replyCount > 2;
  const [repliesCollapsed, setRepliesCollapsed] = useState<boolean>(defaultCollapsed);

  const voteMutation = useMutation({
    mutationFn: async (value: number) => {
      await api.post(`/api/comments/${comment.id}/vote`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });

  const handleVote = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVote = myVote === value ? 0 : value;
    if (value === 1) {
      setUpvotes(prev => prev + (newVote === 1 ? 1 : -1));
      if (myVote === -1) setDownvotes(prev => prev + 1);
    } else {
      setDownvotes(prev => prev + (newVote === -1 ? 1 : -1));
      if (myVote === 1) setUpvotes(prev => prev - 1);
    }
    setMyVote(newVote);
    voteMutation.mutate(newVote === 0 ? 0 : value);
  };

  const netScore = upvotes - downvotes;
  const netScoreColor = netScore > 0 ? '#00CF35' : netScore < 0 ? '#FF4E6A' : '#4a6fa5';
  const bubbleBg = isNested ? 'rgba(0,20,45,0.8)' : '#0a2d50';

  // Deleted comment — simplified greyed-out bubble, still show replies
  if (comment.isDeleted === true) {
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row' }}>
          {isNested ? (
            <View style={{
              width: 2,
              backgroundColor: 'rgba(0,207,53,0.25)',
              marginRight: 10,
            }} />
          ) : null}
          <View style={{ flex: 1 }}>
            <View style={{
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: bubbleBg,
              opacity: 0.5,
            }}>
              <Text style={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: 13,
                fontStyle: 'italic',
                lineHeight: 18,
              }}>
                [deleted]
              </Text>
            </View>
          </View>
        </View>
        {/* Still render replies even for deleted comments */}
        {replyCount > 0 ? (
          <View style={{ marginLeft: 42, marginTop: 8, gap: 8 }}>
            {(comment.replies ?? []).map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postUserId={postUserId}
                onReply={onReply}
                isNested
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // Effective reply count for toggle label: prefer replyCount field, fall back to replies array length
  const effectiveReplyCount = comment.replyCount ?? replyCount;

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row' }}>
        {isNested ? (
          <View style={{
            width: 2,
            backgroundColor: 'rgba(0,207,53,0.25)',
            marginRight: 10,
          }} />
        ) : null}
        <Pressable
          testID={`comment-avatar-${comment.id}`}
          onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: comment.userId } })}
        >
          <UserAvatar uri={comment.user.image} name={comment.user.name} size={32} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: bubbleBg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Pressable
                testID={`comment-username-${comment.id}`}
                onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: comment.userId } })}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                  {comment.user.username ?? comment.user.name}
                </Text>
              </Pressable>
              {isCreator ? (
                <View style={{
                  backgroundColor: 'rgba(0,207,53,0.2)',
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 0.5,
                  borderColor: '#00CF35',
                }}>
                  <Text style={{ color: '#00CF35', fontSize: 9, fontWeight: '800' }}>Creator</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <Text style={{ color: '#4a6fa5', fontSize: 10 }}>
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </Text>
                {comment.editedAt ? (
                  <Text style={{ color: '#4a6fa5', fontSize: 10 }}>(edited)</Text>
                ) : null}
              </View>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18 }}>
              {comment.content}
            </Text>
          </View>
          {/* Vote + Reply row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingLeft: 4, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pressable
                testID={`upvote-${comment.id}`}
                onPress={() => handleVote(1)}
              >
                <ChevronUp size={16} color={myVote === 1 ? '#00CF35' : '#4a6fa5'} />
              </Pressable>
              <Text style={{ color: netScoreColor, fontSize: 11, fontWeight: '700', minWidth: 16, textAlign: 'center' }}>
                {netScore}
              </Text>
              <Pressable
                testID={`downvote-${comment.id}`}
                onPress={() => handleVote(-1)}
              >
                <ChevronDown size={16} color={myVote === -1 ? '#FF4E6A' : '#4a6fa5'} />
              </Pressable>
            </View>
            {!isNested ? (
              <Pressable
                testID={`reply-${comment.id}`}
                onPress={() => onReply(comment.id, comment.user.username ?? comment.user.name)}
              >
                <Text style={{ color: '#4a6fa5', fontSize: 12, fontWeight: '500' }}>Reply</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Replies toggle + nested replies */}
      {replyCount > 0 ? (
        <View style={{ marginLeft: 42, marginTop: 6 }}>
          <Pressable
            testID={`toggle-replies-${comment.id}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setRepliesCollapsed(prev => !prev);
            }}
            style={{ paddingVertical: 4, paddingHorizontal: 2, alignSelf: 'flex-start' }}
          >
            <Text style={{ color: '#4a6fa5', fontSize: 12, fontWeight: '600' }}>
              {repliesCollapsed
                ? `View ${effectiveReplyCount > 0 ? effectiveReplyCount : replyCount} ${effectiveReplyCount === 1 ? 'reply' : 'replies'}`
                : 'Hide replies'}
            </Text>
          </Pressable>
          {!repliesCollapsed ? (
            <View style={{ marginTop: 6, gap: 8 }}>
              {(comment.replies ?? []).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postUserId={postUserId}
                  onReply={onReply}
                  isNested
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const SORT_TABS: { id: CommentSort; label: string; icon?: React.ReactNode }[] = [
  { id: 'top', label: 'Top' },
  { id: 'new', label: 'New' },
  { id: 'controversial', label: 'Hot' },
];

// Share option pill definitions
type ShareOption = {
  id: string;
  label: string;
  color: string;
  icon: React.ReactNode;
  onPress: (url: string, text: string) => void;
};

function ShareSection({ postId, postTitle, postContent, imageUrl }: { postId: string; postTitle?: string; postContent?: string; imageUrl?: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://openly.app/post/${postId}`;
  const shareText = postTitle ?? postContent?.slice(0, 80) ?? 'Check out this post';

  const handleCopyLink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check this out on Openly 👇\n\n${shareText}`)}&url=${encodeURIComponent(shareUrl)}`;
    Linking.openURL(twitterUrl);
  };

  const handleFacebook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    Linking.openURL(fbUrl);
  };

  const handleWhatsApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`Check this out on Openly 👇\n\n${shareText}\n\n${shareUrl}`)}`;
    Linking.openURL(waUrl);
  };

  const handleTelegram = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check this out on Openly 👇\n\n${shareText}`)}`;
    Linking.openURL(tgUrl);
  };

  const handleInstagram = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('instagram://');
  };

  const handleNativeShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await RNShare.share({
        message: `Check this out on Openly 👇\n\n${shareText}\n\n${shareUrl}`,
        url: imageUrl ?? shareUrl,
      });
    } catch {
      // user dismissed
    }
  };

  return (
    <View
      testID="share-section"
      style={{
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#0a2d50',
        borderWidth: 0.5,
        borderColor: '#1a3a5c',
        padding: 16,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15, marginBottom: 14 }}>
        Share this post
      </Text>

      {/* Row 1: Copy + Native Share */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Pressable
          testID="share-copy-link"
          onPress={handleCopyLink}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 24,
            backgroundColor: copied ? 'rgba(0,207,53,0.2)' : 'rgba(255,255,255,0.07)',
            borderWidth: 0.5,
            borderColor: copied ? '#00CF35' : '#1a3a5c',
          }}
        >
          <Copy size={15} color={copied ? '#00CF35' : '#FFFFFF'} />
          <Text style={{ color: copied ? '#00CF35' : '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Text>
        </Pressable>

        <Pressable
          testID="share-native"
          onPress={handleNativeShare}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 24,
            backgroundColor: 'rgba(0,207,53,0.15)',
            borderWidth: 0.5,
            borderColor: 'rgba(0,207,53,0.4)',
          }}
        >
          <Share size={15} color="#00CF35" />
          <Text style={{ color: '#00CF35', fontSize: 12, fontWeight: '600' }}>More</Text>
        </Pressable>
      </View>

      {/* Row 2: Social platforms */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {/* Twitter/X */}
        <Pressable
          testID="share-twitter"
          onPress={handleTwitter}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderWidth: 0.5,
            borderColor: '#1a3a5c',
          }}
        >
          <Twitter size={14} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>X</Text>
        </Pressable>

        {/* Facebook */}
        <Pressable
          testID="share-facebook"
          onPress={handleFacebook}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 24,
            backgroundColor: 'rgba(24,119,242,0.15)',
            borderWidth: 0.5,
            borderColor: 'rgba(24,119,242,0.35)',
          }}
        >
          <Facebook size={14} color="#1877F2" />
          <Text style={{ color: '#1877F2', fontSize: 12, fontWeight: '600' }}>Facebook</Text>
        </Pressable>

        {/* WhatsApp */}
        <Pressable
          testID="share-whatsapp"
          onPress={handleWhatsApp}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 24,
            backgroundColor: 'rgba(37,211,102,0.12)',
            borderWidth: 0.5,
            borderColor: 'rgba(37,211,102,0.3)',
          }}
        >
          {/* WhatsApp icon via text since lucide doesn't have one */}
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#001935', fontSize: 8, fontWeight: '900', lineHeight: 10 }}>W</Text>
          </View>
          <Text style={{ color: '#25D366', fontSize: 12, fontWeight: '600' }}>WhatsApp</Text>
        </Pressable>

        {/* Telegram */}
        <Pressable
          testID="share-telegram"
          onPress={handleTelegram}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 24,
            backgroundColor: 'rgba(0,136,204,0.12)',
            borderWidth: 0.5,
            borderColor: 'rgba(0,136,204,0.3)',
          }}
        >
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#0088CC', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900', lineHeight: 10 }}>T</Text>
          </View>
          <Text style={{ color: '#0088CC', fontSize: 12, fontWeight: '600' }}>Telegram</Text>
        </Pressable>

        {/* Instagram */}
        <Pressable
          testID="share-instagram"
          onPress={handleInstagram}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 24,
            backgroundColor: 'rgba(225,48,108,0.12)',
            borderWidth: 0.5,
            borderColor: 'rgba(225,48,108,0.3)',
          }}
        >
          <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#E1306C', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900', lineHeight: 10 }}>IG</Text>
          </View>
          <Text style={{ color: '#E1306C', fontSize: 12, fontWeight: '600' }}>Instagram</Text>
        </Pressable>
      </View>
    </View>
  );
}

const NAV_HEIGHT = 100;

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(4 / 3);
  const [mediaViewer, setMediaViewer] = useState<{ visible: boolean; type: 'image' | 'video'; uri: string } | null>(null);
  const [commentSort, setCommentSort] = useState<CommentSort>('top');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const heartScale = useSharedValue(1);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const { data: post, isLoading: loadingPost } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get<Post>(`/api/posts/${id}`),
    enabled: !!id,
  });

  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ['comments', id, commentSort],
    queryFn: () => api.get<Comment[]>(`/api/posts/${id}/comments?sort=${commentSort}`),
    enabled: !!id,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${id}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 4 }),
      withSpring(1, { damping: 6 })
    );
    likeMutation.mutate();
  };

  const reblogMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${id}/reblog`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      return api.post(`/api/posts/${id}/comments`, {
        content: commentText,
        parentId: replyingTo?.id ?? null,
      });
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCommentText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    },
  });

  const handleDmAuthor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (post?.userId) {
      router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: post.userId } });
    }
  };

  if (loadingPost) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#001935' }}>
        <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#001935' }}>
        <Text style={{ color: '#4a6fa5' }}>Post not found</Text>
      </SafeAreaView>
    );
  }

  const tags = Array.isArray(post.tags) ? post.tags : [];
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const commentCount = comments?.length ?? 0;
  const isSendActive = commentText.trim().length > 0;
  const hasMoreComments = (post.commentCount ?? 0) > commentCount;

  return (
    <SafeAreaView testID="post-detail-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Pressable testID="back-button" onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17, marginLeft: 16 }}>Post</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Floating DM button — positioned absolutely above the comment bar */}
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', bottom: replyingTo ? 106 : 74, right: 16, zIndex: 10 }}
        >
          <Pressable
            testID="floating-dm-button"
            onPress={handleDmAuthor}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#00CF35',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#00CF35',
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
              shadowOpacity: 0.5,
              elevation: 10,
            }}
          >
            <MessageSquare size={22} color="#001935" />
          </Pressable>
          <View
            style={{
              position: 'absolute',
              bottom: 56,
              right: 0,
              backgroundColor: 'rgba(0,207,53,0.15)',
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderWidth: 0.5,
              borderColor: 'rgba(0,207,53,0.4)',
            }}
            pointerEvents="none"
          >
            <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '700' }}>Message</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: NAV_HEIGHT + 40 }}>
          {/* Post */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {/* User */}
            <Pressable
              testID="post-user-header"
              onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: post.userId } })}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
            >
              <UserAvatar uri={post.user.image} name={post.user.name} size={44} />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                  {post.user.username ?? post.user.name}
                </Text>
                <Text style={{ color: '#4a6fa5', fontSize: 12, marginTop: 1 }}>{timeAgo}</Text>
              </View>
            </Pressable>

            {/* Title */}
            {post.title ? (
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 22, marginBottom: 12, lineHeight: 28 }}>{post.title}</Text>
            ) : null}

            {/* Content */}
            {post.content ? (
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 16, lineHeight: 22 }}>
                {post.content}
              </Text>
            ) : null}

            {/* Image */}
            {post.imageUrl ? (
              <Pressable
                testID="detail-open-image-viewer"
                onPress={() => setMediaViewer({ visible: true, type: 'image', uri: post.imageUrl! })}
              >
                <Image
                  source={{ uri: post.imageUrl }}
                  style={{ width: '100%', aspectRatio: imageAspectRatio, borderRadius: 12, marginBottom: 16 }}
                  contentFit="contain"
                  onLoad={(e) => {
                    const { width: w, height: h } = e.source;
                    if (w && h) setImageAspectRatio(w / h);
                  }}
                />
              </Pressable>
            ) : null}

            {/* Video */}
            {post.type === 'video' && post.videoUrl ? (
              <VideoPlayer uri={post.videoUrl} />
            ) : null}

            {/* Link */}
            {post.linkUrl ? (
              <View style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, backgroundColor: '#0a2d50' }}>
                <Text style={{ color: '#00CF35', fontSize: 13 }}>{post.linkUrl}</Text>
              </View>
            ) : null}

            {/* Tags */}
            {tags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {tags.map((tag) => (
                  <Text key={tag} style={{ color: '#00CF35', fontSize: 13 }}>#{tag}</Text>
                ))}
              </View>
            ) : null}

            {/* Actions */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
              borderTopColor: '#1a3a5c', borderTopWidth: 0.5,
              borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5,
            }}>
              <Pressable testID="detail-like-button" onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 28 }}>
                <Animated.View style={heartAnimatedStyle}>
                  <Heart size={22} color={post.isLiked ? '#FF4E6A' : '#4a6fa5'} fill={post.isLiked ? '#FF4E6A' : 'transparent'} />
                </Animated.View>
                <Text style={{ marginLeft: 8, fontSize: 13, color: post.isLiked ? '#FF4E6A' : '#4a6fa5' }}>
                  {post.likeCount}
                </Text>
              </Pressable>
              <Pressable testID="detail-reblog-button" onPress={() => reblogMutation.mutate()} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 28 }}>
                <Repeat2 size={22} color="#4a6fa5" />
                <Text style={{ marginLeft: 8, fontSize: 13, color: '#4a6fa5' }}>{post.reblogCount}</Text>
              </Pressable>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginRight: 28 }}>
                <MessageCircle size={22} color="#4a6fa5" />
                <Text style={{ marginLeft: 8, fontSize: 13, color: '#4a6fa5' }}>{post.commentCount}</Text>
              </Pressable>
              <Pressable testID="detail-share-button" style={{ marginLeft: 'auto' }}>
                <Share size={20} color="#4a6fa5" />
              </Pressable>
            </View>
          </View>

          {/* Comments */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {/* Comment section header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MessageCircle size={16} color="#4a6fa5" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                  Comments ({commentCount})
                </Text>
              </View>
              {/* Sort tab glass pill */}
              <View style={{
                flexDirection: 'row',
                marginLeft: 'auto',
                backgroundColor: 'rgba(10,45,80,0.8)',
                borderRadius: 20,
                padding: 3,
              }}>
                {SORT_TABS.map((tab) => {
                  const isActive = commentSort === tab.id;
                  const textColor = isActive ? '#001935' : '#4a6fa5';
                  return (
                    <Pressable
                      key={tab.id}
                      testID={`sort-${tab.id}`}
                      onPress={() => setCommentSort(tab.id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 17,
                        backgroundColor: isActive ? '#00CF35' : 'transparent',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      {tab.id === 'controversial' ? (
                        <TrendingUp size={11} color={textColor} />
                      ) : null}
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: textColor,
                      }}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {loadingComments ? (
              <ActivityIndicator color="#00CF35" style={{ marginBottom: 16 }} />
            ) : (comments ?? []).length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                <MessageCircle size={48} color="#1a3a5c" />
                <Text style={{ color: '#4a6fa5', fontSize: 14, fontWeight: '500' }}>Be the first to comment</Text>
              </View>
            ) : (
              (comments ?? []).map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  postUserId={post.userId}
                  onReply={(commentId, username) => setReplyingTo({ id: commentId, username })}
                />
              ))
            )}

            {/* Load more comments */}
            {!loadingComments && hasMoreComments ? (
              <Pressable
                testID="load-more-comments"
                style={{
                  borderWidth: 1,
                  borderColor: '#1a3a5c',
                  borderRadius: 12,
                  paddingVertical: 10,
                  marginHorizontal: 16,
                  marginTop: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#4a6fa5', fontSize: 13, fontWeight: '600' }}>Load more comments</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Share section */}
          <ShareSection postId={id ?? ''} postTitle={post.title ?? undefined} postContent={post.content ?? undefined} imageUrl={post.imageUrl ?? undefined} />

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Replying to indicator */}
        {replyingTo ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 8,
            backgroundColor: 'rgba(0,207,53,0.08)',
            borderTopColor: 'rgba(0,207,53,0.2)', borderTopWidth: 0.5,
            borderBottomColor: 'rgba(0,207,53,0.2)', borderBottomWidth: 0.5,
          }}>
            <Text style={{ color: '#4a6fa5', fontSize: 12, flex: 1 }}>
              Replying to <Text style={{ color: '#00CF35', fontWeight: '600' }}>@{replyingTo.username}</Text>
            </Text>
            <Pressable testID="cancel-reply-button" onPress={() => setReplyingTo(null)}>
              <X size={16} color="#4a6fa5" />
            </Pressable>
          </View>
        ) : null}

        {/* Comment Input — floating glass bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: 'rgba(0,18,40,0.92)',
          borderTopColor: '#1a3a5c', borderTopWidth: 0.5,
        }}>
          <TextInput
            testID="comment-input"
            value={commentText}
            onChangeText={setCommentText}
            placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
            placeholderTextColor="#4a6fa5"
            style={{
              flex: 1, color: '#FFFFFF', fontSize: 13, marginRight: 12,
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
              backgroundColor: '#001935', borderColor: '#1a3a5c', borderWidth: 1,
            }}
          />
          <Pressable
            testID="send-comment-button"
            onPress={() => addComment.mutate()}
            disabled={!isSendActive || addComment.isPending}
            style={{
              borderRadius: 22, padding: 10,
              backgroundColor: isSendActive ? '#00CF35' : '#1a3a5c',
              shadowColor: isSendActive ? '#00CF35' : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: isSendActive ? 8 : 0,
              shadowOpacity: isSendActive ? 0.6 : 0,
              elevation: isSendActive ? 8 : 0,
            }}
          >
            {addComment.isPending ? (
              <ActivityIndicator color="#001935" size="small" />
            ) : (
              <Send size={18} color={isSendActive ? '#001935' : '#4a6fa5'} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {mediaViewer ? (
        <MediaViewer
          visible={mediaViewer.visible}
          type={mediaViewer.type}
          uri={mediaViewer.uri}
          onClose={() => setMediaViewer(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
