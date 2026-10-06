import { seededHue } from '../../shared/tags'
import { labelHues } from '../themes'
import { Picker } from './Picker'

interface LabelColourMenuProps {
  word: string
  current: number | null // the chosen hue; null while the word keeps its own
  onPick: (hue: number | null) => void
  onClose: () => void
}

// "Change label colour": a few named hues for one word, or back to the colour
// its text gives it (6.8, D49).
export function LabelColourMenu({ word, current, onPick, onClose }: LabelColourMenuProps) {
  const now = (on: boolean) => (on ? 'current' : undefined)
  return (
    <Picker
      ariaLabel={`Colour of ${word}`}
      placeholder={`Colour of ${word}`}
      items={[
        { id: 'auto', label: 'Automatic', detail: 'from the word', swatch: seededHue(word), hint: now(current === null) },
        ...labelHues.map((colour) => ({
          id: String(colour.hue),
          label: colour.name,
          swatch: colour.hue,
          hint: now(colour.hue === current)
        }))
      ]}
      onPick={(item) => onPick(item.id === 'auto' ? null : Number(item.id))}
      onClose={onClose}
    />
  )
}
