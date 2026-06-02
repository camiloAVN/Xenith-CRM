'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientSchema, ClientFormData, Client } from '@/lib/validations/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface ClientFormProps {
  client?: Client | null
  onSubmit: (data: ClientFormData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function ClientForm({
  client,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          name: client.name,
          company: client.company || '',
          email: client.email,
          phone: client.phone || '',
          address: client.address || '',
          city: client.city || '',
          country: client.country || '',
          taxId: client.taxId || '',
          notes: client.notes || '',
        }
      : undefined,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Nombre *"
          placeholder="Juan Pérez"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Empresa"
          placeholder="Acme Corp"
          error={errors.company?.message}
          {...register('company')}
        />

        <Input
          label="Email *"
          type="email"
          placeholder="juan@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Teléfono"
          placeholder="+52 123 456 7890"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Dirección"
          placeholder="Calle Principal #123"
          error={errors.address?.message}
          {...register('address')}
        />

        <Input
          label="Ciudad"
          placeholder="Ciudad de México"
          error={errors.city?.message}
          {...register('city')}
        />

        <Input
          label="País"
          placeholder="México"
          error={errors.country?.message}
          {...register('country')}
        />

        <Input
          label="NIT"
          placeholder="900.123.456-7"
          error={errors.taxId?.message}
          {...register('taxId')}
        />
      </div>

      <Textarea
        label="Notas"
        placeholder="Información adicional sobre el cliente..."
        rows={4}
        error={errors.notes?.message}
        {...register('notes')}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {client ? 'Actualizar Cliente' : 'Crear Cliente'}
        </Button>
      </div>
    </form>
  )
}
