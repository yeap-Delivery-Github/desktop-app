export function formatPhone(phone: string): string {
  if (phone) {
    phone = phone.replace(/\D/g, '')
    phone = phone.replace(/^(\d{2})(\d)/, '($1) $2')
    phone = phone.replace(/(\d{5})(\d)/, '$1-$2')
    return phone
  }

  return ''
}
