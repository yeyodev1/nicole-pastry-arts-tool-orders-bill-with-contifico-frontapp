export const PRODUCT_MAPPINGS: Record<string, string> = {
  // Common Variations -> Official Name
  'tarta vasca': 'Tarta de Queso',
  'burnt cheesecake': 'Tarta de Queso',
  'cheesecake vasco': 'Tarta de Queso',
  'pistacho': 'Pistachito',
  'tarta de pistacho': 'Pistachito',
  'kiche': 'Quiche',
  'kiche de pollo': 'Quiche de Pollo',
  // Add more mappings as discovered
}

export function getOfficialName(inputName: string): string {
  const normalized = inputName.toLowerCase().trim()
  return PRODUCT_MAPPINGS[normalized] || inputName
}
