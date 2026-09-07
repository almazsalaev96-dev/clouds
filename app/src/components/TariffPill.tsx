import './TariffPill.css'

export interface TariffPillProps {
  /** Marks available for this item, verbatim from the pack. */
  tariff: number
  /** The command word as it is printed on the paper: "Evaluate", "Analyse". */
  commandWord?: string | null
  /** Rendered small and quiet — used inside dense run strips. */
  small?: boolean
}

/**
 * The tariff carried as a monospace pill, with the command word in a second slot.
 * Tabular numerals so a column of pills lines up; one quiet ground for every
 * tariff, because a colour here would read as "this one is hard".
 */
export function TariffPill({ tariff, commandWord, small = false }: TariffPillProps) {
  const marks = `${tariff} ${tariff === 1 ? 'mark' : 'marks'}`
  return (
    <span className={small ? 'tariff-pill tariff-pill--small' : 'tariff-pill'}>
      <span className="tariff-pill__marks mono">{marks}</span>
      {commandWord ? (
        <>
          <span className="tariff-pill__rule" aria-hidden="true" />
          <span className="tariff-pill__command">{commandWord}</span>
        </>
      ) : null}
    </span>
  )
}

export default TariffPill
