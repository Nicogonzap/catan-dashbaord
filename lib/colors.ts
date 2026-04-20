export const PLAYER_COLORS: Record<string, string> = {
  Gallo:  '#C0392B',
  Gaspa:  '#17A589',
  Hugo:   '#2471A3',
  Moch:   '#6E4E37',
  Ivo:    '#D4AC0D',
  Max:    '#D5D8DC',
  Sofi:   '#8E44AD',
  Gasta:  '#E67E22',
  Rodri:  '#7F8C8D',
  Abegol: '#95A5A6',
  Jota:   '#85929E',
  Beto:   '#5D6D7E',
  Chino:  '#AAB7B8',
  Cami:   '#E91E8C',
  Costa:  '#00BCD4',
  default:'#95A5A6',
}

export const PLAYER_ORDER = [
  'Gallo', 'Ivo', 'Gaspa', 'Hugo', 'Moch', 'Max',
  'Sofi', 'Gasta', 'Rodri', 'Abegol', 'Jota', 'Beto', 'Chino', 'Cami', 'Costa',
]

export function playerColor(nombre: string): string {
  return PLAYER_COLORS[nombre] ?? PLAYER_COLORS.default
}

export function lightenColor(hex: string, alpha = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = String(d.getDate()).padStart(2, '0')
  const month = MESES_ES[d.getMonth()]
  const year = String(d.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

export const OCEAN = {
  bgPage:         '#1B6CA8',
  bgNav:          '#154E80',
  bgHover:        '#5DADE2',
  cardBg:         '#EBF5FB',
  cardBgDark:     '#D6EAF8',
  cardBorder:     '#AED6F1',
  textOnOcean:    '#FFFFFF',
  textMutedOcean: 'rgba(255,255,255,0.75)',
  textOnCard:     '#1A2F45',
  textMutedCard:  '#5D7A8A',
  accentGold:     '#D4AC0D',
  accentGoldLight:'#F9E4A0',
  grandSlamBg:    '#D4AC0D',
  grandSlamText:  '#5D3A00',
}

export const MIEMBROS_OFICIALES = ['Gallo', 'Ivo', 'Gaspa', 'Hugo', 'Moch', 'Max']
