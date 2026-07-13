import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ListChecks,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'

type ProjectTask = Tables<'project_tasks'>
type TeamProfile = Pick<Tables<'profiles'>, 'id' | 'nome'>

interface TasksCardProps {
  projectId: string
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10)

function isLate(task: ProjectTask): boolean {
  if (task.concluida || !task.prazo) return false
  return task.prazo < TODAY_ISO()
}

/** Card de tarefas do projeto — ordenação manual, responsável e prazo. */
export default function TasksCard({ projectId }: TasksCardProps) {
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const [newTitle, setNewTitle] = useState('')
  const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(
    null
  )

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async (): Promise<ProjectTask[]> => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('ordem', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: profiles } = useQuery({
    queryKey: ['team-profiles'],
    queryFn: async (): Promise<TeamProfile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })

  const createMutation = useMutation({
    mutationFn: async (titulo: string) => {
      const maxOrdem = tasks?.reduce((max, t) => Math.max(max, t.ordem), 0) ?? 0
      const { error } = await supabase.from('project_tasks').insert({
        project_id: projectId,
        titulo,
        ordem: maxOrdem + 1,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      setNewTitle('')
      await invalidate()
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (task: ProjectTask) => {
      const { error } = await supabase
        .from('project_tasks')
        .update({ concluida: !task.concluida })
        .eq('id', task.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', taskId)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const updateFieldMutation = useMutation({
    mutationFn: async (input: {
      id: string
      changes: Partial<Pick<ProjectTask, 'responsavel_id' | 'prazo'>>
    }) => {
      const { error } = await supabase
        .from('project_tasks')
        .update(input.changes)
        .eq('id', input.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      setEditingAssigneeId(null)
      await invalidate()
    },
  })

  const swapMutation = useMutation({
    mutationFn: async (input: { a: ProjectTask; b: ProjectTask }) => {
      const { a, b } = input
      const [resA, resB] = await Promise.all([
        supabase
          .from('project_tasks')
          .update({ ordem: b.ordem })
          .eq('id', a.id),
        supabase
          .from('project_tasks')
          .update({ ordem: a.ordem })
          .eq('id', b.id),
      ])
      if (resA.error) throw new Error(resA.error.message)
      if (resB.error) throw new Error(resB.error.message)
    },
    onSuccess: invalidate,
  })

  const handleAddTask = () => {
    const title = newTitle.trim()
    if (title === '' || createMutation.isPending) return
    createMutation.mutate(title)
  }

  const moveTask = (index: number, direction: -1 | 1) => {
    if (!tasks) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= tasks.length) return
    swapMutation.mutate({ a: tasks[index], b: tasks[targetIndex] })
  }

  const total = tasks?.length ?? 0
  const done = tasks?.filter((t) => t.concluida).length ?? 0

  return (
    <motion.section
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Tarefas do projeto"
      className="rounded-2xl border border-white/5 bg-surface-1 p-6"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <ListChecks className="h-4 w-4 text-accent" />
        Tarefas
        {total > 0 && (
          <span className="text-xs font-light text-muted">
            ({done}/{total})
          </span>
        )}
      </h2>

      {isLoading && (
        <div className="mt-4 h-20 animate-pulse rounded-xl bg-surface-2" />
      )}

      {!isLoading && total === 0 && (
        <p className="mt-4 text-sm font-light text-muted">
          Nenhuma tarefa ainda. Adicione a primeira abaixo.
        </p>
      )}

      {!isLoading && total > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {tasks!.map((task, index) => {
            const late = isLate(task)
            const assignee = profiles?.find((p) => p.id === task.responsavel_id)
            return (
              <li
                key={task.id}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-white/[0.03]"
              >
                <button
                  type="button"
                  aria-label={
                    task.concluida ? 'Marcar como pendente' : 'Concluir tarefa'
                  }
                  onClick={() => toggleMutation.mutate(task)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
                    task.concluida
                      ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-300'
                      : 'border-white/15 text-transparent hover:border-accent/50'
                  }`}
                >
                  <Check className="h-3 w-3" />
                </button>

                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    task.concluida ? 'text-muted/60 line-through' : 'text-ink'
                  }`}
                >
                  {task.titulo}
                </span>

                {editingAssigneeId === task.id ? (
                  <select
                    autoFocus
                    value={task.responsavel_id ?? ''}
                    onChange={(e) =>
                      updateFieldMutation.mutate({
                        id: task.id,
                        changes: { responsavel_id: e.target.value || null },
                      })
                    }
                    onBlur={() => setEditingAssigneeId(null)}
                    className="rounded-md border border-white/10 bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-accent/60"
                  >
                    <option value="">Sem responsável</option>
                    {profiles?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  assignee && (
                    <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex">
                      <UserRound className="h-3 w-3" />
                      {assignee.nome}
                    </span>
                  )
                )}

                {task.prazo && (
                  <span
                    className={`hidden text-xs sm:inline ${
                      late ? 'font-medium text-red-400' : 'text-muted'
                    }`}
                  >
                    {task.prazo.slice(8, 10)}/{task.prazo.slice(5, 7)}
                  </span>
                )}

                <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label="Subir tarefa"
                    disabled={index === 0}
                    onClick={() => moveTask(index, -1)}
                    className="rounded p-1 text-muted/60 hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Descer tarefa"
                    disabled={index === tasks!.length - 1}
                    onClick={() => moveTask(index, 1)}
                    className="rounded p-1 text-muted/60 hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Atribuir responsável"
                    onClick={() => setEditingAssigneeId(task.id)}
                    className="rounded p-1 text-muted/60 hover:bg-white/5 hover:text-ink"
                  >
                    <UserRound className="h-3.5 w-3.5" />
                  </button>
                  <label className="relative rounded p-1 text-muted/60 hover:bg-white/5 hover:text-ink">
                    <Calendar className="h-3.5 w-3.5" />
                    <input
                      type="date"
                      aria-label="Definir prazo"
                      value={task.prazo ?? ''}
                      onChange={(e) =>
                        updateFieldMutation.mutate({
                          id: task.id,
                          changes: { prazo: e.target.value || null },
                        })
                      }
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Excluir tarefa ${task.titulo}`}
                    onClick={() => deleteMutation.mutate(task.id)}
                    className="rounded p-1 text-muted/60 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-white/5 pt-4">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddTask()
            }
          }}
          placeholder="Adicionar tarefa e pressionar Enter…"
          aria-label="Nova tarefa"
          disabled={createMutation.isPending}
          className="w-full rounded-lg border border-white/5 bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
        />
      </div>
    </motion.section>
  )
}
