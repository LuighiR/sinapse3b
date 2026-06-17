export function normalizePhoneDigits(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }

  const digits = value.replace(/\D/g, '')

  if (digits.length === 0) {
    return null
  }

  return digits
}

export function normalizePhoneForMatch(value: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(value)

  if (digits == null) {
    return null
  }

  if (digits.length <= 11) {
    return `55${digits}`
  }

  return digits
}

export function phoneDigitsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftDigits = normalizePhoneDigits(left)
  const rightDigits = normalizePhoneDigits(right)

  if (leftDigits == null || rightDigits == null) {
    return false
  }

  if (leftDigits === rightDigits) {
    return true
  }

  const leftNormalized = normalizePhoneForMatch(leftDigits)
  const rightNormalized = normalizePhoneForMatch(rightDigits)

  return leftNormalized != null && leftNormalized === rightNormalized
}
