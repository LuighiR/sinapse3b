import { Injectable } from '@nestjs/common'
import { BranchScopeService } from '../../companies/application/branch-scope.service'
import { KpiPeriod } from '../domain/kpi-period'

export type WhatsAppKpiQueryPeriodInput = {
  clientId: string
  from: string | Date
  to: string | Date
  chatId?: string
  branchId?: number
}

export type WhatsAppKpiTagsInput = {
  clientId: string
}

export type WhatsAppKpiTagHourlyInput = WhatsAppKpiQueryPeriodInput & {
  tagId: string | number | bigint
}

export type WhatsAppKpiTagHourlyComparisonInput = WhatsAppKpiTagHourlyInput & {
  sellerId?: string | number | bigint
}

export type WhatsAppKpiPeriodView = {
  from: string
  to: string
  key: string
}

export type WhatsAppKpiSummaryResponse = {
  period: WhatsAppKpiPeriodView
  totalConversations: { count: number }
  receivedMessages: { count: number }
}

export type WhatsAppKpiAgentRankingRow = {
  agentKey: string
  agentLabel: string
  employeeId: string | null
  employeeName: string | null
  employeeChatId: string | null
  assignedUserName: string | null
  assignedUserEmail: string | null
  sessionsCount: number
}

export type WhatsAppKpiAgentRankingResponse = {
  period: WhatsAppKpiPeriodView
  rows: WhatsAppKpiAgentRankingRow[]
}

export type WhatsAppKpiSessionsHourlyRow = {
  hour: string
  sessionsCount: number
}

export type WhatsAppKpiSessionsHourlyResponse = {
  period: WhatsAppKpiPeriodView
  rows: WhatsAppKpiSessionsHourlyRow[]
}

export type WhatsAppKpiSessionsDailyRow = {
  date: string
  sessionsCount: number
}

export type WhatsAppKpiSessionsDailyResponse = {
  period: WhatsAppKpiPeriodView
  rows: WhatsAppKpiSessionsDailyRow[]
}

export type WhatsAppKpiMessagesHourlyRow = {
  hour: string
  receivedMessagesCount: number
}

export type WhatsAppKpiMessagesHourlyResponse = {
  period: WhatsAppKpiPeriodView
  rows: WhatsAppKpiMessagesHourlyRow[]
}

export type WhatsAppKpiMessagesDailyRow = {
  date: string
  receivedMessagesCount: number
}

export type WhatsAppKpiMessagesDailyResponse = {
  period: WhatsAppKpiPeriodView
  rows: WhatsAppKpiMessagesDailyRow[]
}

export type WhatsAppKpiTagHourlyRow = {
  hour: string
  sessionsCount: number
}

export type WhatsAppKpiTagHourlyResponse = {
  period: WhatsAppKpiPeriodView
  tagId: string
  rows: WhatsAppKpiTagHourlyRow[]
}

export type WhatsAppKpiTagComparisonRow = {
  hour: string
  tagSessionsCount: number
  openBudgetsCount: number
}

export type WhatsAppKpiTagComparisonResponse = {
  period: WhatsAppKpiPeriodView
  tagId: string
  rows: WhatsAppKpiTagComparisonRow[]
}

export type WhatsAppKpiTagListItem = {
  tagId: string
  tagName: string
  color: string | null
}

export type WhatsAppKpiTagListResponse = {
  tags: WhatsAppKpiTagListItem[]
}

export type WhatsAppKpiSummaryCountsRow = {
  totalConversationsCount: string | number | bigint
  receivedMessagesCount: string | number | bigint
}

export type WhatsAppKpiAgentRankingSourceRow = {
  employeeId: string | number | bigint | null
  employeeName: string | null
  employeeChatId: string | null
  assignedUserName: string | null
  assignedUserEmail: string | null
  sessionsCount: string | number | bigint
}

