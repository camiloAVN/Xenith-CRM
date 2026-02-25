'use client'

import { useState } from 'react'
import { MessageSquare, Edit2, Trash2, Send } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Comment {
  id: string
  content: string
  createdAt: string | Date
  updatedAt: string | Date
  user: { id: string; name?: string | null; email: string; image?: string | null }
}

interface TaskCommentsProps {
  taskId: string
  projectId: string
  comments: Comment[]
  currentUserId: string
  onCommentAdded?: (comment: Comment) => void
  onCommentUpdated?: (comment: Comment) => void
  onCommentDeleted?: (commentId: string) => void
}

function formatRelative(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'ahora'
  if (diffMins < 60) return `hace ${diffMins}m`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d)
}

function getUserInitial(user: { name?: string | null; email: string }) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}

export function TaskComments({
  taskId,
  projectId,
  comments: initialComments,
  currentUserId,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
}: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const baseUrl = `/api/v1/projects/${projectId}/tasks/${taskId}/comments`

  const handleSubmit = async () => {
    if (!newContent.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim() }),
      })
      if (res.ok) {
        const comment = await res.json()
        setComments((prev) => [...prev, comment])
        setNewContent('')
        onCommentAdded?.(comment)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${baseUrl}/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)))
        setEditingId(null)
        onCommentUpdated?.(updated)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('¿Eliminar este comentario?')) return
    try {
      const res = await fetch(`${baseUrl}/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
        onCommentDeleted?.(commentId)
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <MessageSquare className="w-4 h-4" />
        <span>{comments.length} comentario{comments.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Comment list */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-violet-500/30 border border-violet-500/50 flex items-center justify-center text-xs font-medium text-violet-300 flex-shrink-0 mt-0.5">
              {getUserInitial(comment.user)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-200">
                  {comment.user.name ?? comment.user.email}
                </span>
                <span className="text-xs text-gray-500">{formatRelative(comment.createdAt)}</span>
              </div>

              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(comment.id)}
                      disabled={isSubmitting}
                      className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 rounded-md transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group/comment relative">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{comment.content}</p>
                  {comment.user.id === currentUserId && (
                    <div className="absolute top-0 right-0 hidden group-hover/comment:flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditContent(comment.content)
                        }}
                        className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New comment input */}
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-violet-500/30 border border-violet-500/50 flex items-center justify-center text-xs font-medium text-violet-300 flex-shrink-0 mt-0.5">
          Y
        </div>
        <div className="flex-1 space-y-2">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Escribe un comentario..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none transition-colors"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newContent.trim() || isSubmitting}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
              'bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <Send className="w-3 h-3" />
            Comentar
          </button>
        </div>
      </div>
    </div>
  )
}
