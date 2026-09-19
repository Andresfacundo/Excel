import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cx } from '@/lib/cx'
import { money } from '@/lib/format'
import { statusLabel } from '@/features/tracking/domain'
import type { TrackingResult } from '@/features/tracking/domain'
import type { Person } from '@/types/domain'
import styles from '../people.module.css'

interface PersonListItemProps {
  person: Person
  tracking: TrackingResult
}

export function PersonListItem({ person, tracking }: PersonListItemProps) {
  const label = person.archived ? 'Archivada' : statusLabel(tracking)

  return (
    <li>
      <Link
        to={`/persona/${person.id}`}
        className={cx(styles.item, person.archived && styles.itemArchived)}
      >
        <div className={styles.itemHead}>
          <div>
            <div className={styles.itemName}>{person.name}</div>
            {person.concept && <div className={styles.itemConcept}>{person.concept}</div>}
          </div>
          <Badge status={person.archived ? 'info' : tracking.status}>{label}</Badge>
        </div>

        <ProgressBar
          percent={tracking.percent}
          status={person.archived ? 'info' : tracking.status}
          label={`${person.name}: ${tracking.percent}% cubierto`}
        />

        <div className={styles.itemNumbers}>
          <span className={styles.itemPaid}>
            {money(tracking.totalPaid)}{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
              de {money(tracking.totalTarget)}
            </span>
          </span>
          {/* El color sigue al signo de la cifra que se pinta, no al estado
              general: un saldo en contra en verde se lee como buena noticia. */}
          <span
            className={cx(
              styles.itemDrift,
              tracking.overdueAmount > 0 || tracking.totalDrift < 0
                ? styles.negative
                : styles.positive,
            )}
          >
            {tracking.overdueAmount > 0
              ? `${money(tracking.overdueAmount)} vencido`
              : tracking.totalDrift < 0
                ? `${money(Math.abs(tracking.totalDrift))} por debajo`
                : money(tracking.totalDrift)}
          </span>
        </div>
      </Link>
    </li>
  )
}