export type WhatsAppKpiSessionsHourlySourceRow = {
  hour: string | number | bigint
  sessionsCount: string | number | bigint
}

export type WhatsAppKpiMessagesHourlySourceRow = {
  hour: string | number | bigint
  receivedMessagesCount: string | number | bigint
}

export type WhatsAppKpiSessionsDailySourceRow = {
  date: string | Date
  sessionsCount: string | number | bigint
}

export type WhatsAppKpiMessagesDailySourceRow = {
  date: string | Date
  receivedMessagesCount: string | number | bigint
}

export type WhatsAppKpiTagHourlySourceRow = {
  hour: string | number | bigint
  sessionsCount: string | number | bigint
}

export type WhatsAppKpiTagComparisonSourceRow = {
  hour: string | number | bigint
  tagSessionsCount: string | number | bigint
  openBudgetsCount: string | number | bigint
}

export type WhatsAppKpiTagSourceRow = {
  tagId: string | number | bigint
  tagName: string
  color: string | null
}

export type WhatsAppKpiQueryRepository = {
  getSummaryCounts(input: {
    clientId: string
    period: KpiPeriod
    chatId?: string
    branchId?: number
  }): Promise<WhatsAppKpiSummaryCountsRow>
  getAgentRankingRows(input: {
    clientId: string
    period: KpiPeriod
    chatId?: string
    branchId?: number
  }): Promise<WhatsAppKpiAgentRankingSourceRow[]>
  getSessionsHourlyRows(input: {
    clientId: string
    period: KpiPeriod
    chatId?: string
    branchId?: number
  }): Promise<WhatsAppKpiSessionsHourlySourceRow[]>
  getMessagesHourlyRows(input: {
    clientId: string
    period: KpiPeriod
    chatId?: string
    branchId?: number
  }): Promise<WhatsAppKpiMessagesHourlySourceRow[]>
  getSessionsDailyRows(input: {
    clientId: string
    period: KpiPeriod
    chatId?: string
    branchId?: number
  }): Promise<WhatsAppKpiSessionsDailySourceRow[]>
  getMessagesDailyRows(input: {
    clientId: string
    period: KpiPeriod
    chatId?: string
    branchId?: number
  }): Promise<WhatsAppKpiMessagesDailySourceRow[]>
  listTags(input: WhatsAppKpiTagsInput): Promise<WhatsAppKpiTagSourceRow[]>
  getTagHourlyRows(input: {
    clientId: string
    period: KpiPeriod
    tagId: bigint
    chatId?: string
    branchId?: number
  }): Promise<WhatsAppKpiTagHourlySourceRow[]>
  getTagHourlyComparisonRows(input: {
    clientId: string
    period: KpiPeriod
    tagId: bigint
    chatId?: string
    branchId?: number
    sellerId?: number
  }): Promise<WhatsAppKpiTagComparisonSourceRow[]>
}

@Injectable()
export class WhatsAppKpiQueryService {
  constructor(
    private readonly repository: WhatsAppKpiQueryRepository,
    private readonly branchScopeService?: BranchScopeService,
  ) {}

