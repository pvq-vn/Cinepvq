"use client";

import { useState } from "react";
import { MessageSquare, ThumbsUp, Send, User } from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

interface CommentItem {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  liked?: boolean;
}

interface MovieCommentsProps {
  movieSlug: string;
}

export default function MovieComments({}: MovieCommentsProps) {
  const { user } = useUserStore();
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<CommentItem[]>([
    {
      id: "c1",
      author: "Hoàng Minh",
      content: "Phim này xem cuốn thực sự, diễn xuất và hình ảnh chất lượng cao!",
      createdAt: "Vừa xong",
      likes: 5,
    },
    {
      id: "c2",
      author: "Ngọc Lan",
      content: "Nhạc phim hay, kỹ xảo mãn nhãn. Rất đáng xem trong tuần này.",
      createdAt: "2 giờ trước",
      likes: 12,
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;

    const newComment: CommentItem = {
      id: "cmt-" + Date.now(),
      author: user?.username || "Khán giả ẩn danh",
      content: trimmed,
      createdAt: "Vừa xong",
      likes: 0,
    };

    setComments([newComment, ...comments]);
    setCommentText("");
  };

  const handleLike = (id: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const liked = !c.liked;
          return {
            ...c,
            liked,
            likes: liked ? c.likes + 1 : c.likes - 1,
          };
        }
        return c;
      })
    );
  };

  return (
    <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 sm:p-8 border border-zinc-200/60 dark:border-zinc-800/60 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-violet-500" />
          Bình luận & Đánh giá ({comments.length})
        </h3>
        <span className="text-xs text-zinc-400">
          Chia sẻ cảm nghĩ của bạn về bộ phim
        </span>
      </div>

      {/* New comment input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-400 flex-shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Viết bình luận của bạn về bộ phim..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="h-3.5 w-3.5" />
            Gửi bình luận
          </button>
        </div>
      </form>

      {/* Comment list */}
      <div className="space-y-4 pt-4 divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
        {comments.map((comment) => (
          <div key={comment.id} className="pt-4 first:pt-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                  {comment.author}
                </span>
                <span className="text-[10px] text-zinc-400">• {comment.createdAt}</span>
              </div>
              <button
                onClick={() => handleLike(comment.id)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  comment.liked
                    ? "text-violet-600 font-bold"
                    : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{comment.likes}</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {comment.content}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
