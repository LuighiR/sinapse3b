export type KpiPeriodInput = {
  from: string | Date
  to: string | Date
}

export class KpiPeriod {
  static readonly periodType = 'RANGE'
  static readonly saoPauloUtcOffsetHours = 3

  private constructor(
    public readonly from: Date,
    public readonly to: Date,
  ) {}

  static between(input: KpiPeriodInput): KpiPeriod {
    const from = this.toSaoPauloDate(input.from)
    const to = this.toSaoPauloDate(input.to)

    if (from.getTime() > to.getTime()) {
      throw new Error('Invalid KPI period: "from" must be before or equal to "to"')
    }

    return new KpiPeriod(from, to)
  }

  get key(): string {
    return `${KpiPeriod.formatDateKey(this.from)}_${KpiPeriod.formatDateKey(this.to)}`
  }

  eachDay(): Date[] {
    const days: Date[] = []
    const cursor = new Date(this.from.getTime())

    while (cursor.getTime() <= this.to.getTime()) {
      days.push(new Date(cursor.getTime()))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return days
  }

  static formatDateKey(value: Date): string {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  static toDatabaseDate(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }

  private static toSaoPauloDate(value: string | Date): Date {
    if (value instanceof Date) {
      return new Date(Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        this.saoPauloUtcOffsetHours,
      ))
    }

    const [year, month, day] = value.split('-').map((part) => Number(part))

    if ([year, month, day].some((part) => !Number.isFinite(part))) {
      throw new Error(`Invalid KPI date: ${value}`)
    }

    const parsed = new Date(Date.UTC(year, month - 1, day, this.saoPauloUtcOffsetHours))

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      throw new Error(`Invalid KPI date: ${value}`)
    }

    return parsed
  }
}
