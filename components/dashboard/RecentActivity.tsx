import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FileText, FolderKanban, Users } from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'project' | 'client' | 'quotation'
  title: string
  description: string
  timestamp: string
  status?: 'success' | 'warning' | 'info'
}

interface RecentActivityProps {
  activities: ActivityItem[]
}

const activityIcons = {
  project:   FolderKanban,
  client:    Users,
  quotation: FileText,
}

const activityColors = {
  project:   'text-violet-400 bg-violet-500/10',
  client:    'text-blue-400 bg-blue-500/10',
  quotation: 'text-amber-400 bg-amber-500/10',
}

const statusLabel = {
  success: 'Completado',
  warning: 'Pendiente',
  info:    'En proceso',
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500">No hay actividad registrada aún.</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type]
              const colorClass = activityColors[activity.type]

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-900/30 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-200">{activity.title}</p>
                      {activity.status && (
                        <Badge variant={activity.status} className="flex-shrink-0">
                          {statusLabel[activity.status]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-1 truncate">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