  async getSummary(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiSummaryResponse> {
    const period = this.toPeriod(input)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const row = await this.repository.getSummaryCounts({
      clientId: input.clientId,
      period,
      chatId,
      branchId,
    })

    return {
      period: this.toPeriodView(period),
      totalConversations: { count: this.toCount(row.totalConversationsCount) },
      receivedMessages: { count: this.toCount(row.receivedMessagesCount) },
    }
  }

  async getAgentRanking(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiAgentRankingResponse> {
    const period = this.toPeriod(input)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const rows = await this.repository.getAgentRankingRows({
      clientId: input.clientId,
      period,
      chatId,
      branchId,
    })

    return {
      period: this.toPeriodView(period),
      rows: rows
        .map((row) => this.toAgentRankingRow(row))
        .sort((left, right) => {
          if (left.sessionsCount !== right.sessionsCount) {
            return right.sessionsCount - left.sessionsCount
          }

          return left.agentLabel.localeCompare(right.agentLabel)
        }),
    }
  }

  async getSessionsHourly(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiSessionsHourlyResponse> {
    const period = this.toPeriod(input)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const rows = await this.repository.getSessionsHourlyRows({
      clientId: input.clientId,
      period,
      chatId,
      branchId,
    })

    return {
      period: this.toPeriodView(period),
      rows: this.buildSessionsHourlyRows(rows),
    }
  }

  async getMessagesHourly(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiMessagesHourlyResponse> {
    const period = this.toPeriod(input)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const rows = await this.repository.getMessagesHourlyRows({
      clientId: input.clientId,
      period,
      chatId,
      branchId,
    })

    return {
      period: this.toPeriodView(period),
      rows: this.buildMessagesHourlyRows(rows),
    }
  }

  async getSessionsDaily(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiSessionsDailyResponse> {
    const period = this.toPeriod(input)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const rows = await this.repository.getSessionsDailyRows({
      clientId: input.clientId,
      period,
      chatId,
      branchId,
    })

    return {
      period: this.toPeriodView(period),
      rows: this.buildSessionsDailyRows(period, rows),
    }
  }

  async getMessagesDaily(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiMessagesDailyResponse> {
    const period = this.toPeriod(input)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const rows = await this.repository.getMessagesDailyRows({
      clientId: input.clientId,
      period,
      chatId,
      branchId,
    })

    return {
      period: this.toPeriodView(period),
      rows: this.buildMessagesDailyRows(period, rows),
    }
  }

  async listTags(input: WhatsAppKpiTagsInput): Promise<WhatsAppKpiTagListResponse> {
    const rows = await this.repository.listTags(input)

    return {
      tags: rows
        .map((row) => ({
          tagId: String(row.tagId),
          tagName: row.tagName,
          color: row.color,
        }))
        .sort((left, right) => left.tagName.localeCompare(right.tagName)),
    }
  }

  async getTagHourly(input: WhatsAppKpiTagHourlyInput): Promise<WhatsAppKpiTagHourlyResponse> {
    const period = this.toPeriod(input)
    const tagId = this.normalizeTagId(input.tagId)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const rows = await this.repository.getTagHourlyRows({
      clientId: input.clientId,
      period,
      tagId,
      chatId,
      branchId,
    })

    return {
      period: this.toPeriodView(period),
      tagId: tagId.toString(),
      rows: this.buildTagHourlyRows(rows),
    }
  }

  async getTagHourlyComparison(
    input: WhatsAppKpiTagHourlyComparisonInput,
  ): Promise<WhatsAppKpiTagComparisonResponse> {
    const period = this.toPeriod(input)
    const tagId = this.normalizeTagId(input.tagId)
    const chatId = this.normalizeChatId(input.chatId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const sellerId = this.normalizeSellerId(input.sellerId)
    const rows = await this.repository.getTagHourlyComparisonRows({
      clientId: input.clientId,
      period,
      tagId,
      chatId,
      branchId,
      sellerId,
    })

    return {
      period: this.toPeriodView(period),
      tagId: tagId.toString(),
      rows: this.buildTagComparisonRows(rows),
    }
  }

  private buildSessionsHourlyRows(rows: WhatsAppKpiSessionsHourlySourceRow[]): WhatsAppKpiSessionsHourlyRow[] {
    const grouped = this.createHourlyMap<WhatsAppKpiSessionsHourlyRow>((hour) => ({
      hour,
      sessionsCount: 0,
    }))

    for (const row of rows) {
      const hour = this.toHour(row.hour)
      const current = grouped.get(hour) ?? { hour, sessionsCount: 0 }
      current.sessionsCount += this.toCount(row.sessionsCount)
      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private buildMessagesHourlyRows(rows: WhatsAppKpiMessagesHourlySourceRow[]): WhatsAppKpiMessagesHourlyRow[] {
    const grouped = this.createHourlyMap<WhatsAppKpiMessagesHourlyRow>((hour) => ({
      hour,
      receivedMessagesCount: 0,
    }))

    for (const row of rows) {
      const hour = this.toHour(row.hour)
      const current = grouped.get(hour) ?? { hour, receivedMessagesCount: 0 }
      current.receivedMessagesCount += this.toCount(row.receivedMessagesCount)
      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private buildSessionsDailyRows(
    period: KpiPeriod,
    rows: WhatsAppKpiSessionsDailySourceRow[],
  ): WhatsAppKpiSessionsDailyRow[] {
    const grouped = this.createDailyMap<WhatsAppKpiSessionsDailyRow>(period, (date) => ({
      date,
      sessionsCount: 0,
    }))

    for (const row of rows) {
      const date = this.toDateKey(row.date)
      const current = grouped.get(date) ?? { date, sessionsCount: 0 }
      current.sessionsCount += this.toCount(row.sessionsCount)
      grouped.set(date, current)
    }

    return period.eachDay().map((day) => {
      const date = KpiPeriod.formatDateKey(day)
      return grouped.get(date) ?? { date, sessionsCount: 0 }
    })
  }

  private buildMessagesDailyRows(
    period: KpiPeriod,
    rows: WhatsAppKpiMessagesDailySourceRow[],
  ): WhatsAppKpiMessagesDailyRow[] {
    const grouped = this.createDailyMap<WhatsAppKpiMessagesDailyRow>(period, (date) => ({
      date,
      receivedMessagesCount: 0,
    }))

    for (const row of rows) {
      const date = this.toDateKey(row.date)
      const current = grouped.get(date) ?? { date, receivedMessagesCount: 0 }
      current.receivedMessagesCount += this.toCount(row.receivedMessagesCount)
      grouped.set(date, current)
    }

    return period.eachDay().map((day) => {
      const date = KpiPeriod.formatDateKey(day)
      return grouped.get(date) ?? { date, receivedMessagesCount: 0 }
    })
  }

  private buildTagHourlyRows(rows: WhatsAppKpiTagHourlySourceRow[]): WhatsAppKpiTagHourlyRow[] {
    const grouped = this.createHourlyMap<WhatsAppKpiTagHourlyRow>((hour) => ({
      hour,
      sessionsCount: 0,
    }))

    for (const row of rows) {
      const hour = this.toHour(row.hour)
      const current = grouped.get(hour) ?? { hour, sessionsCount: 0 }
      current.sessionsCount += this.toCount(row.sessionsCount)
      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private buildTagComparisonRows(rows: WhatsAppKpiTagComparisonSourceRow[]): WhatsAppKpiTagComparisonRow[] {
    const grouped = this.createHourlyMap<WhatsAppKpiTagComparisonRow>((hour) => ({
      hour,
      tagSessionsCount: 0,
      openBudgetsCount: 0,
    }))

    for (const row of rows) {
      const hour = this.toHour(row.hour)
      const current = grouped.get(hour) ?? {
        hour,
        tagSessionsCount: 0,
        openBudgetsCount: 0,
      }

      current.tagSessionsCount += this.toCount(row.tagSessionsCount)
      current.openBudgetsCount += this.toCount(row.openBudgetsCount)
      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private toAgentRankingRow(row: WhatsAppKpiAgentRankingSourceRow): WhatsAppKpiAgentRankingRow {
    const employeeId = row.employeeId === null ? null : String(row.employeeId)
    const employeeName = this.toTrimmedNullable(row.employeeName)
    const employeeChatId = this.toTrimmedNullable(row.employeeChatId)
    const assignedUserName = this.toTrimmedNullable(row.assignedUserName)
    const assignedUserEmail = this.toTrimmedNullable(row.assignedUserEmail)
    const agentKey = employeeId !== null ? `employee:${employeeId}` : assignedUserEmail ?? assignedUserName ?? 'unassigned'
    const agentLabel = employeeName ?? assignedUserName ?? assignedUserEmail ?? 'Nao atribuido'

    return {
      agentKey,
      agentLabel,
      employeeId,
      employeeName,
      employeeChatId,
      assignedUserName,
      assignedUserEmail,
      sessionsCount: this.toCount(row.sessionsCount),
    }
  }

  private createDailyMap<T extends { date: string }>(period: KpiPeriod, factory: (date: string) => T): Map<string, T> {
    const map = new Map<string, T>()

    for (const day of period.eachDay()) {
      const key = KpiPeriod.formatDateKey(day)
      map.set(key, factory(key))
    }

    return map
  }

  private createHourlyMap<T extends { hour: string }>(factory: (hour: string) => T): Map<string, T> {
    const map = new Map<string, T>()

    for (let hour = 0; hour < 24; hour += 1) {
      const key = String(hour).padStart(2, '0')
      map.set(key, factory(key))
    }

    return map
  }

  private toTrimmedNullable(value: string | null): string | null {
    if (value === null) {
      return null
    }

    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  }

  private normalizeTagId(value: string | number | bigint): bigint {
    if (typeof value === 'bigint') {
      return value
    }

    if (typeof value === 'number') {
      if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
        throw new Error(`Invalid tagId: ${value}`)
      }

      return BigInt(value)
    }

    const trimmed = value.trim()

    if (trimmed.length === 0) {
      throw new Error('Invalid tagId: empty value')
    }

    try {
      return BigInt(trimmed)
    } catch {
      throw new Error(`Invalid tagId: ${value}`)
    }
  }

  private normalizeSellerId(value: string | number | bigint | undefined): number | undefined {
    if (value === undefined) {
      return undefined
    }

    if (typeof value === 'number') {
      if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
        throw new Error(`Invalid sellerId: ${value}`)
      }

      return value
    }

    if (typeof value === 'bigint') {
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`Invalid sellerId: ${value.toString()}`)
      }

      return Number(value)
    }

    const trimmed = value.trim()

    if (trimmed.length === 0) {
      return undefined
    }

    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`Invalid sellerId: ${value}`)
    }

    const parsed = BigInt(trimmed)

    if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Invalid sellerId: ${value}`)
    }

    return Number(parsed)
  }

  private normalizeChatId(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined
    }

    const trimmed = value.trim().toLocaleLowerCase()
    return trimmed.length === 0 ? undefined : trimmed
  }

  private async resolveBranchScope(clientId: string, branchId?: number): Promise<number | undefined> {
    if (branchId !== undefined && this.branchScopeService !== undefined) {
      await this.branchScopeService.assertBranchScope(clientId, branchId)
    }

    return branchId
  }

  private toPeriod(input: WhatsAppKpiQueryPeriodInput): KpiPeriod {
    return KpiPeriod.between({
      from: input.from,
      to: input.to,
    })
  }

  private toPeriodView(period: KpiPeriod): WhatsAppKpiPeriodView {
    return {
      from: KpiPeriod.formatDateKey(period.from),
      to: KpiPeriod.formatDateKey(period.to),
      key: period.key,
    }
  }

  private toHour(value: string | number | bigint): string {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      const parsed = Number(trimmed)

      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 23) {
        return String(parsed).padStart(2, '0')
      }

      return '00'
    }

    const parsed = Number(value)

    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 23) {
      return String(parsed).padStart(2, '0')
    }

    return '00'
  }

  private toDateKey(value: string | Date): string {
    if (value instanceof Date) {
      return KpiPeriod.formatDateKey(value)
    }

    const trimmed = value.trim()
    return trimmed.slice(0, 10)
  }

  private toCount(value: string | number | bigint): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
}
