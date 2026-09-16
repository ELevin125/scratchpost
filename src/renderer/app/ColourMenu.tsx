import { seeds } from '../themes'
import { Picker } from './Picker'

interface ColourMenuProps {
  current: number // the current seed hue
  onPick: (hue: number) => void
  onClose: () => void
}

// "Change theme colour": the named seed hues. The whole theme follows the
// one picked (D33).
export function ColourMenu({ current, onPick, onClose }: ColourMenuProps) {
  return (
    <Picker
      ariaLabel="Theme colour"
      placeholder="Theme colour"
      items={seeds.map((seed) => ({
        id: String(seed.hue),
        label: seed.name,
        swatch: seed.hue,
        hint: seed.hue === current ? 'current' : undefined
      }))}
      onPick={(item) => onPick(Number(item.id))}
      onClose={onClose}
    />
  )
}
