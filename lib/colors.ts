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
  Beto:   '#7F8C8D',
  Chino:  '#AAB7B8',
  Cami:   '#E91E8C',
  Costa:  '#00BCD4',
  default:'#95A5A6',
}

export function playerColor(nombre: string): string {
  return PLAYER_COLORS[nombre] ?? PLAYER_COLORS.default
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
