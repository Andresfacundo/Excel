import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { useDeletePerson, useUpdatePerson } from '../hooks'
import { PersonForm } from './PersonForm'
import type { NewPerson, Person } from '@/types/domain'
import styles from '../people.module.css'

interface PersonSettingsPanelProps {
  userId: string
  person: Person
  paymentCount: number
  periodCount: number
}

/**
 * Panel de configuracion de una persona: editar su plan, archivarla o
 * eliminarla. El borrado exige escribir el nombre, porque arrastra los pagos.
 */
export function PersonSettingsPanel({
  userId,
  person,
  paymentCount,
  periodCount,
}: PersonSettingsPanelProps) {
  const navigate = useNavigate()
  const { updatePerson } = useUpdatePerson(userId)
  const { deletePerson } = useDeletePerson(userId)

  const [saved, setSaved] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const nameMatches = confirmName.trim().toLowerCase() === person.name.trim().toLowerCase()

  async function handleSave(changes: NewPerson) {
    setSaved(false)
    await updatePerson(person.id, changes)
    setSaved(true)
  }

  async function handleArchiveToggle() {
    setArchiveError(null)
    try {
      await updatePerson(person.id, { archived: !person.archived })
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : 'No se pudo cambiar el archivado.')
    }
  }

  async function handleDelete() {
    if (!nameMatches || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePerson(person.id)
      void navigate('/', { replace: true })
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar.')
      setDeleting(false)
    }
  }

  return (
    <Card title={`Datos de ${person.name}`}>
      <PersonForm person={person} submitLabel="Guardar cambios" onSubmit={handleSave} />
      {saved && <Alert tone="success">Cambios guardados.</Alert>}

      <div className={styles.danger}>
        <p className={styles.dangerTitle}>
          {person.archived ? 'Persona archivada' : 'Archivar'}
        </p>
        <p className={styles.dangerText}>
          {person.archived
            ? 'Esta persona no cuenta en el resumen general. Puedes reactivarla cuando quieras.'
            : 'Al archivar, la persona deja de contar en el resumen general pero se conserva todo su historial.'}
        </p>
        <Button variant="ghost" onClick={() => void handleArchiveToggle()}>
          {person.archived ? 'Reactivar persona' : 'Archivar persona'}
        </Button>
        {archiveError && <Alert tone="error">{archiveError}</Alert>}
      </div>

      <div className={styles.danger}>
        <p className={styles.dangerTitle}>Eliminar definitivamente</p>
        <p className={styles.dangerText}>
          Se borrara la persona, sus {periodCount} periodo{periodCount === 1 ? '' : 's'} y sus{' '}
          {paymentCount} pago{paymentCount === 1 ? '' : 's'}. No se puede deshacer. Escribe{' '}
          <strong>{person.name}</strong> para confirmar.
        </p>

        <TextField
          label="Confirmar nombre"
          type="text"
          autoComplete="off"
          value={confirmName}
          onChange={(event) => {
            setConfirmName(event.target.value)
            setDeleteError(null)
          }}
          error={
            confirmName.length > 0 && !nameMatches ? 'El nombre no coincide.' : undefined
          }
        />

        <Button
          variant="danger"
          disabled={!nameMatches}
          loading={deleting}
          onClick={() => void handleDelete()}
        >
          Eliminar a {person.name}
        </Button>

        {deleteError && <Alert tone="error">{deleteError}</Alert>}
      </div>
    </Card>
  )
}
